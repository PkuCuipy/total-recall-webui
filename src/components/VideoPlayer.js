import React, { useRef, useState, useEffect } from 'react';

const VideoPlayer = ({ setVideoUrl, videoUrl, setSeekTo, setCurrentSecond }) => {

  const videoRef = useRef(null);

  console.warn("VideoPlayer is rendered");

  // 处理文件选择上传
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      console.log(url);
      setVideoUrl(url);
    }
  };

  // 跳转到指定时间
  const seekTo = (timeInSeconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeInSeconds;
    }
  };
  setSeekTo(seekTo);

  // 监听视频时间更新
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
        console.warn("Revoke URL:", videoUrl);
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [setVideoUrl, videoUrl]);

  return (
    <div className="flex flex-1 justify-center bg-black rounded-xl overflow-hidden border-2 border-gray-500">
      {!videoUrl ?
        (
          <div className="text-center p-8 w-full h-full bg-gray-800 flex flex-col justify-center items-center">
            <p className="text-gray-500 mb-4">Upload Video</p>
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
        ) :
        (
          <video
            className="object-fit h-full w-full"
            ref={videoRef}
            src={videoUrl}
            onTimeUpdate={handleTimeUpdate}
            controls={true}
          />
        )
      }
    </div>
  );
};

export default VideoPlayer;