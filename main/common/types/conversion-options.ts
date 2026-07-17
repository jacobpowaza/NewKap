import {App, Format} from './base';

export type CreateExportOptions = {
  filePath: string;
  conversionOptions: ConversionOptions;
  format: Format;
  plugins: {
    share: {
      pluginName: string;
      serviceTitle: string;
      app?: App;
    };
  };
};

export type EditServiceInfo = {
  pluginName: string;
  serviceTitle: string;
};

export type ConversionOptions = {
  startTime: number;
  endTime: number;
  width: number;
  height: number;
  fps: number;
  shouldCrop: boolean;
  shouldMute: boolean;
  hasAudio?: boolean;
  clips?: TimelineClip[];
  editService?: EditServiceInfo;
};

export type TimelineClip = {
  id: string;
  startTime: number;
  endTime: number;
  freezeDuration?: number;
  speed: number;
  brightness: number;
  contrast: number;
  saturation: number;
};

export enum ExportStatus {
  inProgress = 'inProgress',
  failed = 'failed',
  canceled = 'canceled',
  completed = 'completed'
}
