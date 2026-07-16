import {Container} from 'unstated';
import kap from '../utils/kap';
import {ipcRenderer as ipc} from '../utils/ipc';

const SETTINGS_ANALYTICS_BLACKLIST = ['kapturesDir'];

export default class PreferencesContainer extends Container {
  state = {
    category: 'general',
    tab: 'discover',
    isMounted: false
  };

  mount = async setOverlay => {
    this.setOverlay = setOverlay;
    this.settings = kap.settings;
    this.defaultInputDeviceId = 'SYSTEM_DEFAULT';
    this.systemPermissions = kap.permissions;
    this.plugins = kap.plugins;
    this.track = kap.track;
    this.showError = error => console.error(error);

    const pluginsInstalled = await this.plugins.getInstalled();

    this.fetchFromNpm();

    const currentSettings = this.settings.getAll();

    this.setState({
      shortcuts: {},
      ...currentSettings,
      countdownDuration: currentSettings.showCountdown ? currentSettings.countdownDuration : 0,
      openOnStartup: (await kap.app.getLoginItemSettings()).openAtLogin,
      pluginsInstalled,
      isMounted: true,
      shortcutMap: {
        triggerCropper: 'Start Recording',
        stopRecording: 'Stop Recording',
        pauseRecording: 'Pause Recording'
      }
    });

    if (currentSettings.recordAudio) {
      this.getAudioDevices();
    }
  };

  getAudioDevices = async () => {
    const {audioInputDeviceId} = this.settings.getAll();
    const {name: currentDefaultName} = await kap.system.getDefaultInputDevice() || {};

    const audioDevices = await kap.system.getAudioDevices();
    const updates = {
      audioDevices: [
        {name: `System Default${currentDefaultName ? ` (${currentDefaultName})` : ''}`, id: this.defaultInputDeviceId},
        ...audioDevices
      ],
      audioInputDeviceId
    };

    if (!audioDevices.some(device => device.id === audioInputDeviceId)) {
      updates.audioInputDeviceId = this.defaultInputDeviceId;
      this.settings.set('audioInputDeviceId', this.defaultInputDeviceId);
    }

    this.setState(updates);
  };

  scrollIntoView = (tabId, pluginId) => {
    const plugin = document.querySelector(`#${tabId} #${pluginId}`).parentElement;
    plugin.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    });
  };

  openTarget = target => {
    const isInstalled = this.state.pluginsInstalled.some(plugin => plugin.name === target.name);
    const isFromNpm = this.state.pluginsFromNpm && this.state.pluginsFromNpm.some(plugin => plugin.name === target.name);

    if (target.action === 'install') {
      if (isInstalled) {
        this.scrollIntoView(this.state.tab, target.name);
        this.setState({category: 'plugins'});
      } else if (isFromNpm) {
        this.scrollIntoView('discover', target.name);
        this.setState({category: 'plugins', tab: 'discover'});

        const buttonIndex = kap.dialog.showMessageBoxSync({
          type: 'question',
          buttons: [
            'Install',
            'Cancel'
          ],
          defaultId: 0,
          cancelId: 1,
          message: `Do you want to install the “${target.name}” plugin?`
        });

        if (buttonIndex === 0) {
          this.install(target.name);
        }
      } else {
        this.setState({category: 'plugins'});
      }
    } else if (target.action === 'configure' && isInstalled) {
      this.openPluginsConfig(target.name);
    } else {
      this.setState({category: 'plugins'});
    }
  };

  setNavigation = ({category, tab, target}) => {
    if (target) {
      if (this.state.isMounted) {
        this.openTarget(target);
      } else {
        this.setState({target});
      }
    } else {
      this.setState({category, tab});
    }
  };

  fetchFromNpm = async () => {
    try {
      const plugins = await this.plugins.getFromNpm();
      this.setState({
        npmError: false,
        pluginsFromNpm: plugins.sort((a, b) => {
          if (a.isCompatible !== b.isCompatible) {
            return b.isCompatible - a.isCompatible;
          }

          return a.prettyName.localeCompare(b.prettyName);
        })
      });

      if (this.state.target) {
        this.openTarget(this.state.target);
        this.setState({target: undefined});
      }
    } catch (error) {
      console.error('[preferences] failed to load plugin catalog', error);
      this.setState({npmError: true});
    }
  };

  togglePlugin = plugin => {
    if (plugin.isInstalled) {
      this.uninstall(plugin.name);
    } else {
      this.install(plugin.name);
    }
  };

  install = async name => {
    const {pluginsInstalled, pluginsFromNpm} = this.state;

    this.setState({pluginBeingInstalled: name});
    const result = await this.plugins.install(name);

    if (result) {
      this.setState({
        pluginBeingInstalled: undefined,
        pluginsFromNpm: pluginsFromNpm.filter(p => p.name !== name),
        pluginsInstalled: [result, ...pluginsInstalled].sort((a, b) => a.prettyName.localeCompare(b.prettyName))
      });
    } else {
      this.setState({
        pluginBeingInstalled: undefined
      });
    }
  };

  uninstall = async name => {
    const {pluginsInstalled, pluginsFromNpm} = this.state;

    const onTransitionEnd = async () => {
      const plugin = await this.plugins.uninstall(name);
      this.setState({
        pluginsInstalled: pluginsInstalled.filter(p => p.name !== name),
        pluginsFromNpm: [plugin, ...pluginsFromNpm].sort((a, b) => a.prettyName.localeCompare(b.prettyName)),
        pluginBeingUninstalled: null,
        onTransitionEnd: null
      });
    };

    this.setState({pluginBeingUninstalled: name, onTransitionEnd});
  };

  openPluginsConfig = async name => {
    this.track(`plugin/config/${name}`);
    this.scrollIntoView('installed', name);
    this.setState({category: 'plugins'});
    this.setOverlay(true);
    await this.plugins.openPluginConfig(name);
    ipc.callMain('refresh-usage');
    this.setOverlay(false);
  };

  openPluginsFolder = async () => kap.shell.openPath(await this.plugins.getPluginsDir());

  selectCategory = category => {
    this.setState({category});
  };

  selectTab = tab => {
    this.track(`preferences/tab/${tab}`);
    this.setState({tab});
  };

  toggleSetting = (setting, value) => {
    const newValue = value === undefined ? !this.state[setting] : value;
    if (!SETTINGS_ANALYTICS_BLACKLIST.includes(setting)) {
      this.track(`preferences/setting/${setting}/${newValue}`);
    }

    this.setState({[setting]: newValue});
    this.settings.set(setting, newValue);
  };

  setCountdownDuration = value => {
    const duration = Math.max(0, Math.min(60, Number.parseInt(value || 0, 10) || 0));

    this.track(`preferences/setting/countdownDuration/${duration}`);
    this.setState({
      countdownDuration: duration,
      showCountdown: duration > 0
    });
    this.settings.set('countdownDuration', duration);
    this.settings.set('showCountdown', duration > 0);
  };

  toggleRecordAudio = async () => {
    const newValue = !this.state.recordAudio;
    this.track(`preferences/setting/recordAudio/${newValue}`);

    if (!newValue || await this.systemPermissions.ensureMicrophonePermissions()) {
      if (newValue) {
        try {
          await this.getAudioDevices();
        } catch (error) {
          this.showError(error);
        }
      }

      this.setState({recordAudio: newValue});
      this.settings.set('recordAudio', newValue);
    }
  };

  toggleShortcuts = async () => {
    const setting = 'enableShortcuts';
    const newValue = !this.state[setting];
    this.toggleSetting(setting, newValue);
    await ipc.callMain('toggle-shortcuts', {enabled: newValue});
  };

  updateShortcut = async (setting, shortcut) => {
    try {
      await ipc.callMain('update-shortcut', {setting, shortcut});
      this.setState({
        shortcuts: {
          ...this.state.shortcuts,
          [setting]: shortcut
        }
      });
    } catch (error) {
      console.warn('Error updating shortcut', error);
    }
  };

  setOpenOnStartup = value => {
    const openOnStartup = typeof value === 'boolean' ? value : !this.state.openOnStartup;
    this.setState({openOnStartup});
    kap.app.setLoginItemSettings({openAtLogin: openOnStartup});
  };

  pickKapturesDir = () => {
    const directories = kap.dialog.showOpenDialogSync({
      properties: [
        'openDirectory',
        'createDirectory'
      ]
    });

    if (directories) {
      this.toggleSetting('kapturesDir', directories[0]);
    }
  };

  setAudioInputDeviceId = id => {
    this.setState({audioInputDeviceId: id});
    this.settings.set('audioInputDeviceId', id);
  };
}
