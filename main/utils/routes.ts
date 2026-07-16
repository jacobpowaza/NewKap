import {app, BrowserWindow} from 'electron';
import {is} from 'electron-util';
import fs from 'fs';
import path from 'path';

export const loadRoute = async (window: BrowserWindow, routeName: string, {openDevTools = false}: {openDevTools?: boolean} = {}) => {
  const staticRoute = path.join(app.getAppPath(), 'renderer', 'out', `${routeName}.html`);
  const loadPromise = (!is.development || fs.existsSync(staticRoute)) ?
    window.loadFile(staticRoute) :
    window.loadURL(`http://localhost:8000/${routeName}`);

  if (openDevTools) {
    window.webContents.openDevTools({mode: 'detach'});
  }

  return loadPromise;
};
