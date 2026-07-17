import TrafficLights from '../traffic-lights';
import VideoPlayer from './video-player';
import Options from './options';
import useEditorWindowState from 'hooks/editor/use-editor-window-state';
import Timeline from './timeline';
import {useState} from 'react';

const EditorPreview = () => {
  const {title = 'Editor'} = useEditorWindowState();
  const [isEditorVisible, setIsEditorVisible] = useState(true);

  return (
    <div className="preview-container">
      <div className="preview-hover-container">
        <div className="title-bar-hover-zone">
          <div className="title-bar">
            <div className="title-bar-container">
              <TrafficLights/>
              <div className="title">{title}</div>
            </div>
          </div>
        </div>
        <VideoPlayer/>
      </div>
      {isEditorVisible && <Timeline/>}
      <Options isEditorVisible={isEditorVisible} onToggleEditor={() => setIsEditorVisible(visible => !visible)}/>
      <style jsx>{`
        .preview-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .preview-hover-container {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .title-bar-hover-zone {
          -webkit-app-region: no-drag;
          position: fixed;
          top: 0;
          left: 0;
          width: 260px;
          height: 64px;
          pointer-events: auto;
          z-index: 1000;
        }

        .title-bar {
          width: 100vw;
          height: 40px;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(20px);
          transform: translateY(0);
          opacity: 1;
          transition: background 0.16s ease-out;
          display: flex;
          pointer-events: auto;
        }

        .title-bar-hover-zone:hover .title-bar {
          background: rgba(0, 0, 0, 0.42);
        }

        .title-bar-container {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: center;
          -webkit-app-region: drag;
        }

        .title {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.4rem;
          color: #fff;
          margin-left: -72px;
        }
      `}</style>
    </div>
  );
};

export default EditorPreview;
