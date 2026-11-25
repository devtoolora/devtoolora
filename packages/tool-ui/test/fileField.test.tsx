// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolFieldControl, type ToolPlatformActions } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => {};

describe('file field', () => {
  it('renders the browser file picker when the host has no native picker', async () => {
    const platformActions: ToolPlatformActions = {
      copyText: async () => {},
      saveFile: async () => true,
    };
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ToolFieldControl
          field={{ id: 'image', label: 'Image', type: 'file' }}
          platformActions={platformActions}
          value=""
          onValueChange={noop}
        />,
      );
    });

    assert.ok(container.querySelector('input[type="file"]'), 'browser file input');
    assert.equal(container.querySelector('.native-file-button'), null);

    await act(async () => {
      root.unmount();
    });
  });

  it('names a loaded file by its stored name, else as a sample', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const render = (fileName?: string) =>
      act(async () => {
        root.render(
          <ToolFieldControl
            field={{ id: 'image', label: 'Image', type: 'file' }}
            fileName={fileName}
            value="data:image/png;base64,AAAA"
            onValueChange={noop}
          />,
        );
      });

    await render();
    assert.match(container.querySelector('.selected-file-name')?.textContent ?? '', /^Sample file/);

    await render('logo.png');
    assert.match(container.querySelector('.selected-file-name')?.textContent ?? '', /^logo\.png/);

    await act(async () => {
      root.unmount();
    });
  });
});
