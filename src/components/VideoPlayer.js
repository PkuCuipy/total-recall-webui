import React, { useEffect, useRef } from 'react';
import { GithubIcon, HelpIcon } from "./Icons";

const VideoPlayer = ({ setVideoUrl, videoUrl, seekToRef, togglePlayRef, setCurrentSecond, onReAnalyze }) => {

  const videoRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
    }
  };

  seekToRef.current = (timeInSeconds) => {
    if (videoRef.current && !isNaN(timeInSeconds)) {
      videoRef.current.currentTime = timeInSeconds;
    }
  };

  togglePlayRef.current = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentSecond(time);
    }
  };

  // 清理函数
  useEffect(() => {
    // setVideoUrl("http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");  // FIXME: FOR DEBUG
    // setVideoUrl("https://raw.githubusercontent.com/ffmpegwasm/testdata/master/Big_Buck_Bunny_180_10s.webm");  // FIXME: FOR DEBUG

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [setVideoUrl, videoUrl]);

  return (
    <div className="flex flex-1 justify-center bg-black rounded-xl overflow-hidden border-2 border-gray-500">
      {!videoUrl ?
        (
          <div className="flex flex-col w-full h-full">
            <div className="flex items-center text-lg font-bold text-gray-300 p-2 px-4 bg-gray-700">
              <span>Monitor</span>

              {/* Spacer */}
              <span className="flex-1"/>

              {/* OpenAI API Key Input Field */}
              <span className="bg-gray-800 h-8 text-white text-sm px-3 pr-1.5 py-1 rounded-full flex items-center">
                OpenAI API Key:
                <input
                  type="text"
                  className="bg-gray-600 text-gray-300 px-2 py-0 rounded-full ml-2 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste here"
                  defaultValue={ localStorage.getItem('openai-api-key') }
                  onChange={(e) => { localStorage.setItem('openai-api-key', e.target.value); }}
                />
              </span>

              {/* Link to Frontend GitHub Repo */}
              <span className="text-2xl cursor-pointer ml-3 p-[5px] bg-gray-800 rounded-full hover:bg-gray-900 hover:ring-2 hover:ring-gray-500"
                onClick={() => {window.open('https://github.com/PkuCuipy/total-recall-webui', '_blank');}}>
                <GithubIcon/>
              </span>

              {/* Link to Backend GitHub Repo */}
              <span className="text-2xl cursor-pointer ml-3 p-[5px] bg-gray-800 rounded-full hover:bg-gray-900 hover:ring-2 hover:ring-gray-500 flex items-center"
                onClick={() => {window.open('https://github.com/roast-my-resume/TotalRecall', '_blank');}}>
                <span className="text-sm mx-1">Backend</span>
                <HelpIcon/>
              </span>
            </div>

            {/* Video Uploader */}
            <div className="text-center p-8 w-full h-full bg-gray-800 flex flex-col justify-center items-center">
              <p className="text-gray-300 mb-4">Upload Video</p>
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600 w-32">
              Choose File
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>
        ) :
        (
          <div className="w-full h-full flex flex-col">
            <div className="flex flex-wrap gap-2 text-lg font-bold text-gray-300 p-2 px-4 bg-gray-900 border-b-2 border-gray-700 border-opacity-30">
              {/* New Video by Refreshing Page */}
              <button
                className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full cursor-pointer hover:bg-blue-600"
                onClick={() => {
                  if (window.confirm("Are you sure to start over with a new video?")) {
                    window.location.reload();
                  }
                }}
              >
                ↺ New Video
              </button>

              {/* OpenAI API Key Input Field */}
              <span className="bg-emerald-600 text-white text-sm pl-3 pr-1 py-1 rounded-full flex items-center">
                OpenAI API Key:
                <input
                  type="text"
                  className="bg-emerald-900 text-gray-300 px-1 py-0.5 rounded ml-1 mr-2 w-28"
                  placeholder="Paste here"
                  defaultValue={localStorage.getItem('openai-api-key')}
                  onChange={(e) => {
                    const key = e.target.value;
                    localStorage.setItem('openai-api-key', key);
                  }}
                />
              </span>

              {/* Re-Analyze Button */}
              <button
                className="bg-orange-700 text-white text-sm px-3 py-1 rounded-full cursor-pointer hover:bg-orange-800"
                onClick={onReAnalyze}
              >
                🔍 Re-Analyze
              </button>

              {/* Spacer */}
              <span className="flex-1"/>

              {/* Link to Frontend GitHub Repo */}
              <span className="text-2xl cursor-pointer p-[5px] bg-gray-800 rounded-full hover:bg-gray-900 ring-2 ring-gray-500 hover:ring-gray-400"
                onClick={() => {window.open('https://github.com/PkuCuipy/total-recall-webui', '_blank');}}>
                <GithubIcon/>
              </span>

              {/* Link to Backend GitHub Repo */}
              <span className="flex items-center text-2xl cursor-pointer p-[5px] bg-gray-800 rounded-full hover:bg-gray-900 ring-2 ring-gray-500 hover:ring-gray-400"
                onClick={() => {window.open('https://github.com/roast-my-resume/TotalRecall', '_blank');}}>
                <span className="text-sm mx-1">Backend</span>
                <HelpIcon/>
              </span>
            </div>

            {/* Video Player */}
            <video
              className="object-fit flex-1 min-h-0 w-full"
              ref={videoRef}
              src={videoUrl}
              onTimeUpdate={handleTimeUpdate}
              controls={true}
              autoPlay={true}
            />
          </div>
        )
      }
    </div>
  );
};

export default VideoPlayer;