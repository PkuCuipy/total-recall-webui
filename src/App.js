import './App.css';
import VideoPlayer from './components/VideoPlayer';
import EventsList from './components/EventsList';


function App() {

  return (
    <div className="h-screen flex flex-col bg-gray-900">

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
            <div className="w-36 overflow-scroll flex justify-center items-center bg-blue-200">
              Events
            </div>
          </div>
          <div className="h-20 flex flex-row">
            <div className="w-36 overflow-scroll flex justify-center items-center bg-blue-300">
              Timeline
            </div>
          </div>
          <div className="h-20 flex flex-row">
            <div className="w-36 overflow-scroll flex justify-center items-center bg-blue-400">
              Thumbnails
            </div>
          </div>
          <div className="h-20 flex flex-row">
            <div className="w-36 overflow-scroll flex justify-center items-center bg-blue-500">
              3D View
            </div>
          </div>
        </div>

        {/* Right Graphs (sharing the same scroll bar) */}
        <div className="flex-1 overflow-x-scroll">
          <div className="h-20 w-[200rem] bg-indigo-300">
            Events Graph
          </div>
          <div className="h-20 w-[200rem] bg-indigo-400">
            Timeline Graph
          </div>
          <div className="h-20 w-[200rem] bg-indigo-500">
            Thumbnails Graph
          </div>
          <div className="h-20 w-[200rem] bg-indigo-600">
            3D View Graph
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
