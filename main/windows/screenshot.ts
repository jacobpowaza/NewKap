import {clipboard, dialog, nativeImage, shell} from 'electron';
import fs from 'fs';
import KapWindow from './kap-window';

interface ScreenshotState {
  filePath: string;
}

interface ScreenshotExport {
  dataUrl: string;
  format: 'png' | 'jpeg' | 'webp';
}

interface ScreenshotSaveResult {
  filePath?: string;
}

const open = async (filePath: string) => {
  const kapWindow = new KapWindow<ScreenshotState>({
    title: 'Screenshot',
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#222222',
    dock: true,
    frame: false,
    route: 'screenshot-preview',
    initialState: {filePath}
  });

  kapWindow.answerRenderer('screenshot-copy-clipboard', ({dataUrl}: ScreenshotExport) => {
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
  });

  kapWindow.answerRenderer('screenshot-save', async ({dataUrl, format}: ScreenshotExport): Promise<ScreenshotSaveResult> => {
    const extension = format === 'jpeg' ? 'jpg' : format;
    const {filePath: outputPath} = await dialog.showSaveDialog(kapWindow.browserWindow, {
      defaultPath: `Screenshot-${Date.now()}.${extension}`,
      filters: [{name: format.toUpperCase(), extensions: [extension]}]
    });

    if (!outputPath) {
      return {};
    }

    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    await fs.promises.writeFile(outputPath, Buffer.from(base64, 'base64'));

    return {filePath: outputPath};
  });

  kapWindow.answerRenderer('screenshot-show-in-folder', ({filePath}: {filePath: string}) => {
    shell.showItemInFolder(filePath);
  });

  return kapWindow;
};

export const openScreenshotPreview = open;
