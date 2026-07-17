import test from 'ava';
import fs from 'fs';
import path from 'path';
import {renderTimeline} from '../main/converters/timeline';
import {getVideoMetadata} from './helpers/video-utils';
import {almostEquals} from './helpers/assertions';

test('timeline composes split, adjusted, and frozen clips with audio', async t => {
  const outputPath = await renderTimeline({
    inputPath: path.resolve(__dirname, 'fixtures', 'input@2x.mp4'),
    hasAudio: true,
    onProgress: () => {},
    clips: [
      {id: 'first', startTime: 0, endTime: 1, speed: 2, brightness: 0.1, contrast: 1.1, saturation: 0.9},
      {id: 'freeze', startTime: 1, endTime: 1.04, freezeDuration: 1, speed: 1, brightness: 0, contrast: 1, saturation: 1},
      {id: 'last', startTime: 2, endTime: 3, speed: 1, brightness: 0, contrast: 1, saturation: 1}
    ]
  });

  try {
    const metadata = await getVideoMetadata(outputPath);
    t.true(metadata.hasAudio);
    t.true(almostEquals(metadata.duration, 2.5, 0.15));
  } finally {
    await fs.promises.unlink(outputPath);
  }
});
