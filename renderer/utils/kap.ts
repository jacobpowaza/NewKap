const noop = () => undefined;
const asyncNoop = async () => undefined;

const unavailable = {
  app: {
    getInfo: () => ({isPackaged: false, name: 'Kap', version: '0.0.0'}),
    getLoginItemSettings: async () => ({openAtLogin: false}),
    setLoginItemSettings: asyncNoop
  },
  cropper: {
    controlsReady: noop,
    startRecording: asyncNoop
  },
  dialog: {
    showMessageBox: asyncNoop,
    showMessageBoxSync: () => 1,
    showOpenDialogSync: () => undefined
  },
  ipc: {
    answerMain: () => noop,
    callMain: asyncNoop,
    on: () => noop,
    send: noop
  },
  menu: {
    popup: asyncNoop,
    popupCog: asyncNoop,
    popupWindows: asyncNoop
  },
  permissions: {
    ensureMicrophonePermissions: async () => false
  },
  pluginConfig: {
    delete: asyncNoop,
    load: async () => ({values: {}, validators: []}),
    openInEditor: asyncNoop,
    set: asyncNoop,
    viewOnGithub: asyncNoop
  },
  plugins: {
    getFromNpm: async () => [],
    getInstalled: async () => [],
    getPluginsDir: async () => '',
    install: asyncNoop,
    openPluginConfig: asyncNoop,
    uninstall: asyncNoop
  },
  settings: {
    get: (_key: string, defaultValue?: any) => defaultValue,
    getAll: () => ({}),
    getSelectedInputDeviceId: () => undefined,
    onDidChange: () => noop,
    set: asyncNoop
  },
  shell: {
    openExternal: asyncNoop,
    openPath: asyncNoop
  },
  system: {
    getAudioDevices: async () => [],
    getDefaultInputDevice: async () => undefined,
    getSystemColors: (names: string[]) => Object.fromEntries(names.map(name => [name, ''])),
    getUserDefault: () => undefined,
    isMacosGreaterThanOrEqualTo: () => false,
    onAccentColorChanged: () => noop,
    onAquaColorVariantChanged: () => noop,
    onNativeThemeUpdated: () => noop,
    shouldUseDarkColors: () => false
  },
  track: asyncNoop,
  window: {
    close: asyncNoop,
    getCapabilities: async () => ({closable: true, maximizable: true, minimizable: true}),
    getEditorBounds: async () => ({x: 0, y: 0, width: 768, height: 480}),
    minimize: asyncNoop,
    setEditorConversionMode: asyncNoop,
    setIgnoreMouseEvents: asyncNoop,
    toggleFullScreen: asyncNoop
  }
};

const kap = (globalThis as any).kap ?? unavailable;

export default kap;
