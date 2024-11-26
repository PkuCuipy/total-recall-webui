import React, { useRef, useState, useEffect } from 'react';

const VideoPlayer = ({ onTimeUpdate, onSeek }) => {
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const videoRef = useRef(null);

  // 处理文件选择上传
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      console.log(url);
      setVideoUrl(url);
    }
  };

  // 视频控制函数
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // 跳转到指定时间
  const seekTo = (timeInSeconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeInSeconds;
    }
  };

  // 监听视频时间更新
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  // 监听视频加载完成
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setTotalTime(videoRef.current.duration);
      console.log(videoRef.current)
    }
  };

  // 清理函数
  useEffect(() => {
    setVideoUrl("http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");  // FIXME: FOR DEBUG


    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (

    <div className="flex justify-center bg-black rounded-xl overflow-hidden border-2 border-gray-500">
      <div className="aspect-video max-h-full max-w-full flex items-center bg-gray-800 justify-center min-w-[30rem]">

        {!videoUrl ?
          (
            <div className="text-center p-8">
              <p className="text-gray-500 mb-4">Upload Video</p>
              <label className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
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
            <div>
              <video
                ref={videoRef}
                src={videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                controls={true}
              />
            </div>
          )
        }

      </div>
    </div>

  );
};

export default VideoPlayer;