// ============================================================================
// NewKap — Fast Phased Startup
// Phase 1: Show tray icon immediately (< 500ms)
// Phase 2: Load renderer + window modules (background)
// Phase 3: Open cropper + deferred init (background)
// ============================================================================

import {app, Tray} from 'electron';
import path from 'path';

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

app.on('will-finish-launching', () => {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    require('./utils/deep-linking').handleDeepLink(url);
  });
});

app.on('window-all-closed', () => {
  app.dock.hide();
});

// ── Phase 1: Instant tray ───────────────────────────────────────────────────
(async () => {
  await app.whenReady();

  app.dock.hide();
  app.setAboutPanelOptions({copyright: 'Copyright © NewKap Contributors'});

  // Show tray icon IMMEDIATELY — before loading any heavy modules
  const tray = new Tray(path.join(__dirname, '..', 'static', 'menubarDefaultTemplate.png'));

  // Temporary click handler until full tray module loads
  let trayReady = false;
  tray.on('click', () => {
    if (trayReady) {
      return; // Real handler is active
    }

    // If clicked before ready, wait for init then open
    const waitForReady = setInterval(() => {
      if (trayReady) {
        clearInterval(waitForReady);
        const {windowManager} = require('./windows/manager');
        windowManager.cropper?.open();
      }
    }, 100);
  });

  // ── Phase 2: Background initialization ──────────────────────────────────
  setImmediate(async () => {
    // Error handling & logging (lightweight)
    require('./utils/errors').setupErrorHandling();
    require('electron-timber').hookConsole({main: true, renderer: true});
    require('./utils/sentry');

    // Protocol setup (needed before windows load)
    require('./utils/protocol').setupProtocol();

    // Prepare Next.js renderer (instant in production — just sets file protocol)
    const prepareNext = require('electron-next');
    await prepareNext('./renderer');

    // Remote states (lightweight IPC setup)
    require('./remote-states').setupRemoteStates();

    // Load all window modules — registers cropper, editor, etc. with windowManager
    require('./windows/load');

    // Now replace the temporary tray with the full-featured one
    tray.removeAllListeners('click');
    tray.removeAllListeners('right-click');
    const {initializeTray: wireUpTray} = require('./tray');
    wireUpTray(tray);
    trayReady = true;

    // ── Phase 3: Deferred non-critical init ─────────────────────────────
    setImmediate(() => {
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

      // Open cropper window
      const {windowManager} = require('./windows/manager');
      const {settings} = require('./common/settings');
      const {ensureScreenCapturePermissions, hasMicrophoneAccess} = require('./common/system-permissions');

      if (filesToOpen.length > 0) {
        require('./common/analytics').track('editor/opened/startup');
        require('./utils/open-files').openFiles(...filesToOpen);
        require('./recording-history').hasActiveRecording().catch(console.error);
      } else {
        (async () => {
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
        })();
      }

      // Plugin upgrade — fire and forget
      const {is} = require('electron-util');
      if (!is.development) {
        const {plugins} = require('./plugins');
        plugins.upgrade().catch((error: any) => {
          console.log('Plugin upgrade failed (non-fatal):', error);
        });
      }

      // Defer update check even further
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
      }, 10000);

      // enforceMacOSAppLocation intentionally removed:
      // Homebrew installs directly to /Applications, so this check is never needed
      // and showed a confusing "Kap must live in Applications" dialog with wrong branding.
    });
  });
})();

// ── Quit handling ───────────────────────────────────────────────────────────

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

// Handle terminal signals gracefully
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`Received ${signal}, quitting...`);
    onExitCleanupComplete = true;
    app.exit(0);
  });
}
