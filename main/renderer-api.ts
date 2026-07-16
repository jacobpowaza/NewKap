/* eslint-disable @typescript-eslint/promise-function-async, unicorn/no-array-callback-reference */
import {app, BrowserWindow, dialog, ipcMain, Menu, MenuItem, nativeImage, nativeTheme, shell, systemPreferences} from 'electron';
import type {MenuItemConstructorOptions} from 'electron';
import {settings} from './common/settings';
import {track} from './common/analytics';
import {ensureMicrophonePermissions} from './common/system-permissions';
import {plugins} from './plugins';
import {InstalledPlugin, NpmPlugin} from './plugins/plugin';
import {getAudioDevices, getDefaultInputDevice, getSelectedInputDeviceId} from './utils/devices';
import {showError} from './utils/errors';
import {activateApp, MacWindow} from './utils/windows';
import {getCogMenuAsync} from './menus/cog';
import {startRecording} from './aperture';

const CONVERSION_WIDTH = 370;
const CONVERSION_HEIGHT = 392;

const previousEditorWindowSizes = new Map<number, {width: number; height: number}>();
const settingsSubscriptions = new Map<string, () => void>();

const resizeKeepingCenter = (
  bounds: Electron.Rectangle,
  size: {width: number; height: number}
) => ({
  ...size,
  x: Math.round(bounds.x + ((bounds.width - size.width) / 2)),
  y: Math.round(bounds.y + ((bounds.height - size.height) / 2))
});

const getSenderWindow = (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    throw new Error('No BrowserWindow for IPC sender');
  }

  return window;
};

const serializePlugin = (plugin: InstalledPlugin | NpmPlugin) => ({
  description: plugin.description,
  hasConfig: 'hasConfig' in plugin ? plugin.hasConfig : false,
  isCompatible: plugin.isCompatible,
  isInstalled: 'isInstalled' in plugin ? plugin.isInstalled : false,
  isSymlink: 'isSymLink' in plugin ? plugin.isSymLink : false,
  isValid: 'isValid' in plugin ? plugin.isValid : true,
  kapVersion: plugin.kapVersion,
  link: plugin.link,
  macosVersion: plugin.macosVersion,
  name: plugin.name,
  prettyName: plugin.prettyName,
  version: plugin.version
});

const serializeValidationErrors = (errors: any) => {
  if (!errors) {
    return undefined;
  }

  return errors.map((error: any) => ({
    dataPath: error.dataPath,
    message: error.message
  }));
};

const loadPluginConfig = ({pluginName, serviceTitle}: {pluginName: string; serviceTitle?: string}) => {
  const plugin = new InstalledPlugin(pluginName);
  const validators = serviceTitle ?
    plugin.config.validators.filter(({title}) => title === serviceTitle) :
    plugin.config.validators;

  for (const validator of validators) {
    validator.validate(plugin.config.store);
  }

  return {
    plugin: serializePlugin(plugin),
    values: plugin.config.store,
    validators: validators.map(validator => ({
      config: validator.config,
      description: validator.description,
      errors: serializeValidationErrors(validator.validate.errors),
      title: validator.title
    }))
  };
};

const getWindowList = async () => {
  const {getWindows} = require('mac-windows');
  const {getAppIconListByPid} = require('node-mac-app-icon');
  const windows = await getWindows() as MacWindow[];
  const images = await getAppIconListByPid(windows.map(win => win.pid), {
    size: 16,
    failOnError: false
  }) as Array<{pid: number; icon: Buffer}>;

  return windows
    .filter(window => !['Kap', 'Kap Beta'].includes(window.ownerName))
    .map(window => {
      const iconImage = images.find(img => img.pid === window.pid);
      const icon = iconImage?.icon ? nativeImage.createFromBuffer(iconImage.icon).resize({width: 16, height: 16}).toDataURL() : undefined;

      return {
        ...window,
        icon
      };
    })
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName));
};

const sanitizeMenuTemplate = (template: any[]): MenuItemConstructorOptions[] => template.map((item, index) => {
  if (item.type === 'separator' || item.separator) {
    return {type: 'separator'};
  }

  const sanitized: MenuItemConstructorOptions = {
    checked: item.checked,
    enabled: item.enabled,
    label: item.label,
    type: item.type,
    click: item.actionId ? (menuItem, browserWindow) => {
      (browserWindow as BrowserWindow | undefined)?.webContents.send('kap:menu:action', item.actionId, {checked: menuItem.checked, index});
    } : undefined
  };

  if (item.iconDataUrl) {
    sanitized.icon = nativeImage.createFromDataURL(item.iconDataUrl);
  }

  if (item.submenu ?? item.subMenu) {
    sanitized.submenu = sanitizeMenuTemplate(item.submenu ?? item.subMenu);
  }

  return sanitized;
});

export const setupRendererApi = () => {
  ipcMain.on('kap:get-window-id', event => {
    event.returnValue = getSenderWindow(event).id;
  });

  ipcMain.handle('kap:analytics:track', (_event, name: string) => track(name));
  ipcMain.handle('kap:app:get-info', () => ({
    isPackaged: app.isPackaged,
    name: app.name,
    version: app.getVersion()
  }));
  ipcMain.on('kap:app:get-info-sync', event => {
    event.returnValue = {
      isPackaged: app.isPackaged,
      name: app.name,
      version: app.getVersion()
    };
  });
  ipcMain.handle('kap:app:get-login-item-settings', () => app.getLoginItemSettings());
  ipcMain.handle('kap:app:set-login-item-settings', (_event, options: {openAtLogin: boolean}) => app.setLoginItemSettings(options));
  ipcMain.handle('kap:cropper:start-recording', (_event, options: any) => startRecording(options));

  ipcMain.handle('kap:dialog:show-message-box', (event, options: Electron.MessageBoxOptions) => dialog.showMessageBox(getSenderWindow(event), options));
  ipcMain.on('kap:dialog:show-message-box-sync', (event, options: Electron.MessageBoxSyncOptions) => {
    event.returnValue = dialog.showMessageBoxSync(getSenderWindow(event), options);
  });
  ipcMain.on('kap:dialog:show-open-dialog-sync', (event, options: Electron.OpenDialogSyncOptions) => {
    event.returnValue = dialog.showOpenDialogSync(getSenderWindow(event), options);
  });

  ipcMain.handle('kap:menu:popup', (event, {template, position}: {template: any[]; position?: {x?: number; y?: number}}) => {
    Menu.buildFromTemplate(sanitizeMenuTemplate(template)).popup({
      window: getSenderWindow(event),
      ...position
    });
  });
  ipcMain.handle('kap:menu:popup-cog', async event => {
    (await getCogMenuAsync()).popup({window: getSenderWindow(event)});
  });
  ipcMain.handle('kap:menu:popup-windows', async (event, {selectedApp, position}: {selectedApp: string; position?: {x?: number; y?: number}}) => {
    const menu = new Menu();
    const windows = await getWindowList();

    for (const win of windows) {
      const item = new MenuItem({
        label: win.ownerName,
        icon: win.icon ? nativeImage.createFromDataURL(win.icon) : undefined,
        type: 'checkbox',
        checked: win.ownerName === selectedApp,
        click: () => activateApp(win)
      });
      menu.append(item);
    }

    menu.popup({window: getSenderWindow(event), ...position});
  });

  ipcMain.handle('kap:native-image:create-data-url-thumbnail', (_event, {dataUrl, size}: {dataUrl: string; size: {width: number; height: number}}) => {
    return nativeImage.createFromDataURL(dataUrl).resize(size).toDataURL();
  });

  ipcMain.handle('kap:permissions:ensure-microphone', () => ensureMicrophonePermissions());
  ipcMain.handle('kap:plugins:get-installed', () => {
    void plugins.allPlugins;
    return plugins.installedPlugins.sort((a, b) => a.prettyName.localeCompare(b.prettyName)).map(serializePlugin);
  });
  ipcMain.handle('kap:plugins:get-from-npm', async () => (await plugins.getFromNpm()).map(serializePlugin));
  ipcMain.handle('kap:plugins:install', async (_event, name: string) => {
    const plugin = await plugins.install(name);
    return plugin ? serializePlugin(plugin) : undefined;
  });
  ipcMain.handle('kap:plugins:uninstall', async (_event, name: string) => serializePlugin(await plugins.uninstall(name)));
  ipcMain.handle('kap:plugins:open-config', (_event, name: string) => plugins.openPluginConfig(name));
  ipcMain.handle('kap:plugins:get-dir', () => plugins.pluginsDir);

  ipcMain.handle('kap:plugin-config:load', (_event, options: {pluginName: string; serviceTitle?: string}) => loadPluginConfig(options));
  ipcMain.handle('kap:plugin-config:set', (_event, {pluginName, key, value}: {pluginName: string; key: string; value: any}) => {
    const plugin = new InstalledPlugin(pluginName);
    plugin.config.set(key, value);
    return loadPluginConfig({pluginName});
  });
  ipcMain.handle('kap:plugin-config:delete', (_event, {pluginName, key}: {pluginName: string; key: string}) => {
    const plugin = new InstalledPlugin(pluginName);
    plugin.config.delete(key);
    return loadPluginConfig({pluginName});
  });
  ipcMain.handle('kap:plugin-config:open-in-editor', (_event, pluginName: string) => new InstalledPlugin(pluginName).config.openInEditor());
  ipcMain.handle('kap:plugin-config:view-on-github', (_event, pluginName: string) => new InstalledPlugin(pluginName).viewOnGithub());

  ipcMain.handle('kap:settings:get', (_event, {key, defaultValue}: {key: string; defaultValue?: any}) => settings.get(key as any, defaultValue));
  ipcMain.handle('kap:settings:get-all', () => settings.store);
  ipcMain.handle('kap:settings:get-selected-input-device-id', () => getSelectedInputDeviceId());
  ipcMain.handle('kap:settings:set', (_event, {key, value}: {key: string; value: any}) => settings.set(key as any, value));
  ipcMain.on('kap:settings:get-sync', (event, {key, defaultValue}: {key: string; defaultValue?: any}) => {
    event.returnValue = settings.get(key as any, defaultValue);
  });
  ipcMain.on('kap:settings:get-all-sync', event => {
    event.returnValue = settings.store;
  });
  ipcMain.on('kap:settings:get-selected-input-device-id-sync', event => {
    event.returnValue = getSelectedInputDeviceId();
  });
  ipcMain.handle('kap:settings:subscribe', (event, {key, subscriptionId}: {key: string; subscriptionId: string}) => {
    const window = getSenderWindow(event);
    const unsubscribe = settings.onDidChange(key as any, (newValue, oldValue) => {
      if (!window.isDestroyed()) {
        window.webContents.send(`kap:settings:changed:${subscriptionId}`, newValue, oldValue);
      }
    });
    settingsSubscriptions.set(subscriptionId, unsubscribe);
  });
  ipcMain.handle('kap:settings:unsubscribe', (_event, subscriptionId: string) => {
    settingsSubscriptions.get(subscriptionId)?.();
    settingsSubscriptions.delete(subscriptionId);
  });

  ipcMain.handle('kap:shell:open-external', (_event, url: string) => shell.openExternal(url));
  ipcMain.handle('kap:shell:open-path', (_event, filePath: string) => shell.openPath(filePath));
  ipcMain.handle('kap:system:get-audio-devices', () => getAudioDevices());
  ipcMain.handle('kap:system:get-default-input-device', () => getDefaultInputDevice());
  ipcMain.handle('kap:system:get-system-colors', (_event, names: string[]) => Object.fromEntries(names.map(name => [name, systemPreferences.getColor(name as any)])));
  ipcMain.handle('kap:system:get-user-default', (_event, {key, type}: {key: string; type: string}) => systemPreferences.getUserDefault(key, type as any));
  ipcMain.handle('kap:system:is-macos-gte', (_event, version: string) => require('macos-version').isGreaterThanOrEqualTo(version));
  ipcMain.on('kap:system:get-system-colors-sync', (event, names: string[]) => {
    event.returnValue = Object.fromEntries(names.map(name => [name, systemPreferences.getColor(name as any)]));
  });
  ipcMain.on('kap:system:get-user-default-sync', (event, {key, type}: {key: string; type: string}) => {
    event.returnValue = systemPreferences.getUserDefault(key, type as any);
  });
  ipcMain.on('kap:system:is-macos-gte-sync', (event, version: string) => {
    event.returnValue = require('macos-version').isGreaterThanOrEqualTo(version);
  });
  ipcMain.on('kap:system:should-use-dark-colors-sync', event => {
    event.returnValue = nativeTheme.shouldUseDarkColors;
  });

  systemPreferences.on('accent-color-changed', (_event, accentColor) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('kap:system:accent-color-changed', undefined, accentColor);
    }
  });

  if (process.platform === 'darwin') {
    (systemPreferences as any).subscribeNotification('AppleAquaColorVariantChanged', () => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('kap:system:aqua-color-variant-changed');
      }
    });
  }

  nativeTheme.on('updated', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('kap:system:native-theme-updated');
    }
  });

  ipcMain.handle('kap:window:close', event => getSenderWindow(event).close());
  ipcMain.handle('kap:window:get-capabilities', event => {
    const window = getSenderWindow(event);
    return {
      closable: window.closable,
      maximizable: window.maximizable,
      minimizable: window.minimizable
    };
  });
  ipcMain.handle('kap:window:get-editor-bounds', event => getSenderWindow(event).getBounds());
  ipcMain.handle('kap:window:minimize', event => getSenderWindow(event).minimize());
  ipcMain.handle('kap:window:set-editor-conversion-mode', (event, enabled: boolean) => {
    const window = getSenderWindow(event);
    const bounds = window.getBounds();

    if (enabled) {
      previousEditorWindowSizes.set(window.id, {width: bounds.width, height: bounds.height});
      window.setBounds(resizeKeepingCenter(bounds, {width: CONVERSION_WIDTH, height: CONVERSION_HEIGHT}), true);
      window.resizable = false;
      window.fullScreenable = false;
    } else {
      window.resizable = true;
      window.fullScreenable = true;
      window.setBounds(resizeKeepingCenter(bounds, previousEditorWindowSizes.get(window.id) ?? {width: 768, height: 480}), true);
    }
  });
  ipcMain.handle('kap:window:set-ignore-mouse-events', (event, ignore: boolean) => getSenderWindow(event).setIgnoreMouseEvents(ignore));
  ipcMain.handle('kap:window:toggle-full-screen', event => {
    const window = getSenderWindow(event);
    window.setFullScreen(!window.isFullScreen());
  });

  process.on('uncaughtException', error => showError(error as any));
};
