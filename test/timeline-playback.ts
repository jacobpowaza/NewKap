import test from 'ava';
import {
  formatTimelineDuration,
  getPlaybackPositionAtTimelineTime,
  getTimelineDuration,
  getTimelineTimeForClipSourceTime,
  getTimelineTimeForClipStart,
  snapTimelineTime,
  trimClipAtTimelineTime
} from '../main/common/timeline';
import {TimelineClip} from '../main/common/types';

const clips: TimelineClip[] = [
  {id: 'first', startTime: 0, endTime: 2, speed: 1, brightness: 0, contrast: 1, saturation: 1},
  {id: 'selected', startTime: 2, endTime: 4, speed: 1, brightness: 0, contrast: 1, saturation: 1},
  {id: 'last', startTime: 4, endTime: 8, speed: 1, brightness: 0, contrast: 1, saturation: 1}
];

test('timeline duration includes clips after the selected clip', t => {
  t.is(getTimelineDuration(clips), 8);

  const afterSelectedClip = getPlaybackPositionAtTimelineTime(clips, 4.5);
  t.is(afterSelectedClip?.clip.id, 'last');
  t.is(afterSelectedClip?.sourceTime, 4.5);
});

test('timeline playhead time is derived from active video playback time', t => {
  t.is(getTimelineTimeForClipSourceTime(clips, 'selected', 3), 3);

  const seekPosition = getPlaybackPositionAtTimelineTime(clips, 6);
  t.is(seekPosition?.clip.id, 'last');
  t.is(seekPosition?.sourceTime, 6);
});

test('timeline boundary lookup treats adjacent clips as first-class items', t => {
  const boundaryPosition = getPlaybackPositionAtTimelineTime(clips, 2);

  t.is(boundaryPosition?.clip.id, 'selected');
  t.is(boundaryPosition?.sourceTime, 2);
  t.is(getTimelineTimeForClipStart(clips, 'last'), 4);
});

test('freeze frame timeline positions advance while source frame stays fixed', t => {
  const freezeClips: TimelineClip[] = [
    clips[0],
    {id: 'freeze', startTime: 2, endTime: 2.04, freezeDuration: 1.25, speed: 1, brightness: 0, contrast: 1, saturation: 1},
    clips[2]
  ];

  const midway = getPlaybackPositionAtTimelineTime(freezeClips, 2.75);

  t.is(midway?.clip.id, 'freeze');
  t.is(midway?.timelineTime, 2.75);
  t.is(midway?.sourceTime, 2);

  const afterFreeze = getPlaybackPositionAtTimelineTime(freezeClips, 3.25);
  t.is(afterFreeze?.clip.id, 'last');
});

test('timeline duration labels trim insignificant decimals', t => {
  t.is(formatTimelineDuration(3), '3s');
  t.is(formatTimelineDuration(3.00000001), '3s');
  t.is(formatTimelineDuration(3.1), '3.1s');
  t.is(formatTimelineDuration(3.1123848191), '3.11s');
});

test('timeline snapping uses clip starts, clip ends, and full timeline bounds', t => {
  const nearClipBoundary = snapTimelineTime(3.96, clips, 800, 8);
  t.deepEqual(nearClipBoundary, {
    time: 4,
    snapped: true,
    snapPoint: 4
  });

  const nearTimelineStart = snapTimelineTime(0.03, clips, 800, 8);
  t.deepEqual(nearTimelineStart, {
    time: 0,
    snapped: true,
    snapPoint: 0
  });

  const intentionalNonSnap = snapTimelineTime(3.8, clips, 800, 8);
  t.deepEqual(intentionalNonSnap, {
    time: 3.8,
    snapped: false
  });
});

test('timeline snapping threshold scales with timeline zoom width', t => {
  t.true(snapTimelineTime(3.92, clips, 400, 8).snapped);
  t.false(snapTimelineTime(3.92, clips, 1600, 8).snapped);
});

test('clip trim handles update in and out points from timeline drag time', t => {
  t.deepEqual(trimClipAtTimelineTime({
    clips,
    clipId: 'selected',
    edge: 'end',
    requestedTime: 3.5,
    mediaDuration: 8
  }), {
    endTime: 3.5
  });

  t.deepEqual(trimClipAtTimelineTime({
    clips,
    clipId: 'selected',
    edge: 'start',
    requestedTime: 2.5,
    mediaDuration: 8
  }), {
    startTime: 2.5
  });
});

test('freeze frame trim keeps the clip editable as a freeze clip', t => {
  const freezeClips: TimelineClip[] = [
    clips[0],
    {id: 'freeze', startTime: 2, endTime: 2.04, freezeDuration: 1, speed: 1, brightness: 0, contrast: 1, saturation: 1},
    clips[2]
  ];

  t.deepEqual(trimClipAtTimelineTime({
    clips: freezeClips,
    clipId: 'freeze',
    edge: 'end',
    requestedTime: 2.05,
    mediaDuration: 8
  }), {
    freezeDuration: 0.1
  });

  t.is(getPlaybackPositionAtTimelineTime(freezeClips, 2)?.sourceTime, 2);
});
