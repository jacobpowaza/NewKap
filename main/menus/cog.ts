import {Menu} from 'electron';
import {MenuItemId, MenuOptions} from './utils';
import {getAboutMenuItem, getExportHistoryMenuItem, getOpenFileMenuItem, getPreferencesMenuItem, getSendFeedbackMenuItem} from './common';
import {getAudioDevices, getDefaultInputDevice} from '../utils/devices';
import {settings} from '../common/settings';
import {defaultInputDeviceId} from '../common/constants';
import {hasMicrophoneAccess} from '../common/system-permissions';

export const buildBasicCogMenu = (): MenuOptions => [
  getAboutMenuItem(),
  {type: 'separator'},
  getPreferencesMenuItem(),
  {type: 'separator'},
  {type: 'separator'},
  getOpenFileMenuItem(),
  getExportHistoryMenuItem(),
  {type: 'separator'},
  getSendFeedbackMenuItem(),
  {type: 'separator'},
  {role: 'quit', accelerator: 'Command+Q'}
];

const getMicrophoneItem = async (): Promise<MenuOptions[number]> => {
  const devices = await getAudioDevices();
  const isRecordAudioEnabled = settings.get('recordAudio');
  const currentDefaultDevice = getDefaultInputDevice();

  let audioInputDeviceId = settings.get('audioInputDeviceId');
  if (!devices.some(device => device.id === audioInputDeviceId)) {
    settings.set('audioInputDeviceId', defaultInputDeviceId);
    audioInputDeviceId = defaultInputDeviceId;
  }

  return {
    id: MenuItemId.audioDevices,
    label: 'Microphone',
    submenu: [
      {
        label: 'None',
        type: 'checkbox',
        checked: !isRecordAudioEnabled,
        click: () => {
          settings.set('recordAudio', false);
        }
      },
      ...[
        {name: `System Default${currentDefaultDevice ? ` (${currentDefaultDevice.name})` : ''}`, id: defaultInputDeviceId},
        ...devices
      ].map(device => ({
        label: device.name,
        type: 'checkbox' as const,
        checked: isRecordAudioEnabled && (audioInputDeviceId === device.id),
        click: () => {
          settings.set('recordAudio', true);
          settings.set('audioInputDeviceId', device.id);
        }
      }))
    ],
    visible: hasMicrophoneAccess()
  };
};

const getPluginsItem = (): MenuOptions[number] => {
  const {plugins} = require('../plugins');
  const items = plugins.recordingPlugins.flatMap((plugin: any) =>
    plugin.recordServicesWithStatus.map((service: any) => ({
      label: service.title,
      type: 'checkbox' as const,
      checked: service.isEnabled,
      click: async () => service.setEnabled(!service.isEnabled)
    }))
  );

  return {
    id: MenuItemId.plugins,
    label: 'Plugins',
    submenu: items,
    visible: items.length > 0
  };
};

const getCogMenuTemplate = async (): Promise<MenuOptions> => [
  getAboutMenuItem(),
  {type: 'separator'},
  getPreferencesMenuItem(),
  {type: 'separator'},
  getPluginsItem(),
  await getMicrophoneItem(),
  {type: 'separator'},
  getOpenFileMenuItem(),
  getExportHistoryMenuItem(),
  {type: 'separator'},
  getSendFeedbackMenuItem(),
  {type: 'separator'},
  {role: 'quit', accelerator: 'Command+Q'}
];

export const getCogMenuAsync = async () => {
  return Menu.buildFromTemplate(await getCogMenuTemplate());
};
