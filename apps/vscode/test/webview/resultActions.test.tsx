// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ResultActions } from '../../src/webview/client/components/result-actions';
import { vscodePlatformActions } from '../../src/webview/client/host/vscodePlatformActions';
import { installFakeVscode } from './fakeVscode';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ResultActions', () => {
  it('posts the chosen result action with the full result and hides actions the tool does not allow', async () => {
    const vscode = installFakeVscode();
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const result = { language: 'json', text: '{"a":1}' };

    await act(async () => {
      root.render(<ResultActions actions={['replace', 'copy', 'scratch']} result={result} />);
    });

    const labels = Array.from(container.querySelectorAll('button')).map((button) =>
      button.textContent?.trim(),
    );

    assert.deepEqual(labels, ['Replace selection', 'Open in editor']);

    await act(async () => {
      container.querySelector('button')?.click();
    });

    assert.deepEqual(vscode.messages.at(-1), { action: 'replace', result, type: 'resultAction' });

    await act(async () => {
      root.unmount();
    });
  });

  it('leaves the save outcome to the host, which may still cancel the dialog', async () => {
    const vscode = installFakeVscode();
    const saved = await vscodePlatformActions.saveFile({
      bytes: new Uint8Array([1]),
      fileName: 'a.bin',
      mimeType: 'application/octet-stream',
    });

    assert.equal(saved, false);
    assert.equal(vscode.messages.at(-1)?.type, 'resultAction');
  });
});
