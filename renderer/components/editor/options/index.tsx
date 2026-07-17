import LeftOptions from './left';
import RightOptions from './right';

interface OptionsProps {
  isEditorVisible: boolean;
  onToggleEditor: () => void;
}

const Options = ({isEditorVisible, onToggleEditor}: OptionsProps) => {
  return (
    <div className="container">
      <LeftOptions/>
      <button type="button" className="editor-toggle" aria-pressed={isEditorVisible} onClick={onToggleEditor}>
        Editor {isEditorVisible ? 'On' : 'Off'}
      </button>
      <RightOptions/>
      <style jsx>{`
          .container {
            display: flex;
            flex: 1;
            -webkit-app-region: no-drag;
            padding: 0 16px;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: var(--background-color);
            z-index: 99;
            height: 48px;
            max-height: 48px;
            flex-shrink: 0;
          }

          .editor-toggle {
            -webkit-app-region: no-drag;
            background: ${isEditorVisible ? 'rgba(116, 88, 255, 0.35)' : 'rgba(255, 255, 255, 0.1)'};
            border: 1px solid ${isEditorVisible ? 'rgba(154, 135, 255, 0.7)' : 'rgba(255, 255, 255, 0.12)'};
            border-radius: 4px;
            color: #fff;
            font-size: 11px;
            height: 24px;
            padding: 0 9px;
          }

          .editor-toggle:hover,
          .editor-toggle:focus-visible {
            background: rgba(255, 255, 255, 0.2);
            outline: none;
          }
        `}</style>
    </div>
  );
};

export default Options;
