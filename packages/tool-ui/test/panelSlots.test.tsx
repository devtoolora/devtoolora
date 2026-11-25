// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolInputPanel, ToolOutputPanel } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tool: SerializedToolDefinition = {
  category: 'Text',
  description: 'Demo.',
  id: 'demo-tool',
  inputKind: 'text',
  name: 'Demo Tool',
  outputKind: 'text',
  supportsSelection: false,
};

const noop = () => {};

describe('panel slots', () => {
  it('keeps a stale preview image, dimmed, but hides its text and summary', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const render = (isStale: boolean) =>
      act(async () => {
        root.render(
          <ToolOutputPanel
            canRetry={false}
            error=""
            isRunning={isStale}
            isStale={isStale}
            result={{ previewDataUri: 'data:image/svg+xml,<svg/>', summary: 'Done.', text: 'x' }}
            toolName="Demo Tool"
            onRetry={noop}
          />,
        );
      });

    await render(true);

    assert.equal(
      container.querySelector('[data-testid="result-preview"]')?.getAttribute('aria-busy'),
      'true',
    );

    assert.equal(container.querySelector('[data-testid="result-summary"]'), null);
    assert.equal(container.querySelector('code'), null);
    await render(false);

    assert.equal(
      container.querySelector('[data-testid="result-preview"]')?.hasAttribute('aria-busy'),
      false,
    );

    assert.equal(container.querySelector('[data-testid="result-summary"]')?.textContent, 'Done.');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders output actions and footer only with a fresh result', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const render = (isStale: boolean) =>
      act(async () => {
        root.render(
          <ToolOutputPanel
            actions={<button type="button">Replace selection</button>}
            canRetry={false}
            error=""
            footer={<p id="footer">Continue with result</p>}
            isRunning={false}
            isStale={isStale}
            result={{ text: 'hello' }}
            toolName="Demo Tool"
            onRetry={noop}
          />,
        );
      });

    await render(false);

    assert.equal(
      container.querySelector('[data-testid="panel-actions"] button:last-child')?.textContent,
      'Replace selection',
    );

    assert.equal(container.querySelector('.panel-body > :last-child')?.id, 'footer');
    await render(true);
    assert.equal(container.querySelector('#footer'), null);

    assert.equal(
      Array.from(container.querySelectorAll('button')).some(
        (button) => button.textContent === 'Replace selection',
      ),
      false,
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('renders the input gutter and notice next to the textarea', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ToolInputPanel
          canRun
          fields={{}}
          inputGutter={
            <div aria-hidden="true" id="gutter">
              1
            </div>
          }
          isRunning={false}
          notice={<p id="notice">Detected JSON.</p>}
          text=""
          tool={tool}
          onClear={noop}
          onFieldChange={noop}
          onRun={noop}
          onSampleApply={noop}
          onTextChange={noop}
        />,
      );
    });

    const textarea = container.querySelector('textarea');

    assert.equal(textarea?.previousElementSibling?.id, 'gutter');
    assert.equal(container.querySelector('.panel-body > :first-child')?.id, 'notice');

    await act(async () => {
      root.unmount();
    });
  });

  it('announces the copy settings link result', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ToolInputPanel
          canRun
          fields={{}}
          isRunning={false}
          text=""
          tool={tool}
          onClear={noop}
          onCopySettingsLink={async () => true}
          onFieldChange={noop}
          onRun={noop}
          onSampleApply={noop}
          onTextChange={noop}
        />,
      );
    });

    const live = () => container.querySelector('[aria-live="polite"]')?.textContent;

    assert.equal(live(), '');

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Copy settings link')
        ?.click();
    });

    assert.equal(live(), 'Link copied');

    await act(async () => {
      root.unmount();
    });
  });
});
