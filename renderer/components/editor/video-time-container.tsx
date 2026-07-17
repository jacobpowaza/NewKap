import {createContainer} from 'unstated-next';
import {useRef, useState, useEffect} from 'react';

const useVideoTime = () => {
  const videoRef = useRef<HTMLVideoElement>();

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const setVideoRef = (video: HTMLVideoElement) => {
    videoRef.current = video;
  };

  const videoProps = {
    onLoadedMetadata: () => {
      if (duration === 0) {
        setDuration(videoRef.current?.duration);
        setEndTime(videoRef.current?.duration);
      }
    },
    onEnded: () => {
      setCurrentTime(endTime);
    }
  };

  const updateTime = (time: number, ignoreElement = false) => {
    const boundedTime = Math.max(startTime, Math.min(endTime || time, time));

    if (!ignoreElement && videoRef.current) {
      videoRef.current.currentTime = boundedTime;
    }

    setCurrentTime(boundedTime);
  };

  const updateStartTime = (time: number) => {
    if (time < endTime) {
      videoRef.current.currentTime = time;
      setStartTime(time);
      setCurrentTime(time);
    }
  };

  const updateEndTime = (time: number) => {
    if (time > startTime) {
      videoRef.current.currentTime = time;
      setEndTime(time);
      setCurrentTime(time);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let animationFrame = 0;

    const syncTime = () => {
      updateTime(video.currentTime ?? 0, true);
    };

    const stopSyncing = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    };

    const syncWhilePlaying = () => {
      syncTime();

      if (!video.paused && !video.ended) {
        animationFrame = requestAnimationFrame(syncWhilePlaying);
      }
    };

    const startSyncing = () => {
      stopSyncing();
      syncWhilePlaying();
    };

    video.addEventListener('play', startSyncing);
    video.addEventListener('pause', syncTime);
    video.addEventListener('ended', syncTime);
    video.addEventListener('seeked', syncTime);
    video.addEventListener('timeupdate', syncTime);

    return () => {
      stopSyncing();
      video.removeEventListener('play', startSyncing);
      video.removeEventListener('pause', syncTime);
      video.removeEventListener('ended', syncTime);
      video.removeEventListener('seeked', syncTime);
      video.removeEventListener('timeupdate', syncTime);
    };
  }, [startTime, endTime]);

  return {
    startTime,
    endTime,
    duration,
    currentTime,
    updateTime,
    updateStartTime,
    updateEndTime,
    setVideoRef,
    videoProps
  };
};

const VideoTimeContainer = createContainer(useVideoTime);

export default VideoTimeContainer;
