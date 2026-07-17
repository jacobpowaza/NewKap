import test from 'ava';
import {getReleaseDownloadUrl, isReleaseNewer, normalizeReleaseVersion} from '../main/updater';

test('normalizeReleaseVersion accepts v-prefixed GitHub tags', t => {
  t.is(normalizeReleaseVersion('v5.1.0'), '5.1.0');
  t.is(normalizeReleaseVersion('5.1.0'), '5.1.0');
  t.is(normalizeReleaseVersion('release-5'), undefined);
});

test('isReleaseNewer compares normalized release tags', t => {
  t.true(isReleaseNewer('v5.1.0', '5.0.0'));
  t.false(isReleaseNewer('v5.0.0', '5.0.0'));
  t.false(isReleaseNewer('v4.9.0', '5.0.0'));
  t.false(isReleaseNewer('release-5', '5.0.0'));
});

test('getReleaseDownloadUrl chooses the matching mac dmg for the current architecture', t => {
  const release = {
    tag_name: 'v5.1.0',
    assets: [
      {
        name: 'Kap-5.1.0-mac-x64.dmg',
        browser_download_url: 'https://example.com/x64.dmg'
      },
      {
        name: 'Kap-5.1.0-mac-arm64.dmg',
        browser_download_url: 'https://example.com/arm64.dmg'
      }
    ]
  };

  t.is(getReleaseDownloadUrl(release, 'arm64'), 'https://example.com/arm64.dmg');
  t.is(getReleaseDownloadUrl(release, 'x64'), 'https://example.com/x64.dmg');
});
