import {app, dialog, shell} from 'electron';
import semver from 'semver';

const got = require('got');

const REPO_OWNER = 'jacobpowaza';
const REPO_NAME = 'NewKap';
const RELEASES_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

type GithubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

type GithubRelease = {
  tag_name: string;
  name?: string;
  html_url?: string;
  assets?: GithubReleaseAsset[];
};

let isChecking = false;

export const normalizeReleaseVersion = (version: string | undefined) => {
  if (!version) {
    return undefined;
  }

  return semver.valid(version) ?? semver.valid(version.replace(/^v/i, '')) ?? undefined;
};

export const isReleaseNewer = (releaseVersion: string | undefined, currentVersion: string) => {
  const normalizedRelease = normalizeReleaseVersion(releaseVersion);
  const normalizedCurrent = normalizeReleaseVersion(currentVersion);

  if (!normalizedRelease || !normalizedCurrent) {
    return false;
  }

  return semver.gt(normalizedRelease, normalizedCurrent);
};

export const getReleaseDownloadUrl = (release: GithubRelease, arch = process.arch) => {
  const assetArch = arch === 'arm64' ? 'arm64' : 'x64';
  const matchingAsset = release.assets?.find(asset => {
    const name = asset.name.toLowerCase();
    return name.endsWith('.dmg') && name.includes(`mac-${assetArch}`);
  });

  return matchingAsset?.browser_download_url;
};

const fetchLatestRelease = async () => {
  const response = await got(LATEST_RELEASE_API_URL, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': `Kap/${app.getVersion()}`
    },
    json: true,
    timeout: 10_000
  }) as {body: GithubRelease};

  return response.body;
};

const showUpdateAvailableDialog = async (release: GithubRelease) => {
  const releaseVersion = normalizeReleaseVersion(release.tag_name) ?? release.tag_name;
  const releaseUrl = release.html_url ?? RELEASES_URL;
  const downloadUrl = getReleaseDownloadUrl(release);

  const {response} = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Not Now', 'Update', 'Open Release Page'],
    defaultId: 1,
    cancelId: 0,
    message: 'Update Available',
    detail: `Kap ${releaseVersion} is available. You have ${app.getVersion()}.`
  });

  if (response === 1) {
    await shell.openExternal(downloadUrl ?? releaseUrl);
  } else if (response === 2) {
    await shell.openExternal(releaseUrl);
  }
};

export const checkForUpdates = async ({silent = true}: {silent?: boolean} = {}) => {
  if (isChecking) {
    return;
  }

  isChecking = true;

  try {
    const release = await fetchLatestRelease();
    if (isReleaseNewer(release.tag_name, app.getVersion())) {
      await showUpdateAvailableDialog(release);
      return;
    }

    if (!silent) {
      await dialog.showMessageBox({
        type: 'info',
        message: 'You’re up to date',
        detail: `Kap ${app.getVersion()} is the latest version.`
      });
    }
  } catch (error) {
    console.error('[updater] update check failed', error);

    if (!silent) {
      await dialog.showMessageBox({
        type: 'error',
        message: 'Update Check Failed',
        detail: (error as Error).message
      });
    }
  } finally {
    isChecking = false;
  }
};
