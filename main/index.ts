import {app, BrowserWindow, Tray, Menu, dialog} from 'electron';
import path from 'path';
import {mark} from './utils/perf';

mark('main module entered');

const _origShowMessageBoxSync = dialog.showMessageBoxSync;
dialog.showMessageBoxSync = function(this: any) {
  const args = Array.from(arguments);
  const opts: any = args.length === 1 ? args[0] : args[1];
  if (opts?.message?.includes('Move to Applications folder') || opts?.message?.includes('Applications folder')) {
    return 1;
  }
  return _origShowMessageBoxSync.apply(dialog, args as any);
} as any;

const _origShowMessageBox = dialog.showMessageBox;
dialog.showMessageBox = function(this: any) {
  const args = Array.from(arguments);
  const opts: any = args.length === 1 ? args[0] : args[1];
  if (opts?.message?.includes('Move to Applications folder') || opts?.message?.includes('Applications folder')) {
    return Promise.resolve({response: 1, checkboxChecked: false});
  }
  return _origShowMessageBox.apply(dialog, args as any);
} as any;

const _origShowErrorBox = dialog.showErrorBox;
dialog.showErrorBox = function(title: string, content: string) {
  if (title?.includes('Move to Applications folder') || title?.includes('Applications folder')) {
    return;
  }
  return _origShowErrorBox.call(dialog, title, content);
} as any;

Object.defineProperty(app, 'isInApplicationsFolder', {
  value: () => true,
  writable: true,
  configurable: true,
});

const filesToOpen: string[] = [];
let onExitCleanupComplete = false;

app.commandLine.appendSwitch('--enable-features', 'OverlayScrollbar');

app.on('open-file', (event, filePath) => {
  event.preventDefault();

  if (app.isReady()) {
    require('./common/analytics').track('editor/opened/running');
    require('./utils/open-files').openFiles(filePath);
  } else {
    filesToOpen.push(filePath);
  }
});

let pendingDeepLink: string | undefined;
let deepLinkReady = false;
let hadDeepLinkOnStartup = false;

export const markDeepLinkReady = () => {
  deepLinkReady = true;
  if (pendingDeepLink) {
    hadDeepLinkOnStartup = true;
    const url = pendingDeepLink;
    pendingDeepLink = undefined;
    require('./utils/deep-linking').handleDeepLink(url);
  }
};

app.on('will-finish-launching', () => {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (deepLinkReady) {
      require('./utils/deep-linking').handleDeepLink(url);
    } else {
      pendingDeepLink = url;
    }
  });
});

app.on('window-all-closed', () => {
  app.dock.hide();
});

(async () => {
  await app.whenReady();
  mark('app.whenReady resolved');

  app.dock.hide();
  app.setAboutPanelOptions({copyright: 'Copyright © NewKap Contributors'});

  const tray = new Tray(path.join(__dirname, '..', 'static', 'menubarDefaultTemplate.png'));
  mark('tray constructed');

  let trayReady = false;
  let pendingOpenCropper = false;

  tray.on('click', () => {
    if (!trayReady) {
      pendingOpenCropper = true;
      return;
    }

    const {windowManager} = require('./windows/manager');
    windowManager.cropper?.open();
  });

  tray.on('right-click', () => {
    if (!trayReady) {
      tray.popUpContextMenu(Menu.buildFromTemplate([
        {label: 'NewKap is loading…', enabled: false}
      ]));
    }
  });

  const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  setImmediate(async () => {
    require('./utils/errors').setupErrorHandling();
    await tick();

    require('./utils/protocol').setupProtocol();

    const prepareNext = require('electron-next');
    await prepareNext('./renderer');

    // Pre-compile the cropper page by loading it in a hidden window.
    // We AWAIT this before trayReady so the main process is never
    // busy compiling when the user interacts (prevents spinner cursor
    // on countdown, instant first open).
    const {is: isDev} = require('electron-util');
    if (isDev.development) {
      const preloadWin = new BrowserWindow({
        show: false,
        webPreferences: {nodeIntegration: true, enableRemoteModule: true, contextIsolation: false}
      });
      await preloadWin.loadURL('http://localhost:8000/cropper');
      preloadWin.destroy();
    }

    await tick();

    require('./remote-states').setupRemoteStates();

    // Phase 2: Only load cropper first — defer all other window modules
    mark('before cropper require');
    require('./windows/cropper');
    mark('cropper module loaded');
    await tick();

    // Now replace the temporary tray with the full-featured one
    tray.removeAllListeners('click');
    tray.removeAllListeners('right-click');
    const {initializeTray: wireUpTray} = require('./tray');
    wireUpTray(tray);
    trayReady = true;
    mark('tray ready');

    if (pendingOpenCropper) {
      pendingOpenCropper = false;
      const {windowManager} = require('./windows/manager');
      windowManager.cropper?.open();
    }

    markDeepLinkReady();

    await tick();

    // Phase 3: Defer non-critical window modules and init
    setImmediate(() => {
      mark('deferred load starting');
      require('./windows/editor');
      require('./windows/config');
      require('./windows/dialog');
      require('./windows/exports');
      require('./windows/preferences');
      mark('deferred windows loaded');
    });

    try { require('electron-timber').hookConsole({main: true, renderer: true}); } catch {}
    await tick();
    try { require('./utils/sentry'); } catch {}
    await tick();

    const {initializeDevices} = require('./utils/devices');
    const {initializeAnalytics} = require('./common/analytics');
    const {initializeGlobalAccelerators} = require('./global-accelerators');
    const {setUpExportsListeners} = require('./export');

    initializeDevices();
    initializeAnalytics();
    initializeGlobalAccelerators();
    setUpExportsListeners();

    if (!app.isDefaultProtocolClient('kap')) {
      app.setAsDefaultProtocolClient('kap');
    }

    await tick();

    const {windowManager} = require('./windows/manager');
    const {settings} = require('./common/settings');
    const {ensureScreenCapturePermissions, hasMicrophoneAccess} = require('./common/system-permissions');

    if (filesToOpen.length > 0) {
      require('./common/analytics').track('editor/opened/startup');
      require('./utils/open-files').openFiles(...filesToOpen);
      require('./recording-history').hasActiveRecording().catch(console.error);
    } else if (hadDeepLinkOnStartup) {
    } else {
      try {
        const {hasActiveRecording} = require('./recording-history');
        if (
          !(await hasActiveRecording()) &&
          !app.getLoginItemSettings().wasOpenedAtLogin &&
          ensureScreenCapturePermissions() &&
          (!settings.get('recordAudio') || hasMicrophoneAccess())
        ) {
          windowManager.cropper?.open();
        }
      } catch (error) {
        console.error('Error during startup permission check:', error);
        windowManager.cropper?.open();
      }
    }

    const {is} = require('electron-util');
    if (!is.development) {
      const {plugins} = require('./plugins');
      plugins.upgrade().catch((error: any) => {
        console.log('Plugin upgrade failed (non-fatal):', error);
      });
    }

    setTimeout(() => {
      if (is.development) {
        return;
      }

      const log = require('electron-log');
      const {autoUpdater} = require('electron-updater');
      const toMilliseconds = require('@sindresorhus/to-milliseconds');

      autoUpdater.logger = log;
      autoUpdater.logger.transports.file.level = 'info';

      const doCheck = async () => {
        try {
          await autoUpdater.checkForUpdates();
        } catch (error) {
          autoUpdater.logger?.error(error);
        }
      };

      setInterval(doCheck, toMilliseconds({hours: 1}));
      doCheck();
    }, 10_000);
  });
})();

const QUIT_TIMEOUT_MS = 5000;

const performQuitCleanup = async () => {
  try {
    const {stopRecordingWithNoEdit} = require('./aperture');
    await stopRecordingWithNoEdit();
  } catch (error) {
    console.error('Error stopping recording on quit:', error);
  }

  try {
    const {cleanPastRecordings} = require('./recording-history');
    cleanPastRecordings();
  } catch (error) {
    console.error('Error cleaning recordings on quit:', error);
  }
};

app.on('before-quit', (event: any) => {
  if (!onExitCleanupComplete) {
    event.preventDefault();

    const forceQuit = setTimeout(() => {
      console.log('Force quitting after timeout');
      onExitCleanupComplete = true;
      app.exit(0);
    }, QUIT_TIMEOUT_MS);

    performQuitCleanup().finally(() => {
      clearTimeout(forceQuit);
      onExitCleanupComplete = true;
      app.quit();
    });
  }
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}, quitting...`);
    onExitCleanupComplete = true;
    app.exit(0);
  });
}
