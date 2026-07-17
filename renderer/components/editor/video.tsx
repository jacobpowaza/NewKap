import {useRef, useEffect} from 'react';
import VideoTimeContainer from './video-time-container';
import VideoMetadataContainer from './video-metadata-container';
import VideoControlsContainer from './video-controls-container';
import useEditorWindowState from 'hooks/editor/use-editor-window-state';
import {ipcRenderer as ipc} from '../../utils/ipc';
import {popupMenu} from '../../utils/menu-actions';
import TimelineContainer from './timeline-container';

const getVideoProps = (propsArray: Array<React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>>) => {
  const handlers = new Map();

  for (const props of propsArray) {
    for (const [key, handler] of Object.entries(props)) {
      if (!handlers.has(key)) {
        handlers.set(key, []);
      }

      handlers.get(key).push(handler);
    }
  }

  // eslint-disable-next-line unicorn/no-array-reduce
  return [...handlers.entries()].reduce((acc, [key, handlerList]) => ({
    ...acc,
    [key]: () => {
      for (const handler of handlerList) {
        handler?.();
      }
    }
  }), {});
};

const Video = () => {
  const videoRef = useRef<HTMLVideoElement>();
  const {filePath} = useEditorWindowState();
  const src = `file://${filePath}`;

  const videoTimeContainer = VideoTimeContainer.useContainer();
  const videoMetadataContainer = VideoMetadataContainer.useContainer();
  const videoControlsContainer = VideoControlsContainer.useContainer();
  const {activeClip} = TimelineContainer.useContainer();
  const videoFilter = `brightness(${1 + (activeClip?.brightness ?? 0)}) contrast(${activeClip?.contrast ?? 1}) saturate(${activeClip?.saturation ?? 1})`;

  useEffect(() => {
    videoTimeContainer.setVideoRef(videoRef.current);
    videoMetadataContainer.setVideoRef(videoRef.current);
    videoControlsContainer.setVideoRef(videoRef.current);
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = activeClip?.freezeDuration === undefined ? (activeClip?.speed ?? 1) : 1;
    }
  }, [activeClip?.freezeDuration, activeClip?.speed]);

  const videoProps = getVideoProps([
    videoTimeContainer.videoProps,
    videoMetadataContainer.videoProps,
    videoControlsContainer.videoProps
  ]);

  const onContextMenu = async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const wasPaused = video.paused;

    if (!wasPaused) {
      await videoControlsContainer.pause();
    }

    await popupMenu([{
      label: 'Snapshot',
      click: () => {
        ipc.callMain('save-snapshot', video.currentTime);
      }
    }]);

    if (!wasPaused) {
      videoControlsContainer.play();
    }
  };

  return (
    <div className="video-frame" onContextMenu={onContextMenu}>
      <video ref={videoRef} preload="auto" src={src} style={{filter: videoFilter}} {...videoProps}/>
      <style jsx>{`
        .video-frame {
          flex: 1;
          min-width: 0;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #000;
        }

        video {
          width: 100%;
          height: 100%;
          max-height: calc(100vh - 180px);
          object-fit: contain;
          object-position: center center;
          display: block;
        }
      `}</style>
    </div>
  );
};

export default Video;
