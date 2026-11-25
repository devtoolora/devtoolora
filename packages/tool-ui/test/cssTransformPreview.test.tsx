// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CssLivePreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(css: string | undefined, origin = 'center'): Promise<HTMLElement> {
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    createRoot(container).render(
      <CssLivePreview css={css} fields={{ origin }} kind="css-transform" />,
    );
  });

  return container;
}

describe('css transform preview', () => {
  it('transforms the card and keeps a dashed outline of the original position', async () => {
    const container = await render(
      '.transform {\n  transform: rotate(15deg) scale(1.1);\n  transform-origin: top left;\n}',
      'top left',
    );
    const card = container.querySelector<HTMLElement>('[data-css-preview="transform"]');

    assert.equal(card?.style.transform, 'rotate(15deg) scale(1.1)');
    assert.equal(card?.style.transformOrigin, 'left top');
    assert.ok(container.querySelector('[data-transform-outline]'));

    assert.equal(
      container.querySelector<HTMLElement>('[data-transform-origin-dot]')?.dataset.origin,
      'top left',
    );
  });

  it('gives the stage perspective unless the transform has its own', async () => {
    const plain = await render('.transform {\n  transform: rotateY(30deg);\n}');
    const own = await render('.transform {\n  transform: perspective(800px) rotateY(30deg);\n}');

    assert.equal(
      plain.querySelector<HTMLElement>('[data-css-preview="transform"]')?.parentElement?.dataset
        .perspective,
      'stage',
    );

    assert.equal(
      own.querySelector<HTMLElement>('[data-css-preview="transform"]')?.parentElement?.dataset
        .perspective,
      'own',
    );
  });

  it('scrolls the stage, not the page, to follow a card moved out of view', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    const draw = async (css: string): Promise<void> => {
      await act(async () => {
        root.render(<CssLivePreview css={css} fields={{}} kind="css-transform" />);
      });
    };

    await draw('.transform {\n  transform: none;\n}');

    const card = container.querySelector<HTMLElement>('[data-css-preview="transform"]');
    const viewport = container.querySelector<HTMLElement>('[data-transform-stage]')?.parentElement;

    assert.ok(card && viewport);

    viewport.getBoundingClientRect = () =>
      ({ bottom: 300, left: 0, right: 300, top: 0 }) as DOMRect;

    card.getBoundingClientRect = () =>
      ({ bottom: 200, left: 290, right: 450, top: 100 }) as DOMRect;

    viewport.scrollLeft = 0;

    await draw('.transform {\n  transform: translateX(200px);\n}');
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));

    assert.equal(viewport.scrollLeft, 150);
    assert.equal(viewport.scrollTop, 0);
  });

  it('waits for valid CSS', async () => {
    assert.match((await render(undefined)).textContent ?? '', /Waiting for valid CSS/);
  });
});
