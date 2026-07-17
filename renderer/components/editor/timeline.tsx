import {useEffect, useRef, useState} from 'react';
import TimelineContainer from './timeline-container';
import VideoTimeContainer from './video-time-container';
import VideoControlsContainer from './video-controls-container';
import {PauseIcon, PlayIcon} from '../../vectors';
import {TimelineClip} from 'common/types';
import {
  clipDuration,
  formatTimelineDuration,
  getPlaybackPositionAtTimelineTime,
  getTimelineDuration,
  snapTimelineTime,
  trimClipAtTimelineTime,
  TrimEdge
} from '../../../main/common/timeline';

const Timeline = () => {
  const {duration} = VideoTimeContainer.useContainer();
  const {isPaused, pause, play} = VideoControlsContainer.useContainer();
  const {clips, selectedClip, activeClip, copiedClip, timelineTime, select, seek, split, remove, freeze, copy, paste, cut, duplicate, updateSelected, updateClip} = TimelineContainer.useContainer();
  const trackRef = useRef<HTMLDivElement>();
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [trimTarget, setTrimTarget] = useState<{clipId: string; edge: TrimEdge}>();
  const [snapPoint, setSnapPoint] = useState<number>();
  const timelineDuration = Math.max(0.001, getTimelineDuration(clips));
  const playheadTime = timelineTime;
  const playheadPosition = (playheadTime / timelineDuration) * 100;
  const isStandardClip = selectedClip?.freezeDuration === undefined;

  const togglePlayback = () => {
    if (isPaused) {
      play();
    } else {
      pause();
    }
  };

  const seekToTimelineTime = (requestedTime: number, snap = false) => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    const snapResult = snap ? snapTimelineTime(requestedTime, clips, width) : {
      time: Math.max(0, Math.min(timelineDuration, requestedTime)),
      snapped: false
    };
    const position = getPlaybackPositionAtTimelineTime(clips, snapResult.time);

    setSnapPoint(snapResult.snapped ? snapResult.snapPoint : undefined);

    if (position) {
      seek(position.clip.id, position.sourceTime, position.timelineTime);
    }
  };

  const getTimelineTimeFromPointer = event => {
    const {left, width} = trackRef.current.getBoundingClientRect();
    return ((event.clientX - left) / width) * timelineDuration;
  };

  const getSnappedTimelineTime = (requestedTime: number) => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    const snapResult = snapTimelineTime(requestedTime, clips, width);
    setSnapPoint(snapResult.snapped ? snapResult.snapPoint : undefined);
    return snapResult.time;
  };

  const startScrubbing = event => {
    event.preventDefault();
    if (trimTarget) {
      return;
    }

    setIsScrubbing(true);
    trackRef.current?.setPointerCapture(event.pointerId);
    seekToTimelineTime(getTimelineTimeFromPointer(event), true);
  };

  const updateScrubbing = event => {
    if (!isScrubbing) {
      return;
    }

    seekToTimelineTime(getTimelineTimeFromPointer(event), true);
  };

  const stopScrubbing = event => {
    if (isScrubbing && trackRef.current?.hasPointerCapture(event.pointerId)) {
      trackRef.current.releasePointerCapture(event.pointerId);
    }

    setIsScrubbing(false);
    setSnapPoint(undefined);
  };

  const seekWithinClip = (event, clip: TimelineClip) => {
    event.stopPropagation();
    select(clip.id);
    startScrubbing(event);
  };

  const startTrimming = (event, clip: TimelineClip, edge: TrimEdge) => {
    event.preventDefault();
    event.stopPropagation();
    select(clip.id);
    setTrimTarget({clipId: clip.id, edge});
    trackRef.current?.setPointerCapture(event.pointerId);
  };

  const updateTrimming = event => {
    if (!trimTarget) {
      return;
    }

    const snappedTime = getSnappedTimelineTime(getTimelineTimeFromPointer(event));
    const updates = trimClipAtTimelineTime({
      clips,
      clipId: trimTarget.clipId,
      edge: trimTarget.edge,
      requestedTime: snappedTime,
      mediaDuration: duration
    });

    if (updates) {
      updateClip(trimTarget.clipId, updates);
    }
  };

  const stopTrimming = event => {
    if (trimTarget && trackRef.current?.hasPointerCapture(event.pointerId)) {
      trackRef.current.releasePointerCapture(event.pointerId);
    }

    setTrimTarget(undefined);
    setSnapPoint(undefined);
  };

  const finishFreezeDurationInput = () => {
    if (selectedClip?.freezeDuration === undefined) {
      return;
    }

    const nextDuration = Math.min(10, Math.max(0.1, Number.isFinite(selectedClip.freezeDuration) ? selectedClip.freezeDuration : 1));
    updateSelected({freezeDuration: nextDuration});
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (event.metaKey) {
        const actions = {c: copy, v: paste, x: cut, d: duplicate};
        const action = actions[event.key.toLowerCase()];
        if (action) {
          event.preventDefault();
          action();
        }

        return;
      }

      if (['Backspace', 'Delete'].includes(event.key)) {
        event.preventDefault();
        remove();
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [copy, paste, cut, duplicate, isPaused, pause, play, remove]);

  return (
    <section className="timeline-panel">
      <div className="toolbar">
        <strong>Timeline</strong>
        <button type="button" className="playback" title={isPaused ? 'Play (Space)' : 'Pause (Space)'} onClick={togglePlayback}>
          {isPaused ? <PlayIcon size="12px" fill="#fff" hoverFill="#fff"/> : <PauseIcon size="12px" fill="#fff" hoverFill="#fff"/>}
          {isPaused ? 'Play' : 'Pause'}
        </button>
        <button type="button" title="Skip backward 5 seconds" onClick={() => seekToTimelineTime(playheadTime - 5)}>−5s</button>
        <button type="button" title="Skip forward 5 seconds" onClick={() => seekToTimelineTime(playheadTime + 5)}>+5s</button>
        <button type="button" title="Split at playhead" onClick={split}>Split</button>
        <button type="button" title="Copy (⌘C)" onClick={copy}>Copy</button>
        <button type="button" disabled={!copiedClip} title="Paste (⌘V)" onClick={paste}>Paste</button>
        <button type="button" disabled={clips.length <= 1} title="Cut (⌘X)" onClick={cut}>Cut</button>
        <button type="button" title="Duplicate (⌘D)" onClick={duplicate}>Duplicate</button>
        <button type="button" disabled={clips.length <= 1} title="Delete (⌫)" onClick={remove}>Delete</button>
        <button type="button" title="Insert the frame at the playhead" onClick={freeze}>Freeze Frame</button>
        <span className="hint">Select a clip, then adjust it before export</span>
      </div>
      <div
        ref={trackRef}
        className="track"
        title="Click or drag to seek"
        onPointerDown={startScrubbing}
        onPointerMove={event => {
          updateTrimming(event);
          updateScrubbing(event);
        }}
        onPointerUp={event => {
          stopTrimming(event);
          stopScrubbing(event);
        }}
        onPointerCancel={event => {
          stopTrimming(event);
          stopScrubbing(event);
        }}
      >
        {clips.map((clip, index) => {
          const width = Math.max(3, (clipDuration(clip) / timelineDuration) * 100);
          const clipLabel = clip.freezeDuration === undefined ? `clip ${index + 1}` : 'freeze frame';
          return (
            <div
              key={clip.id}
              role="button"
              tabIndex={0}
              className={[
                'clip',
                clip.id === selectedClip?.id ? 'selected' : '',
                clip.id === activeClip?.id ? 'active' : ''
              ].filter(Boolean).join(' ')}
              style={{width: `${width}%`}}
              onPointerDown={event => seekWithinClip(event, clip)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  select(clip.id);
                }
              }}
            >
              <span
                role="button"
                aria-label={`Trim start of ${clipLabel}`}
                tabIndex={-1}
                className="trim-handle start"
                onPointerDown={event => startTrimming(event, clip, 'start')}
              />
              {clip.freezeDuration === undefined ? `Clip ${index + 1}` : `Freeze ${formatTimelineDuration(clip.freezeDuration)}`}
              <span
                role="button"
                aria-label={`Trim end of ${clipLabel}`}
                tabIndex={-1}
                className="trim-handle end"
                onPointerDown={event => startTrimming(event, clip, 'end')}
              />
            </div>
          );
        })}
        {snapPoint !== undefined && <div className="snap-guide" style={{left: `${(snapPoint / timelineDuration) * 100}%`}}/>}
        <div className="playhead" style={{left: `${playheadPosition}%`}}><span/></div>
      </div>
      {selectedClip && (
        <div className="adjustments">
          {isStandardClip && <>
            <label>In <input type="number" min="0" max={selectedClip.endTime - 0.05} step="0.05" value={selectedClip.startTime.toFixed(2)} onChange={event => updateSelected({startTime: Number(event.target.value)})}/></label>
            <label>Out <input type="number" min={selectedClip.startTime + 0.05} max={duration} step="0.05" value={selectedClip.endTime.toFixed(2)} onChange={event => updateSelected({endTime: Number(event.target.value)})}/></label>
            <label>Speed <input type="range" min="0.5" max="2" step="0.25" value={selectedClip.speed} onChange={event => updateSelected({speed: Number(event.target.value)})}/><output>{selectedClip.speed}×</output></label>
          </>}
          {isStandardClip ? null : <label>Duration <input type="number" min="0.1" max="10" step="0.1" value={selectedClip.freezeDuration} onBlur={finishFreezeDurationInput} onChange={event => updateSelected({freezeDuration: Number(event.target.value)})}/></label>}
          <label>Brightness <input type="range" min="-0.5" max="0.5" step="0.05" value={selectedClip.brightness} onChange={event => updateSelected({brightness: Number(event.target.value)})}/></label>
          <label>Contrast <input type="range" min="0.5" max="2" step="0.1" value={selectedClip.contrast} onChange={event => updateSelected({contrast: Number(event.target.value)})}/></label>
          <label>Saturation <input type="range" min="0" max="2" step="0.1" value={selectedClip.saturation} onChange={event => updateSelected({saturation: Number(event.target.value)})}/></label>
        </div>
      )}
      <style jsx>{`
        .timeline-panel {
          background: #191919;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          flex-shrink: 0;
          padding: 8px 12px 10px;
          -webkit-app-region: no-drag;
        }

        .toolbar,
        .adjustments {
          align-items: center;
          display: flex;
          gap: 8px;
        }

        .toolbar strong {
          font-size: 12px;
          margin-right: 4px;
        }

        button,
        input {
          -webkit-app-region: no-drag;
        }

        .toolbar button {
          background: #303030;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: #fff;
          font-size: 11px;
          padding: 4px 8px;
        }

        .toolbar .playback {
          align-items: center;
          display: inline-flex;
          gap: 5px;
          min-width: 62px;
        }

        .toolbar button:disabled {
          opacity: 0.4;
        }

        .hint {
          color: #999;
          font-size: 11px;
          margin-left: auto;
        }

        @media (max-width: 1000px) {
          .hint {
            display: none;
          }
        }

        .track {
          background: #0d0d0d;
          border-radius: 5px;
          display: flex;
          gap: 2px;
          height: 34px;
          margin: 8px 0;
          overflow: hidden;
          padding: 3px;
          position: relative;
          cursor: pointer;
        }

        .clip {
          background: linear-gradient(135deg, #4b4b58, #30303a);
          border: 1px solid transparent;
          border-radius: 3px;
          color: #ddd;
          font-size: 10px;
          min-width: 32px;
          overflow: hidden;
          padding: 0 12px;
          position: relative;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .clip.selected {
          background: linear-gradient(135deg, #7458ff, #4c80ee);
          border-color: rgba(255, 255, 255, 0.65);
          color: #fff;
        }

        .clip.active {
          box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.45);
        }

        .trim-handle {
          bottom: 0;
          cursor: ew-resize;
          position: absolute;
          top: 0;
          width: 10px;
          z-index: 2;
        }

        .trim-handle::after {
          background: rgba(255, 255, 255, 0.42);
          border-radius: 999px;
          bottom: 7px;
          content: '';
          position: absolute;
          top: 7px;
          width: 2px;
        }

        .trim-handle.start {
          left: 0;
        }

        .trim-handle.start::after {
          left: 4px;
        }

        .trim-handle.end {
          right: 0;
        }

        .trim-handle.end::after {
          right: 4px;
        }

        .clip.selected .trim-handle::after,
        .trim-handle:hover::after {
          background: rgba(255, 255, 255, 0.9);
        }

        .snap-guide {
          background: rgba(5, 230, 181, 0.8);
          bottom: 0;
          box-shadow: 0 0 8px rgba(5, 230, 181, 0.45);
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: translateX(-1px);
          width: 2px;
          z-index: 4;
        }

        .playhead {
          background: #fff;
          bottom: 0;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45), 0 0 6px rgba(0, 0, 0, 0.8);
          pointer-events: none;
          position: absolute;
          top: 0;
          transform: translateX(-1px);
          width: 2px;
          z-index: 5;
        }

        .playhead span {
          background: #fff;
          border-radius: 0 0 3px 3px;
          height: 5px;
          left: -3px;
          position: absolute;
          top: 0;
          width: 8px;
        }

        .adjustments {
          flex-wrap: wrap;
          font-size: 10px;
        }

        label {
          align-items: center;
          color: #aaa;
          display: flex;
          gap: 4px;
        }

        input[type='number'] {
          background: #2b2b2b;
          border: 1px solid #444;
          border-radius: 3px;
          color: #fff;
          width: 52px;
        }

        input[type='range'] {
          width: 68px;
        }

        output {
          color: #fff;
          min-width: 24px;
        }
      `}</style>
    </section>
  );
};

export default Timeline;
