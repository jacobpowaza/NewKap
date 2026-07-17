import {ipcMain} from 'electron';

import {ipcMain as ipc} from 'electron-better-ipc';
import {track} from '../common/analytics';
import KapWindow from './kap-window';
import {windowManager} from './manager';

let prefsKapWindow: KapWindow | undefined;

export type PreferencesWindowOptions = any;

const openPrefsWindow = async (options?: PreferencesWindowOptions) => {
  track('preferences/opened');
  windowManager.cropper?.close();

  const prefsWindow = prefsKapWindow?.browserWindow;
  if (prefsWindow) {
    if (options) {
      ipc.callRenderer(prefsWindow, 'options', options);
    }

    prefsWindow.show();
    prefsWindow.focus();
    return prefsWindow;
  }

  const newPrefsKapWindow = new KapWindow({
    title: 'Preferences',
    width: 620,
    height: 620,
    minWidth: 560,
    minHeight: 520,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hiddenInset',
    show: false,
    frame: false,
    transparent: true,
    vibrancy: 'window',
    dock: true,
    route: 'preferences'
  });
  prefsKapWindow = newPrefsKapWindow;

  const newPrefsWindow = newPrefsKapWindow.browserWindow;

  const titlebarHeight = 85;
  newPrefsWindow.setSheetOffset(titlebarHeight);

  newPrefsWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[preferences] render process gone', details);
  });

  const rendererReadyPromise = new Promise<void>(resolve => {
    const handleReady = (event: Electron.IpcMainEvent) => {
      if (event.sender === newPrefsWindow.webContents) {
        ipcMain.removeListener('preferences-renderer-ready', handleReady);
        resolve();
      }
    };

    ipcMain.on('preferences-renderer-ready', handleReady);
    newPrefsWindow.once('closed', () => ipcMain.removeListener('preferences-renderer-ready', handleReady));
  });

  newPrefsWindow.on('close', () => {
    prefsKapWindow = undefined;
  });

  await Promise.race([
    rendererReadyPromise,
    new Promise(resolve => {
      setTimeout(resolve, 500);
    })
  ]);

  if (options) {
    ipc.callRenderer(newPrefsWindow, 'options', options);
  }

  await newPrefsKapWindow.whenReady();
  return newPrefsWindow;
};

const closePrefsWindow = () => {
  prefsKapWindow?.browserWindow.close();
};

ipc.answerRenderer('open-preferences', openPrefsWindow);

windowManager.setPreferences({
  open: openPrefsWindow,
  close: closePrefsWindow
});
