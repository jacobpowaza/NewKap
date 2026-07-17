import React from 'react';
import PropTypes from 'prop-types';
import {connect, PreferencesContainer} from '../../../containers';
import Category from './category';
import Item from '../item';
import Switch from '../item/switch';
import ShortcutInput from '../shortcut-input';

const Keybinds = ({category, enableShortcuts, shortcuts = {}, shortcutMap = {}, toggleShortcuts, updateShortcut}) => {
  const tabIndex = category === 'keybinds' ? 0 : -1;

  return (
    <Category>
      <div className="intro">
        <h2>Keyboard shortcuts</h2>
        <p>Record or clear a shortcut in one place.</p>
      </div>
      <Item
        parentItem
        title="Global shortcuts"
        subtitle="Make Kap shortcuts available from every app"
      >
        <Switch tabIndex={tabIndex} checked={enableShortcuts} onClick={toggleShortcuts}/>
      </Item>
      {
        Object.entries(shortcutMap).map(([key, title]) => (
          <Item key={key} title={title} subtitle={key.startsWith('captureScreenshot') ? 'Screenshot' : 'Recording'}>
            <ShortcutInput
              shortcut={shortcuts[key]}
              tabIndex={enableShortcuts ? tabIndex : -1}
              onChange={shortcut => updateShortcut(key, shortcut)}
            />
          </Item>
        ))
      }
      <div className="tip">In the screenshot preview window, press <kbd>⌘C</kbd> to copy the image to clipboard.</div>
      <style jsx>{`
        .intro {
          padding: 24px 16px 8px;
        }

        h2 {
          color: var(--title-color);
          font-size: 18px;
          margin: 0 0 4px;
        }

        p,
        .tip {
          color: var(--subtitle-color);
          font-size: 12px;
          margin: 0;
        }

        .tip {
          padding: 18px 16px 28px;
        }

        kbd {
          background: var(--input-background-color);
          border: 1px solid var(--input-border-color);
          border-radius: 4px;
          color: var(--title-color);
          padding: 2px 6px;
        }
      `}</style>
    </Category>
  );
};

Keybinds.propTypes = {
  category: PropTypes.string,
  enableShortcuts: PropTypes.bool,
  shortcuts: PropTypes.object,
  shortcutMap: PropTypes.object,
  toggleShortcuts: PropTypes.func.isRequired,
  updateShortcut: PropTypes.func.isRequired
};

export default connect(
  [PreferencesContainer],
  ({category, enableShortcuts, shortcuts, shortcutMap}) => ({category, enableShortcuts, shortcuts, shortcutMap}),
  ({toggleShortcuts, updateShortcut}) => ({toggleShortcuts, updateShortcut})
)(Keybinds);
