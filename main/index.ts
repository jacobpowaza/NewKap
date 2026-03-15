import {app} from 'electron';
import {is, enforceMacOSAppLocation} from 'electron-util';
import log from 'electron-log';
import {autoUpdater} from 'electron-updater';
import toMilliseconds from '@sindresorhus/to-milliseconds';

import './windows/load';
import './utils/sentry';

require('electron-timber').hookConsole({main: true, renderer: true});

import {settings} from './common/settings';
import {plugins} from './plugins';
import {initializeTray} from './tray';
import {initializeDevices} from './utils/devices';
import {initializeAnalytics, track} from './common/analytics';
import {initializeGlobalAccelerators} from './global-accelerators';
import {openFiles} from './utils/open-files';
import {hasMicrophoneAccess, ensureScreenCapturePermissions} from './common/system-permissions';
import {handleDeepLink} from './utils/deep-linking';
import {hasActiveRecording, cleanPastRecordings} from './recording-history';
import {setupRemoteStates} from './remote-states';
import {setUpExportsListeners} from './export';
import {windowManager} from './windows/manager';
import {setupProtocol} from './utils/protocol';
import {stopRecordingWithNoEdit} from './aperture';

const prepareNext = require('electron-next');

const filesToOpen: string[] = [];

let onExitCleanupComplete = false;

app.commandLine.appendSwitch('--enable-features', 'OverlayScrollbar');

app.on('open-file', (event, path) => {
  event.preventDefault();

  if (app.isReady()) {
    track('editor/opened/running');
    openFiles(path);
  } else {
    filesToOpen.push(path);
  }
});

// Non-blocking plugin upgrade — don't block startup
const initializePlugins = () => {
  if (!is.development) {
    // Fire and forget — plugin upgrade happens in background
    plugins.upgrade().catch(error => {
      console.log('Plugin upgrade failed (non-fatal):', error);
    });
  }
};

const checkForUpdates = () => {
  if (is.development) {
    return false;
  }

  const checkForUpdates = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      autoUpdater.logger?.error(error);
    }
  };

  // For auto-update debugging in Console.app
  autoUpdater.logger = log;
  // @ts-expect-error
  autoUpdater.logger.transports.file.level = 'info';

  setInterval(checkForUpdates, toMilliseconds({hours: 1}));

  // Defer first update check so it doesn't block startup
  setTimeout(checkForUpdates, 5000);
  return true;
};

// Prepare the renderer once the app is ready
(async () => {
  await app.whenReady();
  require('./utils/errors').setupErrorHandling();

  // Initialize remote states
  setupRemoteStates();

  setupProtocol();

  app.dock.hide();
  app.setAboutPanelOptions({copyright: 'Copyright © Wulkano'});

  // Ensure the app is in the Applications folder
  enforceMacOSAppLocation();

  await prepareNext('./renderer');

  // Non-blocking initializations — don't await these
  initializePlugins();
  initializeDevices();
  initializeAnalytics();
  initializeTray();
  initializeGlobalAccelerators();
  setUpExportsListeners();

  if (!app.isDefaultProtocolClient('kap')) {
    app.setAsDefaultProtocolClient('kap');
  }

  if (filesToOpen.length > 0) {
    track('editor/opened/startup');
    openFiles(...filesToOpen);
    hasActiveRecording().catch(console.error);
  } else {
    // Don't let permission checks block startup — handle async
    (async () => {
      try {
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
        // Still try to open cropper even if permission check fails
        windowManager.cropper?.open();
      }
    })();
  }

  checkForUpdates();
})();

app.on('window-all-closed', () => {
  app.dock.hide();
  // Don't quit — Kap is a tray app that lives in the menu bar
});

app.on('will-finish-launching', () => {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
});

const QUIT_TIMEOUT_MS = 5000;

const performQuitCleanup = async () => {
  try {
    await stopRecordingWithNoEdit();
  } catch (error) {
    console.error('Error stopping recording on quit:', error);
  }

  try {
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

// Handle terminal signals gracefully
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}, quitting...`);
    onExitCleanupComplete = true;
    app.exit(0);
  });
}
