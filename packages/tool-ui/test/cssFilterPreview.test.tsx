// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CssLivePreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(css: string | undefined, target: string): Promise<HTMLElement> {
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    createRoot(container).render(
      <CssLivePreview css={css} fields={{ target }} kind="css-filter" />,
    );
  });

  return container;
}

describe('css filter preview', () => {
  it('applies filter to a demo scene', async () => {
    const container = await render('.filter {\n  filter: sepia(60%);\n}', 'filter');
    const stage = container.querySelector<HTMLElement>('[data-css-preview="filter"]');

    assert.equal(stage?.style.filter, 'sepia(60%)');
    assert.ok(stage?.querySelector('[data-demo-scene]'));
    assert.equal(container.querySelector('[data-patterned-backdrop]'), null);
  });

  it('puts a card over the patterned backdrop for backdrop-filter', async () => {
    const container = await render(
      '.filter {\n  -webkit-backdrop-filter: blur(8px);\n  backdrop-filter: blur(8px);\n}',
      'backdrop-filter',
    );

    assert.ok(container.querySelector('[data-patterned-backdrop]'));

    assert.match(
      container.querySelector<HTMLElement>('[data-css-preview="filter"]')?.style.cssText ?? '',
      /blur\(8px\)/,
    );
  });

  it('waits for valid CSS', async () => {
    assert.match((await render(undefined, 'filter')).textContent ?? '', /Waiting for valid CSS/);
  });
});
