import type {TimelineClip} from './types';

export type TimelinePlaybackPosition = {
  clip: TimelineClip;
  clipIndex: number;
  timelineTime: number;
  sourceTime: number;
};

export type SnapResult = {
  time: number;
  snapped: boolean;
  snapPoint?: number;
};

export type TrimEdge = 'start' | 'end';

export type TrimClipOptions = {
  clips: TimelineClip[];
  clipId: string;
  edge: TrimEdge;
  requestedTime: number;
  mediaDuration: number;
};

const minClipDuration = 0.05;
const minFreezeDuration = 0.1;
const maxFreezeDuration = 10;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const clipDuration = (clip: TimelineClip): number => (
  clip.freezeDuration ?? ((clip.endTime - clip.startTime) / clip.speed)
);

export const formatTimelineDuration = (duration: number): string => {
  if (!Number.isFinite(duration)) {
    return '0s';
  }

  const rounded = Math.round(duration * 100) / 100;
  const decimals = Math.abs(rounded - Math.round(rounded)) < 0.005 ? 0 : (Math.abs((rounded * 10) - Math.round(rounded * 10)) < 0.005 ? 1 : 2);

  return `${rounded.toFixed(decimals)}s`;
};

export const getTimelineDuration = (clips: TimelineClip[]): number => {
  let duration = 0;

  for (const clip of clips) {
    duration += Math.max(0, clipDuration(clip));
  }

  return duration;
};

export const getTimelineBoundaries = (clips: TimelineClip[]): number[] => {
  const boundaries = [0];
  let elapsed = 0;

  for (const clip of clips) {
    elapsed += Math.max(0, clipDuration(clip));
    boundaries.push(elapsed);
  }

  return boundaries;
};

export const getTimelineTimeForClipStart = (clips: TimelineClip[], clipId: string): number | undefined => {
  let elapsed = 0;

  for (const clip of clips) {
    if (clip.id === clipId) {
      return elapsed;
    }

    elapsed += Math.max(0, clipDuration(clip));
  }

  return undefined;
};

export const getPlaybackPositionAtTimelineTime = (
  clips: TimelineClip[],
  requestedTime: number
): TimelinePlaybackPosition | undefined => {
  const timelineDuration = getTimelineDuration(clips);
  const boundedTime = Math.max(0, Math.min(timelineDuration, requestedTime));
  let elapsed = 0;

  for (const [clipIndex, clip] of clips.entries()) {
    const duration = Math.max(0, clipDuration(clip));
    const isLast = clipIndex === clips.length - 1;
    if (boundedTime < elapsed + duration || isLast) {
      const localTime = Math.max(0, Math.min(duration, boundedTime - elapsed));
      const sourceTime = clip.freezeDuration === undefined ? clip.startTime + (localTime * clip.speed) : clip.startTime;

      return {
        clip,
        clipIndex,
        timelineTime: boundedTime,
        sourceTime
      };
    }

    elapsed += duration;
  }

  return undefined;
};

export const getTimelineTimeForClipSourceTime = (
  clips: TimelineClip[],
  clipId: string | undefined,
  sourceTime: number
): number => {
  let elapsed = 0;

  for (const clip of clips) {
    const duration = Math.max(0, clipDuration(clip));

    if (clip.id === clipId) {
      if (clip.freezeDuration === undefined) {
        return elapsed + ((Math.max(clip.startTime, Math.min(clip.endTime, sourceTime)) - clip.startTime) / clip.speed);
      }

      return elapsed;
    }

    elapsed += duration;
  }

  return Math.max(0, Math.min(getTimelineDuration(clips), sourceTime));
};

export const findPlaybackClipForSourceTime = (
  clips: TimelineClip[],
  sourceTime: number,
  preferredClipId?: string
): TimelineClip | undefined => {
  const preferredClip = clips.find(clip => clip.id === preferredClipId);
  if (preferredClip && sourceTime >= preferredClip.startTime && sourceTime <= preferredClip.endTime) {
    return preferredClip;
  }

  return clips.find(clip => sourceTime >= clip.startTime && sourceTime <= clip.endTime) ?? clips[clips.length - 1];
};

export const snapTimelineTime = (
  requestedTime: number,
  clips: TimelineClip[],
  timelineWidth: number,
  thresholdPixels = 8
): SnapResult => {
  const duration = getTimelineDuration(clips);
  const boundedTime = Math.max(0, Math.min(duration, requestedTime));

  if (timelineWidth <= 0 || duration <= 0 || thresholdPixels <= 0) {
    return {time: boundedTime, snapped: false};
  }

  const thresholdTime = (thresholdPixels / timelineWidth) * duration;
  let closestPoint: number | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const snapPoint of getTimelineBoundaries(clips)) {
    const distance = Math.abs(snapPoint - boundedTime);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = snapPoint;
    }
  }

  if (closestPoint !== undefined && closestDistance <= thresholdTime) {
    return {
      time: closestPoint,
      snapped: true,
      snapPoint: closestPoint
    };
  }

  return {time: boundedTime, snapped: false};
};

export const trimClipAtTimelineTime = ({
  clips,
  clipId,
  edge,
  requestedTime,
  mediaDuration
}: TrimClipOptions): Partial<TimelineClip> | undefined => {
  let elapsedBeforeClip = 0;
  const clip = clips.find(item => {
    if (item.id === clipId) {
      return true;
    }

    elapsedBeforeClip += Math.max(0, clipDuration(item));
    return false;
  });

  if (!clip) {
    return undefined;
  }

  const duration = Math.max(0, clipDuration(clip));
  const clipEndOnTimeline = elapsedBeforeClip + duration;

  if (clip.freezeDuration === undefined) {
    if (edge === 'start') {
      const nextDuration = Math.max(minClipDuration, clipEndOnTimeline - requestedTime);
      return {
        startTime: clamp(clip.endTime - (nextDuration * clip.speed), 0, clip.endTime - minClipDuration)
      };
    }

    const nextDuration = Math.max(minClipDuration, requestedTime - elapsedBeforeClip);
    return {
      endTime: clamp(clip.startTime + (nextDuration * clip.speed), clip.startTime + minClipDuration, mediaDuration)
    };
  }

  const nextDuration = edge === 'start' ? clipEndOnTimeline - requestedTime : requestedTime - elapsedBeforeClip;

  return {
    freezeDuration: clamp(nextDuration, minFreezeDuration, maxFreezeDuration)
  };
};
