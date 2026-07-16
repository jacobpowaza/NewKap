import {windowManager} from './manager';
import {BrowserWindow, systemPreferences, dialog, screen, Display, app} from 'electron';

import {settings} from '../common/settings';
import {hasMicrophoneAccess, ensureMicrophonePermissions, openSystemPreferences, ensureScreenCapturePermissions} from '../common/system-permissions';
import {loadRoute} from '../utils/routes';
import {MacWindow} from '../utils/windows';
const croppers = new Map<number, BrowserWindow>();
const readyCroppers = new Set<number>();
let notificationId: number | undefined;
let isOpen = false;
let openingPromise: Promise<void> | undefined;
let isDestroying = false;

const createCropper = (display: Display, activeDisplayId?: number): BrowserWindow => {
  const {id, bounds} = display;
  const {x, y, width, height} = bounds;

  const cropper = new BrowserWindow({
    x,
    y,
    width,
    height,
    hasShadow: false,
    enableLargerThanScreen: true,
    resizable: false,
    movable: false,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false
    }
  });

  loadRoute(cropper, 'cropper');

  cropper.setAlwaysOnTop(true, 'screen-saver', 1);

  cropper.webContents.on('did-finish-load', () => {
    readyCroppers.add(cropper.id);
    sendDisplayInfo(cropper, display, activeDisplayId);
  });

  cropper.on('close', event => {
    if (isDestroying) {
      return;
    }

    event.preventDefault();
    closeAllCroppers();
  });

  cropper.on('closed', () => {
    if (croppers.has(id)) {
      croppers.delete(id);
    }
    readyCroppers.delete(cropper.id);
  });

  croppers.set(id, cropper);
  return cropper;
};

const closeAllCroppers = () => {
  screen.removeAllListeners('display-removed');
  screen.removeAllListeners('display-added');

  for (const cropper of croppers.values()) {
    if (!cropper.isDestroyed()) {
      cropper.webContents.send('hide');
      cropper.hide();
    }
  }

  isOpen = false;

  if (notificationId !== undefined) {
    systemPreferences.unsubscribeWorkspaceNotification(notificationId);
    notificationId = undefined;
  }
};

const destroyAllCroppers = () => {
  isDestroying = true;
  screen.removeAllListeners('display-removed');
  screen.removeAllListeners('display-added');

  for (const [id, cropper] of croppers) {
    cropper.destroy();
    croppers.delete(id);
    readyCroppers.delete(cropper.id);
  }

  isOpen = false;
};

const sendDisplayInfo = (cropper: BrowserWindow, display: Display, activeDisplayId?: number) => {
  const {id, bounds} = display;
  const {x, y, width, height} = bounds;
  const isActive = activeDisplayId === id;

  const displayInfo: any = {
    isActive,
    id,
    x,
    y,
    width,
    height
  };

  if (isActive) {
    const savedCropper = settings.get('cropper', {});
    if ((savedCropper as any).displayId === id) {
      displayInfo.cropper = savedCropper;
    }
  }

  cropper.webContents.send('display', displayInfo);
};

const ensureCroppers = async (activeDisplayId: number): Promise<void> => {
  const displays = screen.getAllDisplays();
  const currentDisplayIds = new Set(displays.map(d => d.id));

  for (const [displayId, cropper] of croppers) {
    if (!currentDisplayIds.has(displayId)) {
      cropper.removeAllListeners('close');
      cropper.removeAllListeners('closed');
      cropper.destroy();
      croppers.delete(displayId);
      readyCroppers.delete(cropper.id);
    }
  }

  const newCropperPromises: Array<Promise<void>> = [];

  for (const display of displays) {
    const existing = croppers.get(display.id);

    if (existing && !existing.isDestroyed()) {
      if (readyCroppers.has(existing.id)) {
        sendDisplayInfo(existing, display, activeDisplayId);
      }
    } else {
      const cropper = createCropper(display, activeDisplayId);
      newCropperPromises.push(
        new Promise<void>(resolve => {
          if (readyCroppers.has(cropper.id)) {
            resolve();
          } else {
            cropper.webContents.once('did-finish-load', () => resolve());
          }
        })
      );
    }
  }

  if (newCropperPromises.length > 0) {
    await Promise.all(newCropperPromises);
  }
};

const openCropperWindow = async () => {
  if (openingPromise) {
    return openingPromise;
  }

  openingPromise = (async () => {
    try {
      closeAllCroppers();
      if (windowManager.editor?.areAnyBlocking()) {
        return;
      }

      if (!ensureScreenCapturePermissions()) {
        return;
      }

      const recordAudio = settings.get('recordAudio');

      if (recordAudio && !hasMicrophoneAccess()) {
        const granted = await ensureMicrophonePermissions(async () => {
          const {response} = await dialog.showMessageBox({
            type: 'warning',
            buttons: ['Open System Preferences', 'Continue'],
            defaultId: 1,
            message: 'Kap cannot access the microphone.',
            detail: 'Audio recording is enabled but Kap does not have access to the microphone. Continue without audio or grant Kap access to the microphone the System Preferences.',
            cancelId: 2
          });

          if (response === 0) {
            openSystemPreferences('Privacy_Microphone');
            return false;
          }

          if (response === 1) {
            settings.set('recordAudio', false);
            return true;
          }

          return false;
        });

        if (!granted) {
          return;
        }
      }

      isOpen = true;

      const activeDisplayId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;

      await ensureCroppers(activeDisplayId);

      for (const cropper of croppers.values()) {
        cropper.showInactive();
      }

      croppers.get(activeDisplayId)?.focus();

      notificationId = (systemPreferences as any).subscribeWorkspaceNotification('NSWorkspaceActiveSpaceDidChangeNotification', () => {
        closeAllCroppers();
      });

      screen.on('display-removed', (_, oldDisplay) => {
        const {id} = oldDisplay;
        const cropper = croppers.get(id);

        if (!cropper) {
          return;
        }

        const wasFocused = cropper.isFocused();

        cropper.removeAllListeners('close');
        cropper.removeAllListeners('closed');
        cropper.destroy();
        croppers.delete(id);
        readyCroppers.delete(cropper.id);

        if (wasFocused) {
          const newActiveId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
          if (croppers.has(newActiveId)) {
            croppers.get(newActiveId)?.focus();
          }
        }
      });

      screen.on('display-added', (_, newDisplay) => {
        const cropper = createCropper(newDisplay);
        cropper.webContents.once('did-finish-load', () => {
          cropper.showInactive();
        });
      });
    } finally {
      openingPromise = undefined;
    }
  })();

  return openingPromise;
};

const preventDefault = (event: any) => event.preventDefault();

const selectApp = async (window: MacWindow, activateWindow: (ownerName: string) => Promise<void>) => {
  for (const cropper of croppers.values()) {
    if (!cropper.isDestroyed()) {
      cropper.prependListener('blur', preventDefault);
    }
  }

  await activateWindow(window.ownerName);

  const {x, y, width, height, ownerName} = window;

  const display = screen.getDisplayMatching({x, y, width, height});
  const {id, bounds: {x: screenX, y: screenY}} = display;

  await new Promise(resolve => setTimeout(resolve, 300));

  for (const cropper of croppers.values()) {
    if (!cropper.isDestroyed()) {
      cropper.removeListener('blur', preventDefault);
      cropper.webContents.send('blur');
    }
  }

  croppers.get(id)?.focus();

  croppers.get(id)?.webContents.send('select-app', {
    ownerName,
    x: x - screenX,
    y: y - screenY,
    width,
    height
  });
};

const disableCroppers = () => {
  if (notificationId !== undefined) {
    systemPreferences.unsubscribeWorkspaceNotification(notificationId);
    notificationId = undefined;
  }

  for (const cropper of croppers.values()) {
    if (!cropper.isDestroyed()) {
      cropper.removeAllListeners('blur');
      cropper.setIgnoreMouseEvents(true);
      cropper.setVisibleOnAllWorkspaces(true);
    }
  }
};

const setRecordingCroppers = () => {
  for (const cropper of croppers.values()) {
    if (!cropper.isDestroyed()) {
      cropper.webContents.send('start-recording');
    }
  }
};

const sendCountdownToCroppers = (value: number) => {
  for (const cropper of croppers.values()) {
    if (!cropper.isDestroyed()) {
      cropper.webContents.send('countdown', value);
    }
  }
};

const isCropperOpen = () => isOpen;

app.on('before-quit', destroyAllCroppers);

app.on('browser-window-created', () => {
  if (!isCropperOpen()) {
    app.dock.show();
  }
});

windowManager.setCropper({
  open: openCropperWindow,
  close: closeAllCroppers,
  selectApp,
  setRecording: setRecordingCroppers,
  isOpen: isCropperOpen,
  disable: disableCroppers,
  sendCountdown: sendCountdownToCroppers
});
