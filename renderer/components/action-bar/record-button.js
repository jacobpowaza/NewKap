import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {connect, CropperContainer} from '../../containers';
import {handleKeyboardActivation} from '../../utils/inputs';
import kap from '../../utils/kap';

const getMediaNode = async deviceId => new Promise((resolve, reject) => {
  navigator.getUserMedia({
    audio: {deviceId}
  }, stream => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    resolve({javascriptNode, analyser});
  }, reject);
});

const RecordButton = ({
  cropperExists,
  recordAudio,
  audioInputDeviceId,
  startCountdown,
  cropperX,
  cropperY,
  cropperWidth,
  cropperHeight
}) => {
  const [showFirstRipple, setShowFirstRipple] = useState(false);
  const [showSecondRipple, setShowSecondRipple] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const [mode, setMode] = useState('record');

  useEffect(() => {
    let node;

    const connectToDevice = async () => {
      try {
        const {javascriptNode, analyser} = await getMediaNode(audioInputDeviceId);

        javascriptNode.onaudioprocess = () => {
          const array = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(array);
          let total = 0;
          for (const value of array) {
            total += value;
          }

          const avg = total / array.length;
          if (avg >= 36) {
            setShowFirstRipple(true);
            setShowSecondRipple(true);
            setShouldStop(false);
          } else {
            setShouldStop(true);
          }
        };

        node = javascriptNode;
      } catch (error) {
        console.error('An error occurred when trying to get audio levels:', error);
      }
    };

    if (recordAudio && audioInputDeviceId) {
      connectToDevice();
    }

    return () => {
      if (node && typeof node.disconnect === 'function') {
        node.disconnect();
      }
    };
  }, [recordAudio, audioInputDeviceId]);

  const shouldFirstStop = () => {
    if (shouldStop) {
      setShowFirstRipple(false);
    }
  };

  const shouldSecondStop = () => {
    if (shouldStop) {
      setShowSecondRipple(false);
    }
  };

  const handlePrimaryAction = event => {
    event.stopPropagation();

    if (!cropperExists) {
      return;
    }

    if (mode === 'screenshot') {
      kap.cropper.captureScreenshot({x: cropperX, y: cropperY, width: cropperWidth, height: cropperHeight});
    } else {
      startCountdown();
    }
  };

  const toggleMode = event => {
    event.stopPropagation();
    setMode(currentMode => currentMode === 'record' ? 'screenshot' : 'record');
  };

  const CameraIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.2 6 9.6 4h4.8l1.4 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.2Zm3.8 10.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0-1.8a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z"/>
    </svg>
  );

  return (
    <div
      className={classNames('container', {'cropper-exists': cropperExists})}
      tabIndex={cropperExists ? 0 : -1}
      onKeyDown={handleKeyboardActivation(handlePrimaryAction)}
    >
      <div className={classNames('outer', {camera: mode === 'screenshot'})} title={mode === 'screenshot' ? 'Take screenshot' : 'Start recording'} onMouseDown={handlePrimaryAction}>
        <div className="inner">
          {mode === 'screenshot' ? <CameraIcon/> : (!cropperExists && <div className="fill"/>)}
        </div>
        {showFirstRipple && <div className="ripple first" onAnimationIteration={shouldFirstStop}/>}
        {showSecondRipple && <div className="ripple second" onAnimationIteration={shouldSecondStop}/>}
      </div>
      <button type="button" className={classNames('mode-toggle', {record: mode === 'screenshot'})} title={mode === 'record' ? 'Switch to screenshot' : 'Switch to recording'} onMouseDown={toggleMode}>
        {mode === 'record' ? <CameraIcon/> : <span/>}
      </button>
      <style jsx>{`
            .container {
              width: 112px;
              height: 64px;
              display: flex;
              align-items: center;
              justify-content: center;
              outline: none;
              gap: 6px;
            }

            .outer {
              width: 44px;
              height: 44px;
              padding: 6px;
              border-radius: 50%;
              background: var(--record-button-background);
              border: 2px solid var(--record-button-border-color);
              display: flex;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
              flex-shrink: 0;
              position: relative;
            }

            .inner {
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: var(--record-button-inner-background${cropperExists ? '-cropper' : ''});
              ${cropperExists ? '' : 'border: var(--record-button-inner-border-width) solid var(--record-button-inner-border);'}
              box-sizing: border-box;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .camera {
              background: #4a4a4a;
              border-color: #666;
            }

            .camera .inner {
              background: transparent;
            }

            .inner :global(svg) {
              fill: #fff;
              height: 24px;
              width: 24px;
            }

            .mode-toggle {
              position: relative;
              right: auto;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              border: 1px solid rgba(127, 127, 127, 0.35);
              background: var(--action-bar-background);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 5px;
              outline: none;
              flex-shrink: 0;
            }

            .mode-toggle :global(svg) {
              width: 16px;
              height: 16px;
              fill: var(--icon-color, #666);
            }

            .mode-toggle span {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              background: #ff4d45;
            }

            .fill {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: var(--record-button-fill-background);
              margin: 2px;
            }

            .ripple {
              box-sizing: border-box;
              border-radius: 50%;
              border: 1px solid var(--record-button-ripple-color);
              background: transparent;
              position: absolute;
              width: 100%;
              height: 100%;
            }

            .first {
              animation: ripple 1.8s linear infinite;
            }

            .second {
              animation: ripple 1.8s linear 0.9s infinite;
            }

            .container.cropper-exists:focus .outer {
              border: 2px solid var(--record-button-focus-outter-border);
              background: var(--record-button-focus-outter-background);
            }

            .container.cropper-exists:focus .inner {
              border-color: var(--record-button-border-color);
              background: var(--record-button-focus-background${cropperExists ? '-cropper' : ''});
            }

            .container.cropper-exists:focus .fill {
              background: var(--record-button-fill-background);
            }

            @keyframes ripple {
              0% {
                transform: scale(1);
              }

              100% {
                transform: scale(1.3);
                opacity: 0;
              }
            }
        `}</style>
    </div>
  );
};

RecordButton.propTypes = {
  cropperExists: PropTypes.bool,
  recordAudio: PropTypes.bool,
  audioInputDeviceId: PropTypes.string,
  startCountdown: PropTypes.func,
  cropperX: PropTypes.number,
  cropperY: PropTypes.number,
  cropperWidth: PropTypes.number,
  cropperHeight: PropTypes.number
};

export default connect(
  [CropperContainer],
  ({recordAudio, audioInputDeviceId, x, y, width, height}) => ({recordAudio, audioInputDeviceId, cropperX: x, cropperY: y, cropperWidth: width, cropperHeight: height}),
  ({startCountdown}) => ({startCountdown})
)(RecordButton);
