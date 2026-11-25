// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { ToolResult } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolOutputPanel, type SavedToolFile, type ToolPlatformActions } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function button(container: HTMLElement, text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(text),
  );

  if (!match) throw new Error(`No button ${text}`);

  return match;
}

function mount(platformActions: ToolPlatformActions | undefined, result: ToolResult) {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const status = () => container.querySelector('[aria-live="polite"]')?.textContent;
  const click = (text: string) =>
    act(async () => {
      button(container, text).click();
      await Promise.resolve();
      await Promise.resolve();
    });

  const ready = act(async () => {
    root.render(
      <ToolOutputPanel
        canRetry={false}
        error=""
        isRunning={false}
        platformActions={platformActions}
        result={result}
        resultActions={['copy', 'save']}
        toolName="Demo Tool"
        onRetry={() => {}}
      />,
    );
  });

  return { click, container, ready, root, status };
}

describe('ToolOutputPanel', () => {
  it('scrolls to and focuses the error of a manual run only', async () => {
    const scrolled: unknown[] = [];
    const scrollIntoView = Element.prototype.scrollIntoView;
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const render = (error: string, shouldRevealError: boolean) =>
      act(async () => {
        root.render(
          <ToolOutputPanel
            canRetry={false}
            error={error}
            isRunning={false}
            shouldRevealError={shouldRevealError}
            toolName="Demo Tool"
            onRetry={() => {}}
          />,
        );
      });

    Element.prototype.scrollIntoView = (options) => void scrolled.push(options);
    await render('Typed too fast.', false);
    assert.deepEqual(scrolled, []);
    assert.ok(document.activeElement === document.body, 'focus stays');
    await render('', true);
    await render('Delay too short.', true);
    assert.deepEqual(scrolled, [{ block: 'nearest' }]);

    const alert = container.querySelector('[role="alert"]');

    assert.ok(alert && document.activeElement === alert, 'the alert has focus');
    assert.equal(alert.getAttribute('tabindex'), '-1');
    Element.prototype.scrollIntoView = scrollIntoView;

    await act(async () => {
      root.unmount();
    });
  });

  it('copies through the host, falls back to the browser clipboard and saves natively', async () => {
    const clipboard: string[] = [];
    const saved: SavedToolFile[] = [];
    let copyFails = false;
    let saveFails = false;

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void clipboard.push(`browser:${text}`) },
    });

    const platformActions: ToolPlatformActions = {
      copyText: async (text) => {
        if (copyFails) throw new Error('no');

        clipboard.push(`host:${text}`);
      },
      saveFile: async (file) => {
        if (saveFails) throw new Error('no');

        saved.push(file);

        return true;
      },
    };
    const view = mount(platformActions, { language: 'json', text: '{"a":1}' });

    await view.ready;
    await view.click('Save');
    assert.ok(saved[0]);
    assert.equal(saved[0].fileName, 'demo-tool.json');
    assert.equal(new TextDecoder().decode(saved[0].bytes), '{"a":1}');
    assert.equal(view.status(), 'Saved demo-tool.json.');

    const createObjectURL = URL.createObjectURL;
    const revokeObjectURL = URL.revokeObjectURL;

    URL.createObjectURL = () => 'blob:demo';
    URL.revokeObjectURL = () => {};
    saveFails = true;
    await view.click('Save');
    await new Promise((resolve) => setTimeout(resolve, 0));
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    assert.equal(view.status(), 'Native save failed; downloaded demo-tool.json instead.');
    await view.click('Copy');
    assert.equal(view.status(), 'Copied.');
    copyFails = true;
    await view.click('Copy');
    assert.deepEqual(clipboard, ['host:{"a":1}', 'browser:{"a":1}']);

    await act(async () => {
      view.root.unmount();
    });
  });

  it('saves artifacts natively and lists failed batch entries', async () => {
    const saved: SavedToolFile[] = [];
    const platformActions: ToolPlatformActions = {
      copyText: async () => {},
      saveFile: async (file) => {
        saved.push(file);

        return false;
      },
    };
    const view = mount(platformActions, {
      artifacts: [{ base64: 'AQID', fileName: 'out.bin', mimeType: 'application/octet-stream' }],
      batch: { failed: [{ message: 'Too big', name: 'b.png' }], succeeded: 1, total: 2 },
      text: '',
    });

    await view.ready;

    assert.equal(
      view.container.querySelector('[data-testid="batch-result"]')?.textContent,
      '1 of 2 completed.b.png: Too big',
    );

    assert.equal(button(view.container, 'Download').textContent, 'Download out.bin');
    await view.click('Download out.bin');
    assert.ok(saved[0]);
    assert.deepEqual([...saved[0].bytes], [1, 2, 3]);
    assert.equal(saved[0].mimeType, 'application/octet-stream');
    assert.equal(view.status(), '');

    await act(async () => {
      view.root.unmount();
    });
  });

  it('downloads an artifact in the browser as a blob and revokes it after the click', async () => {
    const createObjectURL = URL.createObjectURL;
    const revokeObjectURL = URL.revokeObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    const events: string[] = [];
    let blob: Blob | undefined;

    URL.createObjectURL = (object) => {
      blob = object as Blob;

      return 'blob:artifact';
    };

    URL.revokeObjectURL = (url) => void events.push(`revoke ${url}`);

    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      events.push(`click ${this.href} ${this.download}`);
    };

    const view = mount(undefined, {
      artifacts: [{ base64: 'AQID', fileName: 'out.bin', mimeType: 'application/octet-stream' }],
      text: '',
    });

    await view.ready;
    await view.click('Download out.bin');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(events, ['click blob:artifact out.bin', 'revoke blob:artifact']);
    assert.equal(blob?.type, 'application/octet-stream');
    assert.deepEqual([...new Uint8Array(await blob!.arrayBuffer())], [1, 2, 3]);
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    HTMLAnchorElement.prototype.click = click;

    await act(async () => {
      view.root.unmount();
    });
  });

  it('shows a mismatch verdict as a status with text', async () => {
    const view = mount(undefined, { text: 'No match', verdict: 'mismatch' });

    await view.ready;

    const status = view.container.querySelector('[role="status"]');

    assert.equal(status?.textContent, 'No match');
    assert.equal(status?.getAttribute('data-verdict'), 'mismatch');
    assert.ok(!view.container.querySelector('pre'), 'no plain text pane');
    assert.ok(!view.container.querySelector('[data-testid="output-stats"]'), 'no text stats');
    assert.ok(button(view.container, 'Copy'));

    await act(async () => {
      view.root.unmount();
    });
  });
});
