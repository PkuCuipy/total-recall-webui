import './App.css';
import VideoPlayer from './components/VideoPlayer';
import EventsList from './components/EventsList';
import {useEffect, useState} from "react";
import timelineWorkerURL from "./workers/timeline-worker";


function App() {

  // Initialize Web Workers
  useEffect(() => {

    // // 1. Timeline
    // const timelineWorker = new Worker(timelineWorkerURL);
    // timelineWorker.onmessage = function (e) {
    //   console.log(`[Main]: Received ${e.data}`);
    //   timelineWorker.terminate();
    // };
    // timelineWorker.postMessage([123, 1_000_000_000]);

    // // 2. Timeline 0~7
    // for (let i = 0; i < 8; i++) {
    //   const timelineWorker = new Worker(timelineWorkerURL);
    //   timelineWorker.onmessage = function (e) {
    //     console.log(`[Main]: Received ${e.data}`);
    //     timelineWorker.terminate();
    //   };
    //   timelineWorker.postMessage([i, 10_000_000_000]);
    // }

  }, []);


  useEffect(() => {

    const timelineCanvas = document.getElementById("timeline-graph-canvas");
    const timelineCtx = timelineCanvas.getContext("2d");
    timelineCtx.fillStyle = "#456";
    timelineCtx.fillRect(0, 0, 20000, 80);
    timelineCtx.fillStyle = "#FFF";
    timelineCtx.font = "20px Arial";
    timelineCtx.fillText("Timeline Graph", 20, 45);

    const ThumbnailsCanvas = document.getElementById("thumbnails-graph-canvas");
    const ThumbnailsCtx = ThumbnailsCanvas.getContext("2d");
    ThumbnailsCtx.fillStyle = "#345";
    ThumbnailsCtx.fillRect(0, 0, 20000, 80);
    ThumbnailsCtx.fillStyle = "#FFF";
    ThumbnailsCtx.font = "20px Arial";
    ThumbnailsCtx.fillText("Thumbnails Graph", 20, 45);

    const View3DCanvas = document.getElementById("3d-view-graph-canvas");
    const View3DCtx = View3DCanvas.getContext("2d");
    View3DCtx.fillStyle = "#234";
    View3DCtx.fillRect(0, 0, 20000, 80);
    View3DCtx.fillStyle = "#FFF";
    View3DCtx.font = "20px Arial";
    View3DCtx.fillText("3D View Graph", 20, 45);
  }, []);


  /* Support Horizontal Scroll w/o Pressing Shift */
  useEffect(() => {
    let graphsDiv = document.getElementsByClassName("horizontal-scroll");
    if (graphsDiv.length !== 1) {
      alert("There should be only one horizontal-scroll div")
    }
    graphsDiv = graphsDiv[0];
    graphsDiv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY;
      graphsDiv.scrollLeft += delta;
    });
  }, []);


  return (
    <div className="h-dvh flex flex-col bg-gray-900">

      {/* Upper Parts */}
      <div className="flex-1 flex justify-center flex-row min-h-0 m-4 mb-0 gap-4">
        <EventsList/>
        <VideoPlayer/>
      </div>

      {/* Lower Part */}
      <div className="min-w-[48rem] bg-sky-600 flex flex-row m-4 rounded-xl border-2 border-sky-700 overflow-hidden">
        {/* Left Tags */}
        <div>
          <div className="h-20 flex flex-row">
            <div className="w-36 overflow-auto flex justify-center items-center bg-blue-200">
              Events
            </div>
          </div>
          <div className="h-20 flex flex-row">
            <div className="w-36 overflow-auto flex justify-center items-center bg-blue-300">
              Timeline
            </div>
          </div>
          <div className="h-20 flex flex-row">
            <div className="w-36 overflow-auto flex justify-center items-center bg-blue-400">
              Thumbnails
            </div>
          </div>
          <div className="h-20 flex flex-row">
            <div className="w-36 overflow-auto flex justify-center items-center bg-blue-500">
              3D View
            </div>
          </div>
        </div>

        {/* Right Graphs (sharing the same scroll bar) */}
        <div className="flex-1 overflow-x-scroll no-scrollbar horizontal-scroll">
          <div className="h-20">
            Events Graph
          </div>
          <div className="h-20">
            <canvas id="timeline-graph-canvas" width="3600" height="80"></canvas>
          </div>
          <div className="h-20">
            <canvas id="thumbnails-graph-canvas" width="3600" height="80"></canvas>
          </div>
          <div className="h-20">
            <canvas id="3d-view-graph-canvas" width="3600" height="80"></canvas>
          </div>
        </div>


      </div>
    </div>
  );
}

export default App;
