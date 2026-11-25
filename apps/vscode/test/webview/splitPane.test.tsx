// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SplitPane } from '../../src/webview/client/components/split-pane';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const reported: number[] = [];

function Harness() {
  const [percent, setPercent] = useState(50);

  return (
    <SplitPane
      end={<div>output</div>}
      percent={percent}
      start={<div>input</div>}
      onPercentChange={(next) => {
        reported.push(next);
        setPercent(next);
      }}
    />
  );
}

async function mount() {
  reported.length = 0;
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  await act(async () => {
    root.render(<Harness />);
  });

  const separator = container.querySelector('[role="separator"]') as HTMLElement;
  const press = (key: string) =>
    act(async () => {
      separator.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
    });

  return { container, press, root, separator };
}

describe('SplitPane', () => {
  it('moves the separator with the keyboard inside 30–70 and reports each change', async () => {
    const { press, root, separator } = await mount();

    assert.equal(separator.getAttribute('aria-label'), 'Resize input and output panes');
    assert.equal(separator.getAttribute('aria-valuenow'), '50');
    await press('ArrowRight');
    assert.equal(separator.getAttribute('aria-valuenow'), '52');
    await press('End');
    assert.equal(separator.getAttribute('aria-valuenow'), '70');
    await press('ArrowRight');
    assert.equal(separator.getAttribute('aria-valuenow'), '70');
    await press('Home');
    assert.equal(separator.getAttribute('aria-valuenow'), '30');
    await press('ArrowLeft');
    assert.equal(separator.getAttribute('aria-valuenow'), '30');
    assert.deepEqual(reported, [52, 70, 70, 30, 30]);

    await act(async () => {
      root.unmount();
    });
  });

  it('follows a pointer drag relative to its container', async () => {
    const { container, root, separator } = await mount();
    const pane = container.firstElementChild as HTMLElement;

    pane.getBoundingClientRect = () =>
      ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1000,
        top: 0,
        width: 1000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    await act(async () => {
      separator.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 500 }));
    });

    assert.equal(document.body.classList.contains('is-resizing-editor-split'), true);

    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900 }));
      window.dispatchEvent(new MouseEvent('pointerup'));
    });

    assert.equal(separator.getAttribute('aria-valuenow'), '70');
    assert.equal(pane.style.getPropertyValue('--editor-split'), '70%');
    assert.equal(document.body.classList.contains('is-resizing-editor-split'), false);

    await act(async () => {
      root.unmount();
    });
  });
});
