import VideoPlayer from './components/VideoPlayer';
import EventsList from './components/EventsList';
import {useEffect, useState, useRef} from "react";

import plottingWorkerURL from "./workers/plottingWorker";
import tensorWorkerURL from "./workers/tensorWorker";
import proposeWorkerURL from "./workers/proposeWorker";

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

import { processEvents } from './utils/processEvents';


// Constants
const smooth = 5.0;
const mergeEverySeconds = 0.5;
const maxGap = 10;
const maxNumEvents = 30;
const paddingSeconds = 1;
const minSeconds = paddingSeconds;
const [resizedW, resizedH] = [80, 80];


function App() {

  const [videoUrl, setVideoUrl] = useState(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [events, setEvents] = useState([]);
  const [cursorPosSeconds, setCursorPosSeconds] = useState(null);
  const [highlightedEvent, setHighlightedEvent] = useState(null);
  const [currentSecond, setCurrentSecond] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Video metadata to be determined
  const totalSeconds = useRef(undefined);
  const oriVideoW = useRef(undefined);
  const oriVideoH = useRef(undefined);
  const oriVideoFps = useRef(undefined);
  const numMergedFrames = useRef(undefined);

  // Store the function to seek to a specific time
  const seekToRef = useRef(null);
  const togglePlayRef = useRef(null);

  // Workers
  const ffmpegRef = useRef(new FFmpeg());   // not sure if this will cause memory leak
  const tensorWorkerRef = useRef(null);
  const plottingWorkerRef = useRef(null);
  const proposeWorkerRef = useRef(null);
  useEffect(() => {
    // ffmpegRef.current = new FFmpeg();
    tensorWorkerRef.current = new Worker(tensorWorkerURL);
    plottingWorkerRef.current = new Worker(plottingWorkerURL);
    proposeWorkerRef.current = new Worker(proposeWorkerURL);
  }, []);

  // Adjustable Parameters
  const amplify = 5.0;
  const power = 2.0;

  // Load FFMpeg
  const loadFfmpeg = async () => {
    const ffmpeg = ffmpegRef.current;

    // Set FFMpeg Output Callback (useful for progress bar and video metadata)
    ffmpeg.on('log', ({message}) => {
      console.log(message);  // Log all FFMpeg messages

      // Get and set video duration in seconds
      const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2}.\d{2})/);
      if (durationMatch && totalSeconds.current === undefined) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseFloat(durationMatch[3]);
        totalSeconds.current = hours * 3600 + minutes * 60 + seconds;
      }

      // Get video dimensions and FPS
      const streamMatch = message.match(/Stream.*Video.* (\d+)x(\d+)[^\n]*(?:, |\s)(\d+(?:\.\d+)?)\s*fps/i);
      if (streamMatch && oriVideoW.current === undefined) {
        oriVideoW.current = parseInt(streamMatch[1]);
        oriVideoH.current = parseInt(streamMatch[2]);
        oriVideoFps.current = parseFloat(streamMatch[3]);
      }

      // Progress Bar
      const progressMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}.\d{2})/);
      if (progressMatch && totalSeconds.current !== undefined) {
        const hours = parseInt(progressMatch[1]);
        const minutes = parseInt(progressMatch[2]);
        const seconds = parseFloat(progressMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        const percent = Math.round(currentTime / totalSeconds.current * 1000) / 10;
        setLoadingProgress(percent);
      }
    });

    // Load FFMpeg Core
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    setFfmpegLoaded(true);
  }

  useEffect(() => {
    loadFfmpeg()
      .then(r => console.log("FFMpeg Loaded"));
  }, []);


  // Convert Video URL to Uint8Array
  //   Input: videoURL
  //   Return: Uint8Array
  const videoURLToU1Array = async (videoURL) => {
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.writeFile('input.mp4', await fetchFile(videoURL));
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', `scale=${resizedW}:${resizedH},format=gray`,
      '-f', 'rawvideo',     // Extract to raw video format
      '-pix_fmt', 'gray',   // Use grayscale pixel format
      'output.raw'
    ]);
    const frameData = await ffmpeg.readFile('output.raw');
    const u1array = new Uint8Array(frameData.buffer);
    return u1array;
  };


  // When videoURL and FFMpeg are ready, process video to (N, H, W, 3) array
  useEffect(() => {
    if (!ffmpegLoaded || !videoUrl) {
      return;
    }
    videoURLToU1Array(videoUrl)
      .then((u1arr) => {
        console.log("Video to U1Array Done", u1arr);
        tensorWorkerRef.current.postMessage({
          type: 'CONVERT_FRAMES',
          data: {
            framesU1Array: u1arr,
            // e.g. merge every 0.3s for a 30fps video means merge every 9 frames
            mergeEvery: Math.ceil(oriVideoFps.current * mergeEverySeconds),
            height: resizedH,
            width: resizedW,
            amp: amplify,
            power: power,
            smooth: smooth,
          }
        });
      });
  }, [ffmpegLoaded, videoUrl]);


  // Behavior after Receiving from Workers
  useEffect(() => {

    // When TensorWorker is Done
    tensorWorkerRef.current.onmessage = (e) => {
      console.log("[Main]: Received from TensorWorker", e.data);
      const {frames, masks, energies } = e.data;
      numMergedFrames.current = e.data.numMergedFrames;

      // Make 3D View Graph
      plottingWorkerRef.current.postMessage({
        type: 'MAKE_3D_VIEW',
        data: {
          frames: frames,
          masks: masks,
          height: resizedH,
          width: resizedW,
        }
      });
      // Make Energy Graph
      plottingWorkerRef.current.postMessage({
        type: 'MAKE_ENERGY_GRAPH',
        data: {
          energies: energies,
          height: resizedH,
          width: resizedW,
        }
      });
      // Make Thumbnails Graph
      plottingWorkerRef.current.postMessage({
        type: 'MAKE_THUMBNAILS_GRAPH',
        data: {
          frames: frames,
          height: resizedH,
          width: resizedW,
          aspectRatio: oriVideoW.current / oriVideoH.current,
        }
      });
      // Propose Events
      proposeWorkerRef.current.postMessage({
        energies: energies,
        totalSeconds: totalSeconds.current,
        minSeconds: minSeconds,
        paddingSeconds: paddingSeconds,
        maxNumEvents: maxNumEvents,
        minEnergy: 0.1,
        maxGap: maxGap,
      });
    };


    // When PlottingWorker is Done
    plottingWorkerRef.current.onmessage = (e) => {
      const { type, data } = e.data;

      if (type === '3D_VIEW_GRAPH_READY') {
        const { graph, graphHeight, graphWidth } = data;
        const canvas = document.getElementById("3d-view-graph-canvas");
        [...document.getElementsByClassName("graph-separator")].forEach(sep => sep.style.width = `${graphWidth}px`);
        canvas.width = graphWidth;
        const ctx = canvas.getContext("2d");

        const imageData = new ImageData(graphWidth, graphHeight);
        for (let i = 0; i < graph.length; i++) {
          const val = graph[i];
          const idx = i * 4;
          imageData.data[idx] = val;     // R
          imageData.data[idx + 1] = val; // G
          imageData.data[idx + 2] = val; // B
          imageData.data[idx + 3] = 255; // A
        }

        ctx.putImageData(imageData, 0, 0);
      }

      else if (type === 'ENERGY_GRAPH_READY') {
        const { graph, graphHeight, graphWidth } = data;
        const canvas = document.getElementById("energy-graph-canvas");
        canvas.width = graphWidth;
        const ctx = canvas.getContext("2d");
        const imageData = new ImageData(graphWidth, graphHeight);
        for (let i = 0; i < graph.length; i++) {
          const val = graph[i];
          const idx = i * 4;
          imageData.data[idx] = val;     // R
          imageData.data[idx + 1] = val; // G
          imageData.data[idx + 2] = val; // B
          imageData.data[idx + 3] = 255; // A
        }
        ctx.putImageData(imageData, 0, 0);
      }

      else if (type === 'THUMBNAILS_GRAPH_READY') {
        const { graph, graphHeight, graphWidth } = data;
        const canvas = document.getElementById("thumbnails-graph-canvas");
        canvas.width = graphWidth;
        const ctx = canvas.getContext("2d");
        const imageData = new ImageData(graphWidth, graphHeight);
        for (let i = 0; i < graph.length; i++) {
          const val = graph[i];
          const idx = i * 4;
          imageData.data[idx] = val;     // R
          imageData.data[idx + 1] = val; // G
          imageData.data[idx + 2] = val; // B
          imageData.data[idx + 3] = 255; // A
        }
        ctx.putImageData(imageData, 0, 0);
      }

      else {
        console.error("Unknown PlottingWorker message", e.data);
      }

    };


    // When ProposeWorker is Done
    proposeWorkerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'PROPOSED_EVENTS_READY') {
        console.log("Proposed Events", data);

        const proposedEvents = data.events;
        setEvents(proposedEvents);
        const eventsGraphDiv = document.getElementById("events-graph");
        eventsGraphDiv.style.width = `${numMergedFrames.current + resizedW - 1}px`;

        // Function to update a single event
        const updateEvent = (index, updatedEvent) => {
          setEvents(currentEvents =>
            currentEvents.map((event, i) => i === index ? updatedEvent : event)
          );
        };

        // Start processing events
        processEvents(proposedEvents, ffmpegRef.current, 'input.mp4', updateEvent);
      } else {
        console.error("Unknown ProposeWorker message", e.data);
      }
    };


  }, []);


  useEffect(() => {
    const View3DCanvas = document.getElementById("3d-view-graph-canvas");
    const View3DCtx = View3DCanvas.getContext("2d");
    View3DCtx.fillStyle = "#234";
    View3DCtx.fillRect(0, 0, 1000, 80);
    View3DCtx.fillStyle = "#FFF";
    View3DCtx.font = "20px Arial";
    View3DCtx.fillText(videoUrl ? "Loading 3D View Graph ..." : "3D View Graph (No Video Loaded)", 20, 45);

    const energyCanvas = document.getElementById("energy-graph-canvas");
    const energyCtx = energyCanvas.getContext("2d");
    energyCtx.fillStyle = "#456";
    energyCtx.fillRect(0, 0, 1000, 80);
    energyCtx.fillStyle = "#FFF";
    energyCtx.font = "20px Arial";
    energyCtx.fillText(videoUrl ? "Loading Energy Graph ..." : "Energy Graph (No Video Loaded)", 20, 45);

    const ThumbnailsCanvas = document.getElementById("thumbnails-graph-canvas");
    const ThumbnailsCtx = ThumbnailsCanvas.getContext("2d");
    ThumbnailsCtx.fillStyle = "#345";
    ThumbnailsCtx.fillRect(0, 0, 1000, 80);
    ThumbnailsCtx.fillStyle = "#FFF";
    ThumbnailsCtx.font = "20px Arial";
    ThumbnailsCtx.fillText(videoUrl ? "Loading Thumbnails Graph ..." : "Thumbnails Graph (No Video Loaded)", 20, 45);
  }, [videoUrl]);


  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      console.log("Keydown", e.key);
      if (e.key === ' ') {
        togglePlayRef.current && togglePlayRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  return (
    <div className="h-dvh flex flex-col bg-gray-900 max-w-screen-xl mx-auto select-none">

      {/* Serve as background */}
      <div className="absolute top-0 left-0 w-full h-full bg-gray-900 -z-10"/>

      {/* Upper Parts */}
      <div className="flex-1 flex justify-center flex-row min-h-0 m-4 mb-0 gap-4">
        <EventsList
          events={events}
          seekTo={(sec) => {
            if (seekToRef.current) {
              // 1. Seek to the specified time
              seekToRef.current(sec);
              // 2. Scroll to the current playback position
              setTimeout(() => {
                const indicator = document.getElementById("current-playback-position-indicator-span");
                if (indicator) {
                  indicator.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }, 100);
            }
          }}
        />
        <VideoPlayer
          videoUrl={videoUrl}
          setVideoUrl={setVideoUrl}
          seekToRef={seekToRef}
          togglePlayRef={togglePlayRef}
          setCurrentSecond={setCurrentSecond}
        />
      </div>
      {/* Lower Part */}
      <div className="min-w-[48rem] bg-gray-800 flex flex-row m-4 rounded-xl border-2 border-gray-500 overflow-hidden relative">

        {/* Loading Placeholder */}
        {(loadingProgress < 99.9) && (
          (loadingProgress === 0) ? (
              <div className="absolute top-0 left-0 w-full h-full bg-gray-700 flex justify-center items-center z-20 text-gray-300">
                Upload a Video to Start ↗
              </div>
            ) :
            (
              <div className="absolute top-0 left-0 w-full h-full bg-gray-800 border-2 rounded-lg border-gray-700 flex justify-center items-center z-20 text-gray-300">
                Loading Video: {loadingProgress}%
                <div className="w-40 h-2 bg-gray-500 rounded-lg ml-2">
                  <div className="h-full bg-blue-500 rounded-lg" style={{ width: `${loadingProgress}%` }}/>
                </div>
              </div>
            )
        )
        }

        {/* Left Tags */}
        <div className="w-36 bg-gray-700 text-gray-300 text-md font-bold shadow-md shadow-gray-950 z-10">
          <div className="h-20 flex flex-row border-r-2 border-gray-600"><div className="w-36 overflow-auto flex justify-center items-center">Events</div></div>
          <div className="border border-gray-500"/> {/* Separator */}
          <div className="h-20 flex flex-row border-r-2 border-gray-600"><div className="w-36 overflow-auto flex justify-center items-center">Energies</div></div>
          <div className="border border-gray-500"/> {/* Separator */}
          <div className="h-20 flex flex-row border-r-2 border-gray-600"><div className="w-36 overflow-auto flex justify-center items-center">Thumbnails</div></div>
          <div className="border border-gray-500"/> {/* Separator */}
          <div className="h-20 flex flex-row border-r-2 border-gray-600"><div className="w-36 overflow-auto flex justify-center items-center">3D View</div></div>
        </div>

        {/* Right Graphs (sharing the same scroll bar) */}
        <div className="overflow-x-scroll no-scrollbar cursor-pointer min-w-full">
          <div
            onWheel={(e) => {  // large y-axis scroll likely caused by mouse wheel
              if (Math.abs(e.deltaY) >= 50) {
                e.currentTarget.scrollLeft += (e.deltaY);
              }
            }}
            onMouseMove={(e) => {   // Handle cursor movement in timeline
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              console.log(e.clientX, rect.left, x);
              const totalSec = totalSeconds.current;
              const totalWidth = numMergedFrames.current;
              const currentCursorSec = totalSec * (x - resizedW / 2) / totalWidth;
              setCursorPosSeconds(currentCursorSec);
              // Also seek to the cursor position if left mouse button is pressed
              if (seekToRef.current && e.buttons === 1) {
                if (highlightedEvent === null) {
                  seekToRef.current(currentCursorSec);
                } else {
                  seekToRef.current(highlightedEvent.startTime);
                }
              }
            }}
            onMouseLeave={() => setCursorPosSeconds(null)}
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const totalSec = totalSeconds.current;
              const totalWidth = numMergedFrames.current;
              const currentCursorSec = totalSec * (x - resizedW / 2) / totalWidth;
              setCursorPosSeconds(currentCursorSec);
              if (seekToRef.current) {
                if (highlightedEvent === null) {
                  seekToRef.current(currentCursorSec);
                } else {
                  seekToRef.current(highlightedEvent.startTime);
                }
              }
            }}
          >
            <div className="h-20">
              <div id="events-graph" className="flex flex-row bg-gray-800 h-full relative">
                <>
                  { // 1. Tags of Events
                    events?.map((event, idx) => {
                      const totalSec = totalSeconds.current;
                      const totalWidth = numMergedFrames.current;
                      const middle = Math.round((event.startTime + event.endTime) / 2 / totalSec * totalWidth) + resizedW / 2;
                      const left = middle - 25;
                      return (
                        <div
                          key={idx}
                          className="absolute top-[15px] w-[50px] h-[50px] text-2xl rounded-full border-2 flex justify-center items-center bg-gray-400 cursor-pointer select-none opacity-90 hover:opacity-100 z-10 "
                          style={{ left: `${left}px` }}
                          onMouseOver={() => setHighlightedEvent(event)}
                          onMouseOut={() => setHighlightedEvent(null)}
                          onClick={() => {seekToRef.current && seekToRef.current(event.startTime)}}
                        >
                          {[...event.type][0]}    {/* This is a trick to get the first character that also works for emojis */}
                        </div>
                      );
                    })
                  }
                  { // 2. Period of the Highlighted Event
                    (highlightedEvent !== null) && (() => {
                      const totalSec = totalSeconds.current;
                      const totalWidth = numMergedFrames.current;
                      const left = Math.round(highlightedEvent.startTime / totalSec * totalWidth) + resizedW / 2;
                      const right = Math.round(highlightedEvent.endTime / totalSec * totalWidth) + resizedW / 2;
                      const width = right - left;
                      return (
                        <>
                          <div key="highlighted-in-energy-graph"
                               className="absolute top-[82px] h-[80px] rounded border-2 border-white border-opacity-50 bg-white bg-opacity-20 flex justify-center items-center select-none"
                               style={{ left: `${left}px`, width: `${width}px` }}/>
                          <div key="highlighted-in-3d-view-graph"
                               className="absolute top-[246px] h-[80px] rounded border-2 border-white border-opacity-50 bg-white bg-opacity-20 flex justify-center items-center select-none"
                               style={{ left: `${left - resizedW / 2}px`, width: `${width + resizedW}px` }}/>
                        </>

                      );
                    })()
                  }
                  { // 3. Current Playback Position Indicator
                    (currentSecond !== undefined) && (() => {
                      const totalSec = totalSeconds.current;
                      const totalWidth = numMergedFrames.current;
                      const left = Math.round(currentSecond / totalSec * totalWidth + resizedW / 2);
                      return (
                        <>
                          <div
                            key="currentTime"
                            className="absolute top-[81px] h-[165px] w-[2px] rounded-t bg-yellow-400 opacity-60"
                            style={{ left: `${left}px` }}
                          />
                          <div
                            key="currentTimeFrame"
                            className="absolute top-[246px] h-[80px] w-[80px] rounded border-2 border-yellow-400 opacity-60"
                            style={{ left: `${left - resizedW / 2}px` }}
                          />
                          <div
                            id="current-playback-position-indicator-span-span"
                            className="absolute top-[0px] h-[0px] w-[500px] bg-yellow-400 opacity-60"
                            style={{ left: `${left - 250}px` }}
                          />
                        </>
                      );
                    })()
                  }
                  { // 4. Cursor Position Indicator
                    (cursorPosSeconds !== null) && (highlightedEvent === null) && (() => {
                      const totalSec = totalSeconds.current;
                      const totalWidth = numMergedFrames.current;
                      const left = Math.round(cursorPosSeconds / totalSec * totalWidth + resizedW / 2);
                      return (
                        <>
                          <div
                            key="cursorTime"
                            className="absolute top-[0px] h-[246px] w-[2px] rounded-t bg-white opacity-50"
                            style={{ left: `${left}px` }}
                          />
                          <div
                            key="cursorTimeFrame"
                            className="absolute top-[246px] h-[80px] w-[80px] rounded border-2 border-white opacity-50"
                            style={{ left: `${left - resizedW / 2}px` }}
                          />
                        </>
                      );
                    })()
                  }
                </>
              </div>
            </div>
            <div className="border border-gray-600 graph-separator"/> {/* Separator */}
            <div className="h-20"><canvas id="energy-graph-canvas" width="3600" height="80"></canvas></div>
            <div className="border border-gray-600 graph-separator"/> {/* Separator */}
            <div className="h-20"><canvas id="thumbnails-graph-canvas" width="300" height="80"></canvas></div>
            <div className="border border-gray-600 graph-separator"/> {/* Separator */}
            <div className="h-20"><canvas id="3d-view-graph-canvas" width="3600" height="80"></canvas></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
