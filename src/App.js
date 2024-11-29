import './App.css';
import VideoPlayer from './components/VideoPlayer';
import EventsList from './components/EventsList';
import {useEffect, useState, useRef} from "react";

import plottingWorkerURL from "./workers/plottingWorker";
import tensorWorkerURL from "./workers/tensorWorker";
import proposeWorkerURL from "./workers/proposeWorker";

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';


function App() {

  const [videoUrl, setVideoUrl] = useState(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [events, setEvents] = useState([]);
  const [highlightedEvent, setHighlightedEvent] = useState(null);

  const ffmpegRef = useRef(new FFmpeg());
  const tensorWorkerRef = useRef(new Worker(tensorWorkerURL));
  const plottingWorkerRef = useRef(new Worker(plottingWorkerURL));
  const proposeWorkerRef = useRef(new Worker(proposeWorkerURL));

  const totalSeconds = useRef(undefined);
  const videoW = useRef(undefined);
  const videoH = useRef(undefined);
  const videoFps = useRef(undefined);
  const numMergedFrames = useRef(undefined);


  const amplify = 5.0;
  const power = 2.0;
  const smooth = 10.0;

  const maxNumEvents = 10;
  const maxGap = 10;
  const maxSeconds = 20;
  const paddingSeconds = 1;


  const [resizedW, resizedH] = [80, 80];


  // Load FFMpeg
  const loadFfmpeg = async () => {
    const ffmpeg = ffmpegRef.current;

    // Set Video Metadata Callback
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
      if (streamMatch && videoW.current === undefined) {
        videoW.current = parseInt(streamMatch[1]);
        videoH.current = parseInt(streamMatch[2]);
        videoFps.current = parseFloat(streamMatch[3]);
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
    // Extract frames directly to raw format
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', `scale=${resizedW}:${resizedH},format=gray`,
      '-f', 'rawvideo',     // Output raw video format
      '-pix_fmt', 'gray',   // Use grayscale pixel format
      'output.raw'
    ]);
    const frameData = await ffmpeg.readFile('output.raw');
    const u1array = new Uint8Array(frameData.buffer);

    return u1array;
  };


  useEffect(() => {
    if (!ffmpegLoaded || !videoUrl) {
      return;
    }
    // When VideoURL and FFMpeg are ready
    videoURLToU1Array(videoUrl)
      .then((u1arr) => {
        console.log("Video to U1Array Done", u1arr);

        tensorWorkerRef.current.postMessage({
          type: 'CONVERT_FRAMES',
          data: {
            framesU1Array: u1arr,
            mergeEvery: Math.round(videoFps.current / 2),
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
          aspectRatio: videoW.current / videoH.current,
        }
      });
      // Propose Events
      proposeWorkerRef.current.postMessage({
        energies: energies,
        totalSeconds: totalSeconds.current,
        maxGap: maxGap,
        maxSeconds: maxSeconds,
        paddingSeconds: paddingSeconds,
        maxNumEvents: maxNumEvents,
        minEnergy: 0.1,
      });
    };


    // When PlottingWorker is Done
    plottingWorkerRef.current.onmessage = (e) => {
      const { type, data } = e.data;

      if (type === '3D_VIEW_GRAPH_READY') {
        const { graph, height, width } = data;
        const canvas = document.getElementById("3d-view-graph-canvas");
        canvas.width = width;
        const ctx = canvas.getContext("2d");

        const imageData = new ImageData(width, height);
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
        const { graph, height, width } = data;

        const canvas = document.getElementById("energy-graph-canvas");
        canvas.width = width;
        console.log("Energy Graph Width", width);
        const ctx = canvas.getContext("2d");

        const imageData = new ImageData(width, height);
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
        const { graph, height, width } = data;
        const canvas = document.getElementById("thumbnails-graph-canvas");
        canvas.width = width;
        // TODO
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
        setEvents(data.events);
      }
      else {
        console.error("Unknown ProposeWorker message", e.data);
      }
    };


  }, []);


  useEffect(() => {
    const View3DCanvas = document.getElementById("3d-view-graph-canvas");
    const View3DCtx = View3DCanvas.getContext("2d");
    View3DCtx.fillStyle = "#234";
    View3DCtx.fillRect(0, 0, 3200, 80);
    View3DCtx.fillStyle = "#FFF";
    View3DCtx.font = "20px Arial";
    View3DCtx.fillText(videoUrl ? "Loading 3D View Graph ..." : "3D View Graph (No Video Loaded)", 20, 45);

    const energyCanvas = document.getElementById("energy-graph-canvas");
    const energyCtx = energyCanvas.getContext("2d");
    energyCtx.fillStyle = "#456";
    energyCtx.fillRect(0, 0, 3000, 80);
    energyCtx.fillStyle = "#FFF";
    energyCtx.font = "20px Arial";
    energyCtx.fillText(videoUrl ? "Loading Energy Graph ..." : "Energy Graph (No Video Loaded)", 20, 45);

    const ThumbnailsCanvas = document.getElementById("thumbnails-graph-canvas");
    const ThumbnailsCtx = ThumbnailsCanvas.getContext("2d");
    ThumbnailsCtx.fillStyle = "#345";
    ThumbnailsCtx.fillRect(0, 0, 3100, 80);
    ThumbnailsCtx.fillStyle = "#FFF";
    ThumbnailsCtx.font = "20px Arial";
    ThumbnailsCtx.fillText(videoUrl ? "Loading Thumbnails Graph ..." : "Thumbnails Graph (No Video Loaded)", 20, 45);
  }, [videoUrl]);


  /* Support Mouse Horizontal Scroll w/o Pressing Shift */
  useEffect(() => {
    let graphsDiv = document.getElementsByClassName("horizontal-scroll");
    if (graphsDiv.length !== 1) {
      alert("There should be only one horizontal-scroll div")
    }
    graphsDiv = graphsDiv[0];
    graphsDiv.addEventListener("wheel", (e) => {
      const delta = e.deltaY;
      if (Math.abs(delta) >= 50) {    // a workaround to detect mouse or trackpad
        graphsDiv.scrollLeft += delta;
      }
    });
  }, []);


  return (
    <div className="h-dvh flex flex-col bg-gray-900">
      {/* Upper Parts */}
      <div className="flex-1 flex justify-center flex-row min-h-0 m-4 mb-0 gap-4">
        <EventsList/>
        <VideoPlayer videoUrl={videoUrl} setVideoUrl={setVideoUrl}/>
      </div>
      {/* Lower Part */}
      <div className="min-w-[48rem] bg-sky-600 flex flex-row m-4 rounded-xl border-2 border-gray-900 overflow-hidden">
        {/* Left Tags */}
        <div>
          <div className="h-20 flex flex-row"><div className="w-36 overflow-auto flex justify-center items-center bg-blue-200">Events</div></div>
          <div className="h-20 flex flex-row"><div className="w-36 overflow-auto flex justify-center items-center bg-blue-300">Energies</div></div>
          <div className="h-20 flex flex-row"><div className="w-36 overflow-auto flex justify-center items-center bg-blue-400">Thumbnails</div></div>
          <div className="h-20 flex flex-row"><div className="w-36 overflow-auto flex justify-center items-center bg-blue-500">3D View</div></div>
        </div>
        {/* Right Graphs (sharing the same scroll bar) */}
        <div className="flex-1 overflow-x-scroll no-scrollbar horizontal-scroll">
          <div className="h-20">
            <div id="events-graph" className="flex flex-row bg-gray-600 w-[300px] h-full relative">
              <>
              { // Event indicators
                events?.map((event, idx) => {
                  const totalSec = totalSeconds.current;
                  const totalWidth = numMergedFrames.current;
                  const middle = Math.round((event.startTime + event.endTime) / 2 / totalSec * totalWidth) + resizedW / 2;
                  const left = middle - 25;
                  return (
                    <div key={idx}
                      className="absolute top-[15px] w-[50px] h-[50px] rounded-full border-2 flex justify-center items-center bg-red-400 cursor-pointer opacity-90 hover:opacity-100 hover:z-10"
                      style={{ left: `${left}px` }}
                      onClick={() => highlightedEvent === event ? setHighlightedEvent(null) : setHighlightedEvent(event)}
                    >E{idx}</div>
                  );
                })
              }
              { // Highlighted Event as a frame on the next row
                highlightedEvent && (() => {
                  const totalSec = totalSeconds.current;
                  const totalWidth = numMergedFrames.current;
                  const left = Math.round(highlightedEvent.startTime / totalSec * totalWidth) + resizedW / 2;
                  const right = Math.round(highlightedEvent.endTime / totalSec * totalWidth) + resizedW / 2;
                  const width = right - left;
                  return (
                    <div key="highlighted"
                        className="absolute top-[0px] h-[80px] rounded border flex justify-center items-center bg-white cursor-pointer opacity-50"
                        style={{ left: `${left}px`, width: `${width}px` }}
                      >{highlightedEvent ? `E${events.indexOf(highlightedEvent)}` : ""}
                    </div>
                  );
                })()
              }
              </>
            </div>
          </div>
          <div className="h-20"><canvas id="energy-graph-canvas" width="3600" height="80"></canvas></div>
          <div className="h-20"><canvas id="thumbnails-graph-canvas" width="3600" height="80"></canvas></div>
          <div className="h-20"><canvas id="3d-view-graph-canvas" width="3600" height="80"></canvas></div>
        </div>
      </div>
    </div>
  );
}

export default App;
