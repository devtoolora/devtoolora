// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CssShadowControls } from '../src/tool-runner/editors/css-design-controls/CssShadowControls';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const textLayer = { blur: 4, color: '#000000', x: 2, y: 2 };

async function render(variant: 'box' | 'text', value: string) {
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    createRoot(container).render(
      <CssShadowControls value={value} variant={variant} onValueChange={() => {}} />,
    );
  });

  return container;
}

const addButton = (container: HTMLElement): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find((button) => button.textContent === 'Add layer');

describe('CssShadowControls', () => {
  it('hides spread and inset in the text variant and caps it at 5 layers', async () => {
    const container = await render('text', JSON.stringify(Array(5).fill(textLayer)));

    assert.doesNotMatch(container.textContent ?? '', /Spread|Inset/);
    assert.equal(addButton(container)?.disabled, true);
  });

  it('keeps Spread and Inset in the box variant', async () => {
    const container = await render(
      'box',
      JSON.stringify([{ ...textLayer, inset: false, spread: 0 }]),
    );

    assert.match(container.textContent ?? '', /Spread/);
    assert.match(container.textContent ?? '', /Inset/);
    assert.equal(addButton(container)?.disabled, false);
  });
});
