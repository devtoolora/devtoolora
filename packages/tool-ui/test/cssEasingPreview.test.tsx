// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { CssEasingPreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let reducedMotion = false;

// jsdom has no matchMedia; the preview reads the reduced-motion preference through it.
window.matchMedia = () =>
  ({
    addEventListener() {},
    matches: reducedMotion,
    removeEventListener() {},
  }) as unknown as MediaQueryList;

// The motion loop keeps a timer running until its root unmounts.
const roots: Root[] = [];

function mountRoot(container: HTMLElement): Root {
  const root = createRoot(container);

  roots.push(root);

  return root;
}

const css =
  ':root {\n  --easing: cubic-bezier(0.68, -0.6, 0.32, 1.6);\n}\n\n.element {\n  transition: transform 300ms var(--easing);\n}';
const backFields = { preset: 'custom', x1: '0.68', x2: '0.32', y1: '-0.6', y2: '1.6' };

async function render(fields: Record<string, string>, output: string | undefined = css) {
  const changes: Array<[string, string]> = [];
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    mountRoot(container).render(
      <CssEasingPreview
        css={output}
        fields={fields}
        onFieldChange={(id, value) => changes.push([id, value])}
      />,
    );
  });

  return { changes, container };
}

const handle = (container: HTMLElement, index: number): HTMLElement | null =>
  container.querySelector(`[aria-label="Control point ${index}"]`);

async function press(target: HTMLElement | null, key: string, shiftKey = false): Promise<void> {
  await act(async () => {
    target?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, shiftKey }));
  });
}

const movingBlock = (container: HTMLElement): HTMLElement | null =>
  container.querySelector('[data-css-preview="easing"] [data-motion="curve"]');

describe('CssEasingPreview', () => {
  beforeEach(() => {
    reducedMotion = false;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    act(() => {
      for (const root of roots.splice(0)) root.unmount();
    });
  });

  it('plots the curve with labelled handles and a Play/Pause toggle', async () => {
    const { container } = await render(backFields);

    assert.ok(container.querySelector('[data-css-preview="easing"]'));
    assert.ok(container.querySelector('svg path'));

    assert.ok(
      [...container.querySelectorAll('button')].some((button) => button.textContent === 'Pause'),
    );

    assert.equal(handle(container, 1)?.getAttribute('aria-valuetext'), 'x 0.68, y -0.6');
    assert.equal(handle(container, 2)?.getAttribute('aria-valuetext'), 'x 0.32, y 1.6');
  });

  it('switches a preset to custom and writes all four points when a handle moves', async () => {
    const { changes, container } = await render({ ...backFields, preset: 'ease' });

    await press(handle(container, 1), 'ArrowUp');

    assert.deepEqual(changes, [
      ['preset', 'custom'],
      ['x1', '0.25'],
      ['y1', '0.11'],
      ['x2', '0.25'],
      ['y2', '1'],
    ]);

    changes.length = 0;
    await press(handle(container, 2), 'ArrowLeft', true);

    assert.deepEqual(changes.slice(1), [
      ['x1', '0.25'],
      ['y1', '0.1'],
      ['x2', '0.15'],
      ['y2', '1'],
    ]);
  });

  it('clamps keyboard moves to x 0..1 and y -1..2', async () => {
    const { changes, container } = await render({ ...backFields, x2: '1', y2: '2' });

    await press(handle(container, 2), 'ArrowUp', true);
    await press(handle(container, 2), 'ArrowRight');

    assert.deepEqual(
      changes.filter(([id]) => id === 'x2' || id === 'y2'),
      [
        ['x2', '1'],
        ['y2', '2'],
        ['x2', '1'],
        ['y2', '2'],
      ],
    );
  });

  it('fits the visible range to the curve and keeps the unit square 1:1', async () => {
    const unitSquare = async (fields: Record<string, string>): Promise<string[]> => {
      const square = (await render(fields)).container.querySelectorAll('svg rect')[1];

      return ['width', 'height'].map((name) => square?.getAttribute(name) ?? '');
    };

    // Progress -0.15..1.15 fills the 272-unit plot height: 272 / 1.3 per unit on both axes.
    assert.deepEqual(await unitSquare({ preset: 'ease' }), ['209.23', '209.23']);
    assert.deepEqual(await unitSquare(backFields), ['108.8', '108.8']);
    assert.deepEqual(await unitSquare({ ...backFields, y1: '-1', y2: '2' }), ['90.67', '90.67']);
  });

  it('drags a handle by the pointer delta at the scale captured on pointerdown', async () => {
    const { changes, container } = await render({ ...backFields, preset: 'ease-in-out' });
    const svg = container.querySelector('svg');
    const target = handle(container, 1);
    // Sized so the ease-in-out unit square (209.23 viewBox units) is 200 px on screen.
    const fit = 200 / 209.23;
    let bounds = { height: 320 * fit, left: 0, top: 0, width: 280 * fit };

    assert.ok(svg && target);
    svg.getBoundingClientRect = () => bounds as DOMRect;
    target.setPointerCapture = () => {};

    const pointer = async (type: string, clientX: number, clientY: number): Promise<void> => {
      await act(async () => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY }));
      });
    };

    await pointer('pointerdown', 70, 230);
    await pointer('pointermove', 90, 210);

    assert.deepEqual(changes, [
      ['preset', 'custom'],
      ['x1', '0.52'],
      ['y1', '0.1'],
      ['x2', '0.58'],
      ['y2', '1'],
    ]);

    bounds = { height: 640 * fit, left: 0, top: 200, width: 560 * fit };
    changes.length = 0;
    await pointer('pointermove', 110, 210);

    assert.deepEqual(changes.slice(1, 3), [
      ['x1', '0.62'],
      ['y1', '0.1'],
    ]);

    changes.length = 0;
    await pointer('pointerup', 110, 210);
    await pointer('pointermove', 150, 150);

    assert.deepEqual(changes, []);

    await pointer('pointerdown', 0, 0);
    await pointer('pointermove', 40, 0);

    assert.deepEqual(changes.slice(1, 3), [
      ['x1', '0.52'],
      ['y1', '0'],
    ]);
  });

  it('holds the range still while a handle is dragged and re-fits on release', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = mountRoot(container);

    const draw = async (fields: Record<string, string>): Promise<void> => {
      await act(async () => {
        root.render(<CssEasingPreview css={css} fields={fields} onFieldChange={() => {}} />);
      });
    };

    await draw({ preset: 'ease' });

    const svg = container.querySelector('svg');
    const target = handle(container, 2);

    const pointer = async (type: string): Promise<void> => {
      await act(async () => {
        target?.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
      });
    };

    assert.ok(svg && target);
    svg.getBoundingClientRect = () => ({ height: 320, left: 0, top: 0, width: 280 }) as DOMRect;
    target.setPointerCapture = () => {};
    const unitWidth = (): string | null | undefined =>
      svg.querySelectorAll('rect')[1]?.getAttribute('width');

    await pointer('pointerdown');
    await draw(backFields);

    assert.equal(unitWidth(), '209.23');

    await pointer('pointerup');

    const easing = Number(unitWidth());

    assert.ok(easing > 108.8 && easing <= 209.23, String(easing));
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    assert.equal(unitWidth(), '108.8');

    reducedMotion = true;
    await pointer('pointerdown');
    await draw({ preset: 'ease' });
    await pointer('pointerup');
    assert.equal(unitWidth(), '209.23');
  });

  it('prerenders the motion track playing so hydration matches', () => {
    for (const matches of [true, false]) {
      reducedMotion = matches;
      const html = renderToString(
        <CssEasingPreview css={css} fields={backFields} onFieldChange={() => {}} />,
      );

      assert.equal(html.includes('>Play<'), false, String(matches));
      assert.equal(html.includes('>Pause<'), true, String(matches));
    }

    reducedMotion = false;
  });

  it('widens the range for headroom while dragging and settles after release', async () => {
    const { container } = await render({ preset: 'ease' });
    const svg = container.querySelector('svg');
    const target = handle(container, 1);

    assert.ok(svg && target);
    // 100 px per unit: dragging 170 px up from y 0.1 reaches y 1.8.
    svg.getBoundingClientRect = () => ({ height: 320, left: 0, top: 0, width: 280 }) as DOMRect;
    target.setPointerCapture = () => {};

    const pointer = async (type: string, clientY: number): Promise<void> => {
      await act(async () => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientY }));
      });
    };

    assert.equal(svg.getAttribute('data-y-max'), '1.15');
    await pointer('pointerdown', 0);
    await pointer('pointermove', -(1.8 - 0.1) * 209.23);
    assert.ok(Number(svg.getAttribute('data-y-max')) >= 1.9, svg.getAttribute('data-y-max') ?? '');
    await pointer('pointerup', 0);
    assert.ok(Number(svg.getAttribute('data-y-max')) < 1.9);
  });

  it('runs the transition with the parsed timing function and freezes it on Pause', async () => {
    const { container } = await render(backFields);

    assert.match(
      movingBlock(container)?.style.transition ?? '',
      /300ms cubic-bezier\(0\.68, -0\.6, 0\.32, 1\.6\)/,
    );

    const pause = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Pause',
    );

    await act(async () => pause?.click());

    assert.equal(movingBlock(container)?.style.transition, 'none');
    assert.equal(movingBlock(container)?.style.transform, 'translateX(100%)');
  });

  it('stays paused under reduced motion until Play is pressed', async () => {
    reducedMotion = true;
    const { container } = await render(backFields);

    assert.equal(movingBlock(container)?.style.transition, '');
    const play = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Play',
    );

    await act(async () => play?.click());

    assert.match(movingBlock(container)?.style.transition ?? '', /cubic-bezier/);
  });

  it('waits for valid points and CSS', async () => {
    const { container } = await render({ ...backFields, x1: '1.5' }, undefined);

    assert.match(container.textContent ?? '', /Waiting for valid CSS/);
    assert.equal(container.querySelector('svg path'), null);
  });
});
