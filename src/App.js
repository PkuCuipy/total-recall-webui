import './App.css';
import VideoPlayer from './components/VideoPlayer';
import EventsList from './components/EventsList';
import {useEffect, useState, useRef} from "react";
import timelineWorkerURL from "./workers/timelineWorker";
import tensorWorkerURL from "./workers/tensorWorker";

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';


function App() {

  const [videoUrl, setVideoUrl] = useState(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const ffmpegRef = useRef(new FFmpeg());
  const framesU1ArrRef = useRef(null);

  const tensorWorkerRef = useRef(new Worker(tensorWorkerURL));
  const timelineWorkerRef = useRef(new Worker(timelineWorkerURL));

  const [resizedW, resizedH] = [80, 80];    // fixme: debug
  const frameSize = resizedH * resizedW;

  // Load FFMpeg
  const loadFfmpeg = async () => {
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on('log', ({message}) => {
      console.log(message);  // Log all FFMpeg messages
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


  const videoToU1Array = async (videoURL) => {
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.writeFile('input.mp4', await fetchFile(videoURL));
    await ffmpeg.exec([     // Extract frames directly to raw format
      '-i', 'input.mp4',
      '-vf', `scale=${resizedW}:${resizedH},format=gray`,
      '-f', 'rawvideo',     // Output raw video format
      '-pix_fmt', 'gray',   // Use grayscale pixel format
      'output.raw'
    ]);
    const data = await ffmpeg.readFile('output.raw');
    const u1array = new Uint8Array(data.buffer);

    framesU1ArrRef.current = u1array;
    return u1array;
  };

  const createCanvasAndDraw = () => {
    const drawOneFrame = (ctx, array, frameNum) => {
      const getFrame = (array, frameNum) => {
        const start = frameNum * frameSize;
        return array.subarray(start, start + frameSize);
      };
      const frameData = getFrame(array, frameNum);
      const imageData = new ImageData(resizedW, resizedH);
      for (let i = 0; i < frameData.length; i++) {
        const val = frameData[i];
        const idx = i * 4;
        imageData.data[idx] = val;     // R <-- Convert grayscale to RGBA
        imageData.data[idx + 1] = val; // G
        imageData.data[idx + 2] = val; // B
        imageData.data[idx + 3] = 255; // A
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const tensor = framesU1ArrRef.current;
    const numFrames = tensor.length / frameSize;

    const newCanvas = document.createElement('canvas');
    newCanvas.width = resizedW;
    newCanvas.height = resizedH;
    const ctx = newCanvas.getContext('2d');
    document.body.appendChild(newCanvas);

    let frameIdx = 0;
    setInterval(() => {
      const frameNum = (frameIdx++) % numFrames;
      drawOneFrame(ctx, tensor, frameNum);
    }, 10);
  }

  useEffect(() => {
    if (!ffmpegLoaded || !videoUrl) {
      return;
    }
    videoToU1Array(videoUrl)
      .then((array) => {
        console.log("Video to Uint8Array Done", array);

        createCanvasAndDraw(array);

        tensorWorkerRef.current.postMessage({
          type: 'CONVERT_FRAMES',
          data: {
            framesU1Array: array,
            mergeEvery: 4,
            height: resizedH,
            width: resizedW,
            amp: 3.0,
            power: 2,
          }
        });
      });


  }, [ffmpegLoaded, videoUrl]);


  // Web Workers
  useEffect(() => {

    // TensorWorker
    tensorWorkerRef.current.onmessage = (e) => {
      console.log("[Main]: Received from TensorWorker", e.data);

      timelineWorkerRef.current.postMessage({
        type: 'MAKE_TIMELINE',
        data: {
          frames: e.data.frames,
          masks: e.data.masks,
          height: resizedH,
          width: resizedW,
        }
      });
    };

    // TimelineWorker
    timelineWorkerRef.current.onmessage = (e) => {
      console.log("[Main]: Received from TimelineWorker", e.data);

      const {timeline, height, width} = e.data.data;

      const canvas = document.getElementById("3d-view-graph-canvas");
      canvas.width = width;
      const ctx = canvas.getContext("2d");

      const imageData = new ImageData(width, height);
      for (let i = 0; i < timeline.length; i++) {
        const val = timeline[i];
        const idx = i * 4;
        imageData.data[idx] = val;     // R <-- Convert grayscale to RGBA
        imageData.data[idx + 1] = val; // G
        imageData.data[idx + 2] = val; // B
        imageData.data[idx + 3] = 255; // A
      }

      ctx.putImageData(imageData, 0, 0);
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

    const timelineCanvas = document.getElementById("timeline-graph-canvas");
    const timelineCtx = timelineCanvas.getContext("2d");
    timelineCtx.fillStyle = "#456";
    timelineCtx.fillRect(0, 0, 3000, 80);
    timelineCtx.fillStyle = "#FFF";
    timelineCtx.font = "20px Arial";
    timelineCtx.fillText(videoUrl ? "Loading Timeline Graph ..." : "Timeline Graph (No Video Loaded)", 20, 45);

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
          <div className="h-20 flex flex-row"><div className="w-36 overflow-auto flex justify-center items-center bg-blue-300">Timeline</div></div>
          <div className="h-20 flex flex-row"><div className="w-36 overflow-auto flex justify-center items-center bg-blue-400">Thumbnails</div></div>
          <div className="h-20 flex flex-row"><div className="w-36 overflow-auto flex justify-center items-center bg-blue-500">3D View</div></div>
        </div>
        {/* Right Graphs (sharing the same scroll bar) */}
        <div className="flex-1 overflow-x-scroll no-scrollbar horizontal-scroll">
          <div className="h-20">Events Graph</div>
          <div className="h-20"><canvas id="timeline-graph-canvas" width="3600" height="80"></canvas></div>
          <div className="h-20"><canvas id="thumbnails-graph-canvas" width="3600" height="80"></canvas></div>
          <div className="h-20"><canvas id="3d-view-graph-canvas" width="3600" height="80"></canvas></div>
        </div>
      </div>
    </div>
  );
}

export default App;
