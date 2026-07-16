/* eslint-disable @typescript-eslint/promise-function-async */
import kap from './kap';

export const ipcRenderer = {
  callMain: <Data = any, Result = any>(channel: string, data?: Data): Promise<Result> => kap.ipc.callMain(channel, data),
  on: (channel: string, callback: (...args: any[]) => void) => kap.ipc.on(channel, callback),
  send: (channel: string, data?: any) => kap.ipc.send(channel, data)
};

export const answerMain = <Data, Result>(channel: string, callback: (data: Data) => Result | Promise<Result>) => {
  return kap.ipc.answerMain(channel, callback);
};

export default ipcRenderer;
