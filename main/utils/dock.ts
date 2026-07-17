import {app, nativeImage} from 'electron';
import path from 'path';

const getDockIcon = () => {
  const iconPath = app.isPackaged ?
    path.join(process.resourcesPath, 'icon.icns') :
    path.join(app.getAppPath(), 'build', 'icon.icns');

  return nativeImage.createFromPath(iconPath);
};

export const setDockVisible = (visible: boolean) => {
  if (process.platform !== 'darwin') {
    return;
  }

  (app as any).__kapDockVisible = visible;

  if (visible) {
    app.setName('Kap');
    app.setActivationPolicy('regular');
    app.dock?.show();
    const icon = getDockIcon();
    if (!icon.isEmpty()) {
      app.dock?.setIcon(icon);
    }

    // Switching from 'accessory' to 'regular' doesn't reliably bring an
    // already-created window to the foreground on macOS, so force it.
    app.focus({steal: true});
  } else {
    app.dock?.hide();
    app.setActivationPolicy('accessory');
  }
};
