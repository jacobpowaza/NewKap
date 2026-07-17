import test from 'ava';

const configureNext = require('../renderer/next.config');

test('renderer client bundle does not depend on Electron Node globals', t => {
  const config = {
    module: {rules: []},
    target: 'electron-renderer'
  };

  const configured = configureNext({}).webpack(config, {
    defaultLoaders: {babel: 'babel-loader'},
    isServer: false
  });

  t.is(configured.target, 'web');
});
