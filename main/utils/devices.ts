import {hasMicrophoneAccess} from '../common/system-permissions';
import * as audioDevices from 'macos-audio-devices';
import {settings} from '../common/settings';
import {defaultInputDeviceId} from '../common/constants';
import Sentry from './sentry';
const aperture = require('aperture');

let cachedDevices: Array<{id: string; name: string}> | undefined;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10000;

let cachedDefaultDeviceId: string | undefined;
let defaultDeviceCacheTimestamp = 0;
const DEFAULT_DEVICE_CACHE_TTL = 30000;

const setCachedDefaultDeviceId = (deviceId: string | undefined) => {
  cachedDefaultDeviceId = deviceId;
  defaultDeviceCacheTimestamp = Date.now();
};

export const getAudioDevices = async () => {
  if (!hasMicrophoneAccess()) {
    return [];
  }

  if (cachedDevices && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedDevices;
  }

  try {
    const devices = await audioDevices.getInputDevices();

    cachedDevices = devices.sort((a, b) => {
      if (a.transportType === b.transportType) {
        return a.name.localeCompare(b.name);
      }

      if (a.transportType === 'builtin') {
        return -1;
      }

      if (b.transportType === 'builtin') {
        return 1;
      }

      return 0;
    }).map(device => ({id: device.uid, name: device.name}));
    cacheTimestamp = Date.now();
    return cachedDevices;
  } catch (error) {
    try {
      const devices = await aperture.audioDevices();

      if (!Array.isArray(devices)) {
        Sentry.captureException(new Error(`devices is not an array: ${JSON.stringify(devices)}`));
        console.error('Audio device error:', error);
        return cachedDevices ?? [];
      }

      cachedDevices = devices;
      cacheTimestamp = Date.now();
      return devices;
    } catch (fallbackError) {
      console.error('Audio device fallback also failed:', fallbackError);
      return cachedDevices ?? [];
    }
  }
};

export const getDefaultInputDevice = () => {
  try {
    const device = audioDevices.getDefaultInputDevice.sync();
    setCachedDefaultDeviceId(device.uid);
    return {
      id: device.uid,
      name: device.name
    };
  } catch {
    return undefined;
  }
};

export const getCachedAudioDeviceId = () => {
  if (!hasMicrophoneAccess()) {
    return undefined;
  }

  const audioInputDeviceId = settings.get('audioInputDeviceId', defaultInputDeviceId);

  if (audioInputDeviceId === defaultInputDeviceId) {
    if (cachedDefaultDeviceId && (Date.now() - defaultDeviceCacheTimestamp) < DEFAULT_DEVICE_CACHE_TTL) {
      return cachedDefaultDeviceId;
    }

    return undefined;
  }

  return audioInputDeviceId;
};

export const getRecordingAudioDeviceId = async () => {
  const cachedAudioDeviceId = getCachedAudioDeviceId();
  if (cachedAudioDeviceId) {
    return cachedAudioDeviceId;
  }

  if (!hasMicrophoneAccess()) {
    return undefined;
  }

  const audioInputDeviceId = settings.get('audioInputDeviceId', defaultInputDeviceId);
  if (audioInputDeviceId !== defaultInputDeviceId) {
    return audioInputDeviceId;
  }

  try {
    const device = await audioDevices.getDefaultInputDevice();
    setCachedDefaultDeviceId(device.uid);
    return device.uid;
  } catch {
    const [defaultAudioDevice] = await getAudioDevices();
    setCachedDefaultDeviceId(defaultAudioDevice?.id);
    return defaultAudioDevice?.id;
  }
};

export const getSelectedInputDeviceId = () => {
  const audioInputDeviceId = settings.get('audioInputDeviceId', defaultInputDeviceId);

  if (audioInputDeviceId === defaultInputDeviceId) {
    const device = getDefaultInputDevice();
    return device?.id;
  }

  return audioInputDeviceId;
};

export const initializeDevices = async () => {
  try {
    const audioInputDeviceId = settings.get('audioInputDeviceId');

    if (hasMicrophoneAccess()) {
      const [devices] = await Promise.all([
        getAudioDevices(),
        getRecordingAudioDeviceId()
      ]);

      if (!devices.some((device: any) => device.id === audioInputDeviceId)) {
        settings.set('audioInputDeviceId', defaultInputDeviceId);
      }
    }
  } catch (error) {
    console.error('Device initialization failed (non-fatal):', error);
  }
};
