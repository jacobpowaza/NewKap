import React, {useCallback, useEffect, useRef, useState} from 'react';
import TrafficLights from '../components/traffic-lights';
import Select from '../components/editor/options/select';
import useWindowState from '../hooks/window-state';
import {useShowWindow} from '../hooks/use-show-window';
import ipc from '../utils/ipc';
import {getCanvasPointFromClientPoint} from '../../main/common/screenshot-canvas';

interface ScreenshotState {
  filePath: string;
}

type Tool = 'move' | 'draw' | 'crop';
type ImageFormat = 'png' | 'jpeg' | 'webp';
type Point = {x: number; y: number};
type Crop = {x: number; y: number; width: number; height: number};
type Stroke = {color: string; width: number; points: Point[]};
type CropHistoryEntry = {crop?: Crop; offset: Point};
type EditSnapshot = {crop?: Crop; cropHistory: CropHistoryEntry[]; strokes: Stroke[]};
type ExportNotice = ({
  action: 'copy';
} | {
  action: 'save';
  filePath: string;
}) & {
  message: string;
  thumbnail: string;
  title: string;
};
type ScreenshotExport = {
  dataUrl: string;
  format: ImageFormat;
};
type ScreenshotSaveResult = {
  filePath?: string;
};

const formatOptions: Array<{label: string; value: ImageFormat}> = [
  {label: 'PNG', value: 'png'},
  {label: 'JPEG', value: 'jpeg'},
  {label: 'WebP', value: 'webp'}
];

const colors = ['#ffffff', '#ff5f57', '#ffbd2e', '#28c840', '#5aa9ff', '#ad7cff'];

const getFileName = (filePath: string) => filePath.split('/').pop() ?? filePath;

const ToolButton = ({active, children, title, onClick}: {active?: boolean; children: React.ReactNode; title: string; onClick: () => void}) => (
  <button type="button" className={active ? 'tool active' : 'tool'} title={title} onClick={onClick}>
    {children}
    <style jsx>{`
      .tool {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.72);
        display: inline-flex;
        font-size: 11px;
        height: 26px;
        justify-content: center;
        padding: 0 9px;
        -webkit-app-region: no-drag;
      }

      .tool:hover,
      .tool:focus-visible {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        outline: none;
      }

      .tool.active {
        background: rgba(116, 88, 255, 0.35);
        box-shadow: inset 0 0 0 1px rgba(154, 135, 255, 0.62);
        color: #fff;
      }
    `}</style>
  </button>
);

const Range = ({label, min, max, step = 1, value, onChange}: {label: string; min: number; max: number; step?: number; value: number; onChange: (value: number) => void}) => (
  <label className="range">
    <span>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/>
    <output>{value}</output>
    <style jsx>{`
      .range {
        align-items: center;
        color: rgba(255, 255, 255, 0.58);
        display: flex;
        font-size: 10px;
        gap: 6px;
        -webkit-app-region: no-drag;
      }

      span {
        width: 44px;
      }

      input {
        appearance: none;
        background: rgba(255, 255, 255, 0.16);
        border-radius: 2px;
        height: 3px;
        outline: none;
        width: 58px;
      }

      input::-webkit-slider-thumb {
        appearance: none;
        background: #fff;
        border: 0;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
        height: 11px;
        width: 11px;
      }

      output {
        color: rgba(255, 255, 255, 0.82);
        font-variant-numeric: tabular-nums;
        text-align: right;
        width: 22px;
      }
    `}</style>
  </label>
);

const ScreenshotPreview = () => {
  const state = useWindowState<ScreenshotState>();
  useShowWindow(true);

  const canvasRef = useRef<HTMLCanvasElement>();
  const imageRef = useRef<HTMLImageElement>();
  const cropStartRef = useRef<Point>();
  const draftCropRef = useRef<Crop>();
  const historyRef = useRef<EditSnapshot[]>([]);
  const drawingRef = useRef(false);
  const [imageSize, setImageSize] = useState({width: 0, height: 0});
  const [tool, setTool] = useState<Tool>('move');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [committedCrop, setCommittedCrop] = useState<Crop>();
  const [draftCrop, setDraftCrop] = useState<Crop>();
  const [cropHistory, setCropHistory] = useState<CropHistoryEntry[]>([]);
  const [historyDepth, setHistoryDepth] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [strokeColor, setStrokeColor] = useState(colors[1]);
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [format, setFormat] = useState<ImageFormat>('png');
  const [exportAction, setExportAction] = useState<'save' | 'copy'>('save');
  const [exportNotice, setExportNotice] = useState<ExportNotice>();

  const pushHistory = useCallback(() => {
    historyRef.current.push({
      crop: committedCrop ? {...committedCrop} : undefined,
      cropHistory: cropHistory.map(entry => ({crop: entry.crop ? {...entry.crop} : undefined, offset: {...entry.offset}})),
      strokes: strokes.map(stroke => ({...stroke, points: stroke.points.map(point => ({...point}))}))
    });
    setHistoryDepth(historyRef.current.length);
  }, [committedCrop, cropHistory, strokes]);

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) {
      return;
    }

    setCommittedCrop(previous.crop);
    setCropHistory(previous.cropHistory);
    setStrokes(previous.strokes);
    setDraftCrop(undefined);
    draftCropRef.current = undefined;
    setHistoryDepth(historyRef.current.length);
  }, []);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !imageSize.width) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    const source = committedCrop ?? {x: 0, y: 0, width: imageSize.width, height: imageSize.height};
    context.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
    context.filter = 'none';
    context.lineCap = 'round';
    context.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.points.length === 0) {
        continue;
      }

      context.beginPath();
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) {
        context.lineTo(point.x, point.y);
      }

      context.stroke();
    }
  }, [brightness, committedCrop, contrast, imageSize.height, imageSize.width, saturation, strokes]);

  useEffect(drawCanvas, [drawCanvas]);

  useEffect(() => {
    if (!state) {
      return;
    }

    const image = new Image();
    image.addEventListener('load', () => {
      imageRef.current = image;
      setImageSize({width: image.naturalWidth, height: image.naturalHeight});
    });

    image.src = `file://${state.filePath}`;
  }, [state]);

  const eventPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return getCanvasPointFromClientPoint({
      client: {x: event.clientX, y: event.clientY},
      bounds,
      canvasSize: {width: canvas.width, height: canvas.height}
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'move') {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = eventPoint(event);
    if (tool === 'draw') {
      pushHistory();
      drawingRef.current = true;
      setStrokes(current => [...current, {color: strokeColor, width: strokeWidth, points: [point]}]);
    } else {
      cropStartRef.current = point;
      const selection = {x: point.x, y: point.y, width: 0, height: 0};
      draftCropRef.current = selection;
      setDraftCrop(selection);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = eventPoint(event);
    if (tool === 'draw' && drawingRef.current) {
      setStrokes(current => current.map((stroke, index) => index === current.length - 1 ? {...stroke, points: [...stroke.points, point]} : stroke));
    } else if (tool === 'crop' && cropStartRef.current) {
      const start = cropStartRef.current;
      const selection = {
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y)
      };
      draftCropRef.current = selection;
      setDraftCrop(selection);
    }
  };

  const onPointerUp = () => {
    drawingRef.current = false;
    cropStartRef.current = undefined;

    const selection = draftCropRef.current;
    if (tool !== 'crop' || !selection || selection.width < 2 || selection.height < 2) {
      setDraftCrop(undefined);
      draftCropRef.current = undefined;
      return;
    }

    pushHistory();
    const previousCrop = committedCrop;
    const source = previousCrop ?? {x: 0, y: 0, width: imageSize.width, height: imageSize.height};
    setCommittedCrop({
      x: source.x + selection.x,
      y: source.y + selection.y,
      width: selection.width,
      height: selection.height
    });
    setCropHistory(current => [...current, {crop: previousCrop, offset: {x: selection.x, y: selection.y}}]);
    setStrokes(current => current.map(stroke => ({
      ...stroke,
      points: stroke.points.map(point => ({x: point.x - selection.x, y: point.y - selection.y}))
    })));
    setDraftCrop(undefined);
    draftCropRef.current = undefined;
    setTool('move');
  };

  const revertLatestCrop = () => {
    const previous = cropHistory[cropHistory.length - 1];
    if (!previous) {
      return;
    }

    pushHistory();
    setCommittedCrop(previous.crop);
    setCropHistory(current => current.slice(0, -1));
    setStrokes(current => current.map(stroke => ({
      ...stroke,
      points: stroke.points.map(point => ({x: point.x + previous.offset.x, y: point.y + previous.offset.y}))
    })));
  };

  const renderOutput = useCallback(() => {
    const source = canvasRef.current;
    if (!source) {
      return;
    }

    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    output.getContext('2d')?.drawImage(source, 0, 0);

    const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    return output.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined);
  }, [format]);

  const exportImage = useCallback(async (action: 'copy' | 'save') => {
    const dataUrl = renderOutput();
    if (!dataUrl) {
      return;
    }

    if (action === 'copy') {
      await ipc.callMain('screenshot-copy-clipboard', {dataUrl, format});
      setExportNotice({
        action,
        message: `${format.toUpperCase()} image ready to paste`,
        thumbnail: dataUrl,
        title: 'Screenshot copied'
      });
      return;
    }

    const result = await ipc.callMain<ScreenshotExport, ScreenshotSaveResult>('screenshot-save', {dataUrl, format});
    if (!result.filePath) {
      return;
    }

    setExportNotice({
      action,
      filePath: result.filePath,
      message: `Saved ${format.toUpperCase()} screenshot`,
      thumbnail: dataUrl,
      title: getFileName(result.filePath)
    });
  }, [format, renderOutput]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void exportImage('copy');
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void exportImage('save');
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }

      if (event.key === 'Escape') {
        if (tool === 'move') {
          window.close();
        } else {
          setTool('move');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exportImage, tool, undo]);

  if (!state) {
    return null;
  }

  const canvasSize = {
    width: Math.max(1, Math.round(committedCrop?.width ?? imageSize.width)),
    height: Math.max(1, Math.round(committedCrop?.height ?? imageSize.height))
  };
  const cropStyle = draftCrop ? {
    left: `${(draftCrop.x / canvasSize.width) * 100}%`,
    top: `${(draftCrop.y / canvasSize.height) * 100}%`,
    width: `${(draftCrop.width / canvasSize.width) * 100}%`,
    height: `${(draftCrop.height / canvasSize.height) * 100}%`
  } : undefined;

  const outputSize = `${canvasSize.width} × ${canvasSize.height}`;
  const resetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  return (
    <main className="editor-shell">
      <header className="title-bar">
        <TrafficLights/>
        <div className="title">Screenshot</div>
        <div className="size-readout">{outputSize}</div>
      </header>

      <section className="stage">
        <div className="tool-rail">
          <ToolButton active={tool === 'move'} title="View (V)" onClick={() => setTool('move')}>View</ToolButton>
          <ToolButton active={tool === 'draw'} title="Draw (D)" onClick={() => setTool('draw')}>Draw</ToolButton>
          <ToolButton active={tool === 'crop'} title="Crop (C)" onClick={() => setTool('crop')}>Crop</ToolButton>
        </div>

        <div className="canvas-wrap">
          <div className="canvas-frame">
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className={`image-canvas ${tool}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {draftCrop && draftCrop.width > 0 && draftCrop.height > 0 && <div className="crop-selection" style={cropStyle}><i/><i/><i/><i/></div>}
          </div>
        </div>
      </section>

      <section className="edit-strip">
        <div className="edit-group drawing-controls">
          <span className="group-label">Markup</span>
          <div className="swatches">
            {colors.map(color => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color}`}
                className={strokeColor === color ? 'swatch selected' : 'swatch'}
                style={{background: color}}
                onClick={() => {
                  setStrokeColor(color);
                  setTool('draw');
                }}
              />
            ))}
          </div>
          <Range label="Width" min={2} max={24} value={strokeWidth} onChange={setStrokeWidth}/>
          <button type="button" className="text-button" disabled={historyDepth === 0} onClick={undo}>Undo</button>
          <button
            type="button"
            className="text-button"
            disabled={strokes.length === 0}
            onClick={() => {
              pushHistory();
              setStrokes([]);
            }}
          >
            Clear
          </button>
        </div>

        <div className="edit-group adjustments">
          <span className="group-label">Adjust</span>
          <Range label="Brightness" min={50} max={150} value={brightness} onChange={setBrightness}/>
          <Range label="Contrast" min={50} max={150} value={contrast} onChange={setContrast}/>
          <Range label="Saturation" min={0} max={200} value={saturation} onChange={setSaturation}/>
          <button type="button" className="text-button" onClick={resetAdjustments}>Reset</button>
        </div>
      </section>

      <footer className="options-bar">
        <div className="left-options">
          <span className="option-label">Crop</span>
          <button type="button" className={committedCrop ? 'control active-control' : 'control'} onClick={() => setTool('crop')}>{committedCrop ? outputSize : 'Original'}</button>
          {committedCrop && <button type="button" className="control subtle" onClick={revertLatestCrop}>Revert crop</button>}
        </div>
        <div className="right-options">
          <span className="option-label">Format</span>
          <div className="format-select"><Select options={formatOptions} value={format} onChange={value => value && setFormat(value)}/></div>
          <div className="export-select">
            <Select
              value={exportAction}
              options={[
                {label: 'Save to Disk', value: 'save' as const},
                {label: 'Copy to Clipboard', value: 'copy' as const}
              ]}
              onChange={action => action && setExportAction(action)}
            />
          </div>
          <button type="button" className="primary-action" onClick={async () => exportImage(exportAction)}>Export</button>
        </div>
      </footer>

      {exportNotice && (
        <aside className="export-completion" aria-live="polite">
          <div className="completion-thumbnail">
            <img src={exportNotice.thumbnail} alt=""/>
          </div>
          <div className="completion-details">
            <div className="completion-title" title={exportNotice.title}>{exportNotice.title}</div>
            <div className="completion-message">{exportNotice.message}</div>
            <div className="completion-actions">
              {exportNotice.action === 'save' && (
                <>
                  <button type="button" onClick={async () => exportImage('copy')}>Copy</button>
                  <button type="button" onClick={async () => ipc.callMain('screenshot-show-in-folder', {filePath: exportNotice.filePath})}>Show in Finder</button>
                </>
              )}
              <button type="button" onClick={() => setExportNotice(undefined)}>Done</button>
            </div>
          </div>
        </aside>
      )}

      <style jsx global>{`
        html,
        body,
        #__next {
          background: #222;
          height: 100%;
          margin: 0;
          overflow: hidden;
          width: 100%;
        }

        * {
          box-sizing: border-box;
        }

        button,
        input {
          font: inherit;
        }
      `}</style>
      <style jsx>{`
        .editor-shell {
          background: #222;
          color: #fff;
          display: flex;
          flex-direction: column;
          height: 100vh;
          min-height: 0;
          position: relative;
          width: 100vw;
        }

        .title-bar {
          align-items: center;
          background: rgba(34, 34, 34, 0.96);
          display: flex;
          flex: 0 0 40px;
          height: 40px;
          position: relative;
          -webkit-app-region: drag;
          z-index: 10;
        }

        .title {
          font-size: 14px;
          left: 50%;
          position: absolute;
          transform: translateX(-50%);
        }

        .size-readout {
          color: rgba(255, 255, 255, 0.45);
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          margin-left: auto;
          margin-right: 14px;
        }

        .stage {
          background: #000;
          display: flex;
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
          position: relative;
        }

        .canvas-wrap {
          align-items: center;
          display: flex;
          flex: 1;
          justify-content: center;
          min-height: 0;
          overflow: auto;
          padding: 28px 52px;
        }

        .canvas-frame {
          display: flex;
          max-height: 100%;
          max-width: 100%;
          position: relative;
        }

        .image-canvas {
          background: #111;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(255, 255, 255, 0.08);
          display: block;
          height: auto;
          max-height: 100%;
          max-width: 100%;
          object-fit: contain;
          touch-action: none;
          width: auto;
          -webkit-app-region: no-drag;
        }

        .image-canvas.draw {
          cursor: crosshair;
        }

        .image-canvas.crop {
          cursor: cell;
        }

        .tool-rail {
          background: rgba(36, 36, 36, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.34);
          display: flex;
          gap: 2px;
          left: 14px;
          padding: 3px;
          position: absolute;
          top: 14px;
          z-index: 5;
          -webkit-app-region: no-drag;
        }

        .crop-selection {
          background-image:
            linear-gradient(to right, transparent 33.2%, rgba(255, 255, 255, 0.42) 33.2%, rgba(255, 255, 255, 0.42) 33.4%, transparent 33.4%, transparent 66.5%, rgba(255, 255, 255, 0.42) 66.5%, rgba(255, 255, 255, 0.42) 66.7%, transparent 66.7%),
            linear-gradient(to bottom, transparent 33.2%, rgba(255, 255, 255, 0.42) 33.2%, rgba(255, 255, 255, 0.42) 33.4%, transparent 33.4%, transparent 66.5%, rgba(255, 255, 255, 0.42) 66.5%, rgba(255, 255, 255, 0.42) 66.7%, transparent 66.7%);
          border: 1px solid #fff;
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.52), inset 0 0 0 1px rgba(0, 0, 0, 0.4);
          pointer-events: none;
          position: absolute;
        }

        .crop-selection i {
          background: #fff;
          border-radius: 1px;
          height: 7px;
          position: absolute;
          width: 7px;
        }

        .crop-selection i:nth-child(1) { left: -4px; top: -4px; }
        .crop-selection i:nth-child(2) { right: -4px; top: -4px; }
        .crop-selection i:nth-child(3) { bottom: -4px; left: -4px; }
        .crop-selection i:nth-child(4) { bottom: -4px; right: -4px; }

        .edit-strip {
          background: #191919;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          flex: 0 0 88px;
          grid-template-columns: minmax(450px, 0.84fr) minmax(530px, 1.16fr);
          min-height: 88px;
          -webkit-app-region: no-drag;
        }

        .edit-group {
          align-items: center;
          display: flex;
          gap: 10px;
          min-width: 0;
          padding: 12px 16px;
        }

        .edit-group + .edit-group {
          border-left: 1px solid rgba(255, 255, 255, 0.07);
        }

        .adjustments {
          padding-right: 28px;
        }

        .group-label,
        .option-label {
          color: rgba(255, 255, 255, 0.42);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .swatches {
          display: flex;
          gap: 5px;
        }

        .swatch {
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          height: 14px;
          padding: 0;
          width: 14px;
          -webkit-app-region: no-drag;
        }

        .swatch.selected {
          box-shadow: 0 0 0 2px #191919, 0 0 0 3px rgba(255, 255, 255, 0.82);
        }

        .text-button,
        .control,
        .primary-action {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 11px;
          height: 26px;
          padding: 0 9px;
          white-space: nowrap;
          -webkit-app-region: no-drag;
        }

        .text-button:hover:not(:disabled),
        .control:hover,
        .primary-action:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
        }

        .text-button:disabled {
          opacity: 0.35;
        }

        .options-bar {
          align-items: center;
          background: #222;
          display: flex;
          flex: 0 0 48px;
          height: 48px;
          justify-content: space-between;
          padding: 0 16px;
          -webkit-app-region: no-drag;
        }

        .left-options,
        .right-options {
          align-items: center;
          display: flex;
          gap: 8px;
        }

        .active-control {
          background: rgba(116, 88, 255, 0.3);
          border-color: rgba(154, 135, 255, 0.52);
        }

        .subtle {
          background: transparent;
          border-color: transparent;
          color: rgba(255, 255, 255, 0.48);
        }

        .format-select {
          height: 26px;
          width: 96px;
        }

        .primary-action {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          min-width: 92px;
        }

        .export-select {
          height: 26px;
          width: 144px;
        }

        .export-completion {
          align-items: center;
          background: rgba(36, 36, 36, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          bottom: 62px;
          box-shadow: 0 14px 42px rgba(0, 0, 0, 0.45);
          display: flex;
          gap: 12px;
          max-width: calc(100vw - 28px);
          min-height: 80px;
          padding: 14px;
          position: absolute;
          right: 14px;
          width: 340px;
          z-index: 20;
          -webkit-app-region: no-drag;
        }

        .completion-thumbnail {
          background: #111;
          border-radius: 4px;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
          flex: 0 0 52px;
          height: 52px;
          overflow: hidden;
          width: 52px;
        }

        .completion-thumbnail img {
          height: 100%;
          object-fit: cover;
          width: 100%;
        }

        .completion-details {
          min-width: 0;
          flex: 1;
        }

        .completion-title {
          color: #fff;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .completion-message {
          color: rgba(255, 255, 255, 0.58);
          font-size: 12px;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .completion-actions {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }

        .completion-actions button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.82);
          font-size: 11px;
          height: 24px;
          padding: 0 8px;
          white-space: nowrap;
        }

        .completion-actions button:hover,
        .completion-actions button:focus-visible {
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
          outline: none;
        }

        @media (max-width: 980px) {
          .edit-strip {
            grid-template-columns: 1fr;
            overflow-y: auto;
          }

          .edit-group + .edit-group {
            border-left: 0;
            border-top: 1px solid rgba(255, 255, 255, 0.07);
          }
        }
      `}</style>
    </main>
  );
};

export default ScreenshotPreview;
