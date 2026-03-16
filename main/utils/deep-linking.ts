import {app, screen, dialog, shell} from 'electron';
import {windowManager} from '../windows/manager';

const pluginPromises = new Map<string, (path: string) => void>();

const handlePluginsDeepLink = (path: string) => {
  const [plugin, ...rest] = path.split('/');

  if (pluginPromises.has(plugin)) {
    pluginPromises.get(plugin)?.(rest.join('/'));
    pluginPromises.delete(plugin);
    return;
  }

  console.error(`Received link for plugin "${plugin}" but there was no registered listener.`);
};

export const addPluginPromise = (plugin: string, resolveFunction: (path: string) => void) => {
  pluginPromises.set(plugin, resolveFunction);
};

const triggerPluginAction = (action: string) => (name: string) => windowManager.preferences?.open({target: {name, action}});

// Show a user-friendly dialog when recording fails due to missing permission
const showPermissionError = async () => {
  const {response} = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Open System Settings', 'OK'],
    defaultId: 0,
    message: 'Screen Recording permission required',
    detail: 'NewKap needs Screen Recording permission to record.\n\n1. Click "Open System Settings"\n2. Find "NewKap" and toggle it ON\n3. Quit and relaunch NewKap\n\nIf NewKap is already listed but recording still fails, toggle it OFF then ON again, then quit and relaunch.'
  });

  if (response === 0) {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
  }
};

// Start full-screen recording on the display under the cursor
const handleRecordFullScreen = async () => {
  try {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const {width, height} = display.bounds;

    const {startRecording} = require('../aperture');
    await startRecording({
      cropperBounds: {x: 0, y: 0, width, height},
      screenBounds: {width, height},
      displayId: display.id
    });

    console.log(`Full-screen recording started on display ${display.id} (${width}x${height})`);
  } catch (error: any) {
    console.error('Failed to start full-screen recording:', error);
    // Check for permission-related errors
    const errorStr = String(error?.message || error);
    if (errorStr.includes('Cannot Record') || errorStr.includes('-11805') || errorStr.includes('not authorized')) {
      await showPermissionError();
    }
  }
};

// Stop recording if one is active
const handleStopRecording = async () => {
  try {
    const {stopRecording} = require('../aperture');
    await stopRecording();
  } catch (error) {
    console.error('Failed to stop recording:', error);
  }
};

// Toggle: start full-screen recording if idle, stop recording + quit if recording
const handleToggleRecording = async () => {
  try {
    const {isPast} = require('../aperture');
    if (isPast()) {
      await handleStopRecording();
      // Give the editor a moment to open, then quit
      setTimeout(() => app.quit(), 1500);
    } else {
      await handleRecordFullScreen();
    }
  } catch (error) {
    console.error('Failed to toggle recording:', error);
  }
};

const routes = new Map<string, (path: string) => void | Promise<void>>([
  ['plugins', handlePluginsDeepLink],
  ['install-plugin', triggerPluginAction('install')],
  ['configure-plugin', triggerPluginAction('configure')],
  ['record', handleRecordFullScreen as any],
  ['stop', handleStopRecording as any],
  ['toggle', handleToggleRecording as any]
]);

export const handleDeepLink = (url: string) => {
  const {host, pathname} = new URL(url);

  if (routes.has(host)) {
    return routes.get(host)?.(pathname.slice(1));
  }

  console.error(`Route not recognized: ${host} (${url}).`);
};
