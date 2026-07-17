// Import EditorPreview from '../components/editor/editor-preview';
import combineUnstatedContainers from '../utils/combine-unstated-containers';
import VideoMetadataContainer from '../components/editor/video-metadata-container';
import VideoTimeContainer from '../components/editor/video-time-container';
import VideoControlsContainer from '../components/editor/video-controls-container';
import OptionsContainer from '../components/editor/options-container';
import useEditorWindowState from 'hooks/editor/use-editor-window-state';
import {ConversionIdContextProvider} from 'hooks/editor/use-conversion-id';
import Editor from 'components/editor';
import TimelineContainer from '../components/editor/timeline-container';

const ContainerProvider = combineUnstatedContainers([
  TimelineContainer,
  OptionsContainer,
  VideoMetadataContainer,
  VideoTimeContainer,
  VideoControlsContainer
]) as any;

const EditorPage = () => {
  const args = useEditorWindowState();

  if (!args) {
    return null;
  }

  return (
    <div className="cover-window">
      <ConversionIdContextProvider>
        <ContainerProvider>
          <Editor/>
        </ContainerProvider>
      </ConversionIdContextProvider>
      <style jsx global>{`
        :root {
          --slider-popup-background: rgba(255, 255, 255, 0.85);
          --slider-background-color: #ffffff;
          --slider-thumb-color: #ffffff;
          --background-color: #222222;
        }

        .dark {
          --slider-popup-background: #222222;
          --slider-background-color: var(--input-background-color);
          --slider-thumb-color: var(--storm);
        }

        .video-player-container:hover .video-controls {
          bottom: 0;
        }

        .video-player-container:not(:hover) .progress-bar-container {
          bottom: 64px;
          width: 100%
        }

        .video-player-container:not(:hover) .progress-bar-container .progress-bar {
          border-radius: 0;
        }

        .video-player-container:not(:hover) .progress-bar-container .slider {
          display: none;
        }

        .cover-window {
          -webkit-app-region: drag;
          user-select: none;
          background-color: #222222;
        }

        .tooltip {
          padding: 0 !important;
          max-width: 300px;
        }

        .tooltip-content {
          padding: 8px 21px;
        }

        .hide-tooltip .tooltip {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default EditorPage;
