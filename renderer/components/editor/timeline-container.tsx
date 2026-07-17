import {createContainer} from 'unstated-next';
import {useEffect, useMemo, useRef, useState} from 'react';
import {TimelineClip} from 'common/types';
import VideoTimeContainer from './video-time-container';
import VideoControlsContainer from './video-controls-container';
import {clipDuration, findPlaybackClipForSourceTime, getPlaybackPositionAtTimelineTime, getTimelineDuration, getTimelineTimeForClipSourceTime, getTimelineTimeForClipStart} from '../../../main/common/timeline';

const makeClip = (startTime: number, endTime: number): TimelineClip => ({
  id: `${Date.now()}-${Math.random()}`,
  startTime,
  endTime,
  speed: 1,
  brightness: 0,
  contrast: 1,
  saturation: 1
});

const useTimeline = () => {
  const {startTime, endTime, currentTime, updateTime} = VideoTimeContainer.useContainer();
  const {isPaused, pause, play, holdFrame} = VideoControlsContainer.useContainer();
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activeClipId, setActiveClipId] = useState<string>();
  const [isEdited, setIsEdited] = useState(false);
  const [copiedClip, setCopiedClip] = useState<TimelineClip>();
  const [timelineTime, setTimelineTime] = useState(0);
  const timelineTimeRef = useRef(0);

  const updateTimelineTime = (time: number) => {
    timelineTimeRef.current = time;
    setTimelineTime(time);
  };

  useEffect(() => {
    if (!isEdited && endTime > startTime) {
      const clip = makeClip(startTime, endTime);
      setClips([clip]);
      setSelectedId(clip.id);
      setActiveClipId(clip.id);
      updateTimelineTime(0);
    }
  }, [startTime, endTime, isEdited]);

  const selectedClip = useMemo(() => clips.find(clip => clip.id === selectedId) ?? clips[0], [clips, selectedId]);
  const activeClip = useMemo(() => clips.find(clip => clip.id === activeClipId) ?? clips[0], [activeClipId, clips]);

  const commit = (nextClips: TimelineClip[], selectId?: string, nextTimelineTime?: number, nextActiveClipId?: string) => {
    setIsEdited(true);
    setClips(nextClips);
    setSelectedId(selectId ?? nextClips[0]?.id);

    const playbackClip = findPlaybackClipForSourceTime(nextClips, currentTime, activeClipId);
    setActiveClipId(nextActiveClipId ?? playbackClip?.id ?? selectId ?? nextClips[0]?.id);
    updateTimelineTime(nextTimelineTime ?? Math.min(getTimelineDuration(nextClips), timelineTimeRef.current));
  };

  const select = (id: string) => {
    setSelectedId(id);
  };

  const seek = (id: string, time: number, nextTimelineTime?: number) => {
    setSelectedId(id);
    setActiveClipId(id);
    const clip = clips.find(item => item.id === id);
    if (clip) {
      updateTime(Math.max(clip.startTime, Math.min(clip.endTime, time)));
      updateTimelineTime(nextTimelineTime ?? getTimelineTimeForClipSourceTime(clips, id, time));
    }
  };

  useEffect(() => {
    if (!activeClip) {
      return;
    }

    if (activeClip.freezeDuration !== undefined) {
      return;
    }

    if (isPaused || currentTime < activeClip.endTime - 0.04) {
      updateTimelineTime(getTimelineTimeForClipSourceTime(clips, activeClip.id, currentTime));
      const playbackClip = findPlaybackClipForSourceTime(clips, currentTime, activeClip.id);
      if (playbackClip && playbackClip.id !== activeClip.id) {
        setActiveClipId(playbackClip.id);
      }

      return;
    }

    const index = clips.findIndex(clip => clip.id === activeClip.id);
    const nextClip = clips[index + 1];
    if (nextClip) {
      setActiveClipId(nextClip.id);
      updateTime(nextClip.startTime);
      updateTimelineTime(getTimelineTimeForClipStart(clips, nextClip.id) ?? getTimelineDuration(clips));
    } else {
      pause();
      updateTime(activeClip.endTime);
      updateTimelineTime(getTimelineDuration(clips));
    }
  }, [activeClip, clips, currentTime, isPaused]);

  useEffect(() => {
    if (!activeClip || activeClip.freezeDuration === undefined || isPaused) {
      return;
    }

    const currentTimelineTime = timelineTimeRef.current;
    const clipStartTime = getTimelineTimeForClipStart(clips, activeClip.id) ?? currentTimelineTime;
    const clipEndTime = clipStartTime + clipDuration(activeClip);
    const initialTimelineTime = currentTimelineTime >= clipStartTime && currentTimelineTime < clipEndTime ? currentTimelineTime : clipStartTime;
    const startedAt = performance.now();
    let animationFrame: number;

    holdFrame();
    updateTime(activeClip.startTime);
    updateTimelineTime(initialTimelineTime);

    const tick = () => {
      const nextTimelineTime = initialTimelineTime + ((performance.now() - startedAt) / 1000);

      if (nextTimelineTime < clipEndTime) {
        updateTimelineTime(nextTimelineTime);
        updateTime(activeClip.startTime);
        animationFrame = requestAnimationFrame(tick);
        return;
      }

      const nextPosition = getPlaybackPositionAtTimelineTime(clips, clipEndTime);
      updateTimelineTime(Math.min(clipEndTime, getTimelineDuration(clips)));

      if (nextPosition && nextPosition.clip.id !== activeClip.id) {
        setActiveClipId(nextPosition.clip.id);
        updateTime(nextPosition.sourceTime);
        play();
      } else {
        pause();
        updateTime(activeClip.endTime);
        updateTimelineTime(getTimelineDuration(clips));
      }
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [activeClip, clips, isPaused]);

  const split = () => {
    const index = clips.findIndex(clip => clip.id === selectedClip?.id);
    if (index < 0) {
      return;
    }

    if (selectedClip.freezeDuration !== undefined) {
      const clipStartTime = getTimelineTimeForClipStart(clips, selectedClip.id) ?? 0;
      const splitTime = timelineTime - clipStartTime;

      if (splitTime <= 0.05 || splitTime >= selectedClip.freezeDuration - 0.05) {
        return;
      }

      const left = {...selectedClip, id: `${Date.now()}-left`, freezeDuration: splitTime};
      const right = {...selectedClip, id: `${Date.now()}-right`, freezeDuration: selectedClip.freezeDuration - splitTime};
      commit([...clips.slice(0, index), left, right, ...clips.slice(index + 1)], right.id);
      return;
    }

    if (currentTime <= selectedClip.startTime + 0.05 || currentTime >= selectedClip.endTime - 0.05) {
      return;
    }

    const left = {...selectedClip, id: `${Date.now()}-left`, endTime: currentTime};
    const right = {...selectedClip, id: `${Date.now()}-right`, startTime: currentTime};
    commit([...clips.slice(0, index), left, right, ...clips.slice(index + 1)], right.id);
  };

  const remove = () => {
    if (clips.length <= 1 || !selectedClip) {
      return;
    }

    commit(clips.filter(clip => clip.id !== selectedClip.id));
  };

  const freeze = () => {
    if (!selectedClip) {
      return;
    }

    const index = clips.findIndex(clip => clip.id === selectedClip.id);
    const time = Math.min(selectedClip.endTime, Math.max(selectedClip.startTime, currentTime));
    const frozen = {...makeClip(time, time + 0.04), freezeDuration: 1};
    const replacement: TimelineClip[] = [];

    if (time > selectedClip.startTime + 0.01) {
      replacement.push({...selectedClip, id: `${Date.now()}-before-freeze`, endTime: time});
    }

    replacement.push(frozen);

    if (time < selectedClip.endTime - 0.01) {
      replacement.push({...selectedClip, id: `${Date.now()}-after-freeze`, startTime: time});
    }

    const nextClips = [...clips.slice(0, index), ...replacement, ...clips.slice(index + 1)];
    const frozenTimelineTime = getTimelineTimeForClipStart(nextClips, frozen.id) ?? timelineTimeRef.current;

    pause();
    updateTime(time);
    commit(nextClips, frozen.id, frozenTimelineTime, frozen.id);
  };

  const copy = () => {
    if (selectedClip) {
      setCopiedClip({...selectedClip});
    }
  };

  const paste = () => {
    if (!copiedClip) {
      return;
    }

    const index = Math.max(0, clips.findIndex(clip => clip.id === selectedClip?.id));
    const pasted = {...copiedClip, id: `${Date.now()}-pasted`};
    commit([...clips.slice(0, index + 1), pasted, ...clips.slice(index + 1)], pasted.id);
  };

  const cut = () => {
    if (clips.length <= 1) {
      return;
    }

    copy();
    remove();
  };

  const duplicate = () => {
    if (!selectedClip) {
      return;
    }

    const index = clips.findIndex(clip => clip.id === selectedClip.id);
    const duplicated = {...selectedClip, id: `${Date.now()}-duplicate`};
    commit([...clips.slice(0, index + 1), duplicated, ...clips.slice(index + 1)], duplicated.id);
  };

  const updateSelected = (updates: Partial<TimelineClip>) => {
    if (!selectedClip) {
      return;
    }

    commit(clips.map(clip => clip.id === selectedClip.id ? {...clip, ...updates} : clip), selectedClip.id);
  };

  const updateClip = (id: string, updates: Partial<TimelineClip>) => {
    commit(clips.map(clip => clip.id === id ? {...clip, ...updates} : clip), id);
  };

  return {clips, selectedClip, activeClip, copiedClip, isEdited, timelineTime, select, seek, split, remove, freeze, copy, paste, cut, duplicate, updateSelected, updateClip};
};

const TimelineContainer = createContainer(useTimeline);
export default TimelineContainer;
