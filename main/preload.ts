/* eslint-disable @typescript-eslint/promise-function-async */
import {contextBridge, ipcRenderer} from 'electron';

const windowId = ipcRenderer.sendSync('kap:get-window-id') as number;
const getUniqueId = () => `${Date.now()}-${Math.random()}`;
const getSendChannel = (channel: string) => `%better-ipc-send-channel-${channel}`;
const getRendererSendChannel = (id: number, channel: string) => `%better-ipc-send-channel-${id}-${channel}`;

const serializeError = (value: any, seen = new WeakSet()): any => {
  if (!value || typeof value !== 'object') {
    return typeof value === 'function' ? `[Function: ${value.name || 'anonymous'}]` : value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);
  const serialized: Record<string, any> | any[] = Array.isArray(value) ? [] : {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (typeof nestedValue !== 'function') {
      (serialized as any)[key] = serializeError(nestedValue, seen);
    }
  }

  for (const property of ['name', 'message', 'stack', 'code']) {
    if (typeof value[property] === 'string') {
      (serialized as any)[property] = value[property];
    }
  }

  seen.delete(value);
  return serialized;
};

const deserializeError = (value: any) => {
  if (value instanceof Error) {
    return value;
  }

  const error = new Error(typeof value?.message === 'string' ? value.message : String(value));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.assign(error, value);
  } else {
    error.name = 'NonError';
  }

  return error;
};

const answerMain = <Data, Result>(channel: string, callback: (data: Data) => Result | Promise<Result>) => {
  const sendChannel = getRendererSendChannel(windowId, channel);

  const listener = async (_event: Electron.IpcRendererEvent, data: any) => {
    const {dataChannel, errorChannel, userData} = data;

    try {
      ipcRenderer.send(dataChannel, await callback(userData));
    } catch (error) {
      ipcRenderer.send(errorChannel, serializeError(error));
    }
  };

  ipcRenderer.on(sendChannel, listener);

  return () => {
    ipcRenderer.off(sendChannel, listener);
  };
};

const on = (channel: string, callback: (...args: any[]) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => {
    callback(...args);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.off(channel, listener);
  };
};

const invoke = (channel: string, data?: any) => ipcRenderer.invoke(channel, data);

const callMain = <Data, Result>(channel: string, userData?: Data) => new Promise<Result>((resolve, reject) => {
  const id = getUniqueId();
  const sendChannel = getSendChannel(channel);
  const dataChannel = `%better-ipc-response-data-channel-${channel}-${id}`;
  const errorChannel = `%better-ipc-response-error-channel-${channel}-${id}`;

  const cleanup = () => {
    ipcRenderer.off(dataChannel, handleData);
    ipcRenderer.off(errorChannel, handleError);
  };

  const handleData = (_event: Electron.IpcRendererEvent, result: Result) => {
    cleanup();
    resolve(result);
  };

  const handleError = (_event: Electron.IpcRendererEvent, error: any) => {
    cleanup();
    reject(deserializeError(error));
  };

  ipcRenderer.once(dataChannel, handleData);
  ipcRenderer.once(errorChannel, handleError);
  ipcRenderer.send(sendChannel, {dataChannel, errorChannel, userData});
});

contextBridge.exposeInMainWorld('kap', {
  app: {
    getInfo: () => ipcRenderer.sendSync('kap:app:get-info-sync'),
    getLoginItemSettings: () => invoke('kap:app:get-login-item-settings'),
    setLoginItemSettings: (options: {openAtLogin: boolean}) => invoke('kap:app:set-login-item-settings', options)
  },
  cropper: {
    captureScreenshot: (bounds: {x: number; y: number; width: number; height: number}) => invoke('kap:cropper:capture-screenshot', bounds),
    controlsReady: (payload: {sessionId?: number}) => ipcRenderer.send('cropper-controls-ready', payload),
    rendererReady: (payload?: {sessionId?: number}) => ipcRenderer.send('cropper-renderer-ready', payload),
    startRecording: (options: any) => invoke('kap:cropper:start-recording', options)
  },
  dialog: {
    showMessageBox: (options: Electron.MessageBoxOptions) => invoke('kap:dialog:show-message-box', options),
    showMessageBoxSync: (options: Electron.MessageBoxSyncOptions) => ipcRenderer.sendSync('kap:dialog:show-message-box-sync', options),
    showOpenDialogSync: (options: Electron.OpenDialogSyncOptions) => ipcRenderer.sendSync('kap:dialog:show-open-dialog-sync', options)
  },
  flags: {
    get: (key: string) => ipcRenderer.sendSync('kap:flags:get-sync', key),
    set: (key: string, value: boolean) => invoke('kap:flags:set', {key, value})
  },
  ipc: {
    answerMain,
    callMain,
    on,
    send: (channel: string, data?: any) => ipcRenderer.send(channel, data)
  },
  menu: {
    popup: (template: any[], position?: {x?: number; y?: number}) => invoke('kap:menu:popup', {template, position}),
    popupCog: () => invoke('kap:menu:popup-cog'),
    popupWindows: (selectedApp: string, position?: {x?: number; y?: number}) => invoke('kap:menu:popup-windows', {selectedApp, position})
  },
  nativeImage: {
    createDataUrlThumbnail: (dataUrl: string, size: {width: number; height: number}) => invoke('kap:native-image:create-data-url-thumbnail', {dataUrl, size})
  },
  permissions: {
    ensureMicrophonePermissions: () => invoke('kap:permissions:ensure-microphone')
  },
  plugins: {
    getInstalled: () => invoke('kap:plugins:get-installed'),
    getFromNpm: () => invoke('kap:plugins:get-from-npm'),
    install: (name: string) => invoke('kap:plugins:install', name),
    uninstall: (name: string) => invoke('kap:plugins:uninstall', name),
    openPluginConfig: (name: string) => invoke('kap:plugins:open-config', name),
    getPluginsDir: () => invoke('kap:plugins:get-dir')
  },
  pluginConfig: {
    load: (options: {pluginName: string; serviceTitle?: string}) => invoke('kap:plugin-config:load', options),
    set: (options: {pluginName: string; key: string; value?: any}) => invoke('kap:plugin-config:set', options),
    delete: (options: {pluginName: string; key: string}) => invoke('kap:plugin-config:delete', options),
    openInEditor: (pluginName: string) => invoke('kap:plugin-config:open-in-editor', pluginName),
    viewOnGithub: (pluginName: string) => invoke('kap:plugin-config:view-on-github', pluginName)
  },
  settings: {
    get: (key: string, defaultValue?: any) => ipcRenderer.sendSync('kap:settings:get-sync', {key, defaultValue}),
    getAll: () => ipcRenderer.sendSync('kap:settings:get-all-sync'),
    getSelectedInputDeviceId: () => ipcRenderer.sendSync('kap:settings:get-selected-input-device-id-sync'),
    onDidChange: (key: string, callback: (newValue: any, oldValue: any) => void) => {
      const subscriptionId = `${windowId}-${key}-${Date.now()}-${Math.random()}`;
      void invoke('kap:settings:subscribe', {key, subscriptionId});
      const unsubscribe = on(`kap:settings:changed:${subscriptionId}`, callback);

      return () => {
        unsubscribe();
        void invoke('kap:settings:unsubscribe', subscriptionId);
      };
    },
    set: (key: string, value: any) => invoke('kap:settings:set', {key, value})
  },
  shell: {
    openExternal: (url: string) => invoke('kap:shell:open-external', url),
    openPath: (path: string) => invoke('kap:shell:open-path', path)
  },
  system: {
    getAudioDevices: () => invoke('kap:system:get-audio-devices'),
    getDefaultInputDevice: () => invoke('kap:system:get-default-input-device'),
    getSystemColors: (names: string[]) => ipcRenderer.sendSync('kap:system:get-system-colors-sync', names),
    getUserDefault: (key: string, type: string) => ipcRenderer.sendSync('kap:system:get-user-default-sync', {key, type}),
    isMacosGreaterThanOrEqualTo: (version: string) => ipcRenderer.sendSync('kap:system:is-macos-gte-sync', version),
    onAccentColorChanged: (callback: (_event: unknown, accentColor: string) => void) => on('kap:system:accent-color-changed', callback),
    onAquaColorVariantChanged: (callback: () => void) => on('kap:system:aqua-color-variant-changed', callback),
    onNativeThemeUpdated: (callback: () => void) => on('kap:system:native-theme-updated', callback),
    shouldUseDarkColors: () => ipcRenderer.sendSync('kap:system:should-use-dark-colors-sync')
  },
  track: (event: string) => invoke('kap:analytics:track', event),
  updater: {
    check: () => invoke('kap:updater:check')
  },
  window: {
    close: () => invoke('kap:window:close'),
    getCapabilities: () => invoke('kap:window:get-capabilities'),
    getEditorBounds: () => invoke('kap:window:get-editor-bounds'),
    minimize: () => invoke('kap:window:minimize'),
    setEditorConversionMode: (enabled: boolean) => invoke('kap:window:set-editor-conversion-mode', enabled),
    setIgnoreMouseEvents: (ignore: boolean) => invoke('kap:window:set-ignore-mouse-events', ignore),
    toggleFullScreen: () => invoke('kap:window:toggle-full-screen')
  }
});
