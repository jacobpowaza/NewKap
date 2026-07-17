import path from 'path';
import tempy from 'tempy';
import PCancelable from 'p-cancelable';
import {TimelineClip} from '../common/types';
import {convert} from './process';

const atempo = (speed: number) => {
  const filters: string[] = [];
  let remaining = speed;

  while (remaining > 2) {
    filters.push('atempo=2');
    remaining /= 2;
  }

  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining *= 2;
  }

  filters.push(`atempo=${remaining}`);
  return filters.join(',');
};

export const renderTimeline = PCancelable.fn(async ({
  inputPath,
  clips,
  hasAudio,
  onProgress
}: {
  inputPath: string;
  clips: TimelineClip[];
  hasAudio: boolean;
  onProgress: (progress: number, estimate?: string) => void;
}, onCancel: PCancelable.OnCancelFunction) => {
  const outputPath = tempy.file({extension: path.extname(inputPath) || 'mp4'});
  const filters: string[] = [];
  const videoInputs: string[] = [];
  const audioInputs: string[] = [];
  let outputDuration = 0;

  for (const [index, clip] of clips.entries()) {
    const duration = Math.max(0.001, clip.endTime - clip.startTime);
    outputDuration += clip.freezeDuration ?? (duration / clip.speed);
    const color = `eq=brightness=${clip.brightness}:contrast=${clip.contrast}:saturation=${clip.saturation}`;

    if (clip.freezeDuration === undefined) {
      filters.push(`[0:v]trim=start=${clip.startTime}:end=${clip.endTime},fps=60,setpts=N/(60*TB*${clip.speed}),fps=60,${color}[v${index}]`);
      if (hasAudio) {
        filters.push(`[0:a]atrim=start=${clip.startTime}:end=${clip.endTime},asetpts=PTS-STARTPTS,${atempo(clip.speed)},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${index}]`);
      }
    } else {
      filters.push(`[0:v]trim=start=${clip.startTime}:duration=${Math.min(duration, 0.04)},select=eq(n\\,0),setpts=0,${color},tpad=stop_mode=clone:stop_duration=${clip.freezeDuration},fps=60[v${index}]`);
      if (hasAudio) {
        filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${clip.freezeDuration},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${index}]`);
      }
    }

    videoInputs.push(`[v${index}]`);
    if (hasAudio) {
      audioInputs.push(`[a${index}]`);
    }
  }

  filters.push(
    `${videoInputs.join('')}concat=n=${clips.length}:v=1:a=0[vconcat]`,
    '[vconcat]setpts=N/(60*TB)[vout]'
  );
  if (hasAudio) {
    filters.push(`${audioInputs.join('')}concat=n=${clips.length}:v=0:a=1[aout]`);
  }

  const args = [
    '-i',
    inputPath,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[vout]',
    ...(hasAudio ? ['-map', '[aout]'] : []),
    '-vsync',
    '0',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    ...(hasAudio ? ['-c:a', 'aac'] : []),
    ...(hasAudio ? ['-shortest'] : []),
    '-t',
    outputDuration.toString(),
    outputPath
  ];

  const process = convert(outputPath, {onProgress}, args);
  onCancel(() => process.cancel());
  return process;
});
