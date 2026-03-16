import {systemPreferences, shell, dialog, app} from 'electron';
const {ensureDockIsShowing} = require('../utils/dock');

// Safe wrapper for mac-screen-capture-permissions (unreliable on macOS Sonoma+)
let hasScreenCapturePermission: () => boolean;
let hasPromptedForPermission: () => boolean;

const darwinMajor = Number.parseInt(require('os').release().split('.')[0], 10);
const isSonomaOrNewer = darwinMajor >= 23;

if (isSonomaOrNewer) {
  // On Sonoma+, mac-screen-capture-permissions is unreliable — always returns false
  // even when permission is granted. Skip the check and let aperture handle it.
  hasScreenCapturePermission = () => true;
  hasPromptedForPermission = () => true;
} else {
  try {
    const macPerms = require('mac-screen-capture-permissions');
    hasScreenCapturePermission = macPerms.hasScreenCapturePermission;
    hasPromptedForPermission = macPerms.hasPromptedForPermission;
  } catch (error) {
    console.error('mac-screen-capture-permissions failed to load:', error);
    hasScreenCapturePermission = () => true;
    hasPromptedForPermission = () => true;
  }
}

let isDialogShowing = false;

// Use the correct URL scheme for macOS Sonoma+ (System Settings vs System Preferences)
const getSystemSettingsUrl = (privacySection: string) => {
  const majorVersion = Number.parseInt(require('os').release().split('.')[0], 10);
  // macOS Sonoma (14.x) = Darwin 23.x, uses new System Settings URL scheme
  if (majorVersion >= 23) {
    const sectionMap: Record<string, string> = {
      Privacy_Microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
      Privacy_ScreenCapture: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    };
    return sectionMap[privacySection] ?? `x-apple.systempreferences:com.apple.preference.security?${privacySection}`;
  }

  return `x-apple.systempreferences:com.apple.preference.security?${privacySection}`;
};

const promptSystemPreferences = (options: {message: string; detail: string; systemPreferencesPath: string}) => async ({hasAsked}: {hasAsked?: boolean} = {}) => {
  if (hasAsked || isDialogShowing) {
    return false;
  }

  isDialogShowing = true;
  await ensureDockIsShowing(async () => {
    const {response} = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Open System Settings', 'Cancel'],
      defaultId: 0,
      message: options.message,
      detail: options.detail,
      cancelId: 1
    });
    isDialogShowing = false;

    if (response === 0) {
      await openSystemPreferences(options.systemPreferencesPath);
      app.quit();
    }
  });

  return false;
};

export const openSystemPreferences = async (path: string) => shell.openExternal(getSystemSettingsUrl(path));

// Microphone

const getMicrophoneAccess = () => systemPreferences.getMediaAccessStatus('microphone');

const microphoneFallback = promptSystemPreferences({
  message: 'NewKap cannot access the microphone.',
  detail: 'NewKap requires microphone access to be able to record audio. You can grant this in System Settings → Privacy & Security → Microphone. Afterwards, relaunch NewKap.',
  systemPreferencesPath: 'Privacy_Microphone'
});

export const ensureMicrophonePermissions = async (fallback = microphoneFallback) => {
  const access = getMicrophoneAccess();

  if (access === 'granted') {
    return true;
  }

  if (access !== 'denied') {
    const granted = await systemPreferences.askForMediaAccess('microphone');

    if (granted) {
      return true;
    }

    return fallback({hasAsked: true});
  }

  return fallback();
};

export const hasMicrophoneAccess = () => getMicrophoneAccess() === 'granted';

// Screen Capture (10.15 and newer)

const screenCaptureFallback = promptSystemPreferences({
  message: 'NewKap cannot record the screen.',
  detail: 'NewKap requires screen capture access to be able to record the screen. You can grant this in System Settings → Privacy & Security → Screen Recording. Afterwards, relaunch NewKap.',
  systemPreferencesPath: 'Privacy_ScreenCapture'
});

export const ensureScreenCapturePermissions = (fallback = screenCaptureFallback) => {
  try {
    const hadAsked = hasPromptedForPermission();
    const hasAccess = hasScreenCapturePermission();

    if (hasAccess) {
      return true;
    }

    fallback({hasAsked: !hadAsked});
    return false;
  } catch (error) {
    console.error('Screen capture permission check failed:', error);
    // On failure, show the permission prompt rather than silently failing
    fallback({hasAsked: false});
    return false;
  }
};

export const hasScreenCaptureAccess = () => {
  try {
    return hasScreenCapturePermission();
  } catch {
    return false;
  }
};

