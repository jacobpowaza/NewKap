import {spawn, ChildProcess} from 'child_process';
import path from 'path';
import os from 'os';
import {clipboard, nativeImage} from 'electron';
import {openScreenshotPreview} from './windows/screenshot';

let activeCapture: ChildProcess | undefined;

const getScreenshotPath = () => {
  const timestamp = Date.now();
  return path.join(os.tmpdir(), `kap-screenshot-${timestamp}.png`);
};

export const captureScreenshot = (bounds?: {x: number; y: number; width: number; height: number}) => {
  if (activeCapture) {
    activeCapture.kill();
  }

  const filePath = getScreenshotPath();
  const args = bounds ?
    [
      '-R',
      `${Math.round(bounds.x)},${Math.round(bounds.y)},${Math.round(bounds.width)},${Math.round(bounds.height)}`,
      '-x',
      filePath
    ] :
    ['-i', '-x', filePath];

  activeCapture = spawn('/usr/sbin/screencapture', args, {stdio: 'ignore'});

  activeCapture.once('exit', code => {
    activeCapture = undefined;

    if (code === 0) {
      const image = nativeImage.createFromPath(filePath);
      clipboard.writeImage(image);
      openScreenshotPreview(filePath);
    }
  });
};

export const captureScreenshotToClipboard = (bounds?: {x: number; y: number; width: number; height: number}) => {
  if (activeCapture) {
    activeCapture.kill();
  }

  const filePath = getScreenshotPath();
  const args = bounds ?
    ['-R', `${Math.round(bounds.x)},${Math.round(bounds.y)},${Math.round(bounds.width)},${Math.round(bounds.height)}`, '-x', filePath] :
    ['-x', filePath];

  activeCapture = spawn('/usr/sbin/screencapture', args, {stdio: 'ignore'});

  activeCapture.once('exit', code => {
    activeCapture = undefined;

    if (code === 0) {
      const image = nativeImage.createFromPath(filePath);
      clipboard.writeImage(image);
    }
  });
};
