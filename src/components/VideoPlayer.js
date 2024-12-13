import React, { useEffect, useRef } from 'react';

const VideoPlayer = ({ setVideoUrl, videoUrl, seekToRef, togglePlayRef, setCurrentSecond }) => {

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
            <div className="text-lg font-bold text-gray-300 p-2 px-4 bg-gray-700">
              Monitor
            </div>
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
          <video
            className="object-fit h-full w-full"
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            controls={true}
            autoPlay={true}
          />
        )
      }
    </div>
  );
};

export default VideoPlayer;