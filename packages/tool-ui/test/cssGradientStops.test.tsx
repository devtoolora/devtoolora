// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { parseGradientStops } from '@devtoolora/functions/css';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { CssGradientStopsControls } from '../src/tool-runner/editors/css-design-controls/CssGradientStopsControls';
import { CssDesignControls } from '../src/tool-runner/editors/css-design-controls';
import { CssLivePreview } from '../src/tool-runner/previews';
import { liveStageKinds } from '../src/tool-runner/previews/css-live-preview/CssLiveStages';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const stopsJson = (count: number, color = '#2563eb'): string =>
  JSON.stringify(
    Array.from({ length: count }, (_, index) => ({
      color,
      position: Math.round((index * 100) / (count - 1)),
    })),
  );

async function render(value: string) {
  const changes: string[] = [];
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    createRoot(container).render(
      <CssGradientStopsControls value={value} onValueChange={(next) => changes.push(next)} />,
    );
  });

  return { changes, container };
}

const button = (container: HTMLElement, name: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find((entry) => entry.textContent?.startsWith(name)) as
    HTMLButtonElement | undefined;

async function setInput(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('CssGradientStopsControls', () => {
  it('disables Add at 8 stops and Remove at 2 stops', async () => {
    const full = await render(stopsJson(8));

    assert.equal(button(full.container, 'Add stop')?.disabled, true);
    assert.match(button(full.container, 'Add stop')?.title ?? '', /Maximum 8 stops/);
    assert.equal(button(full.container, 'Remove')?.disabled, false);

    const minimal = await render(stopsJson(2));

    assert.equal(button(minimal.container, 'Add stop')?.disabled, false);
    assert.equal(button(minimal.container, 'Remove')?.disabled, true);
  });

  it('writes valid JSON when a position changes and keeps non-hex colors as typed', async () => {
    const { changes, container } = await render(
      '[{"color":"oklch(62% 0.19 260)","position":0},{"color":"red","position":100}]',
    );
    const slider = container.querySelector<HTMLInputElement>(
      'input[type=range][aria-label="Stop 2 position slider"]',
    );

    assert.ok(slider);
    await setInput(slider, '40');

    assert.deepEqual(parseGradientStops(changes.at(-1) ?? ''), [
      { color: 'oklch(62% 0.19 260)', position: 0 },
      { color: 'red', position: 40 },
    ]);

    assert.equal(
      container.querySelector<HTMLInputElement>('input[aria-label="Stop 2 color picker"]')?.value,
      '#ff0000',
    );
  });

  it('adds a stop midway in the largest gap with the color the gradient already shows', async () => {
    const added = async (stops: string): Promise<unknown> => {
      const { changes, container } = await render(stops);

      await act(async () => button(container, 'Add stop')?.click());

      return JSON.parse(changes.at(-1) ?? '[]');
    };

    assert.deepEqual(
      await added(
        '[{"color":"red","position":0},{"color":"blue","position":20},{"color":"lime","position":100}]',
      ),
      [
        { color: 'red', position: 0 },
        { color: 'blue', position: 20 },
        { color: '#008080', position: 60 },
        { color: 'lime', position: 100 },
      ],
    );

    assert.deepEqual(await added('[{"color":"red","position":0},{"color":"blue","position":40}]'), [
      { color: 'red', position: 0 },
      { color: 'blue', position: 40 },
      { color: 'blue', position: 70 },
    ]);

    assert.deepEqual(
      await added('[{"color":"blue","position":100},{"color":"red","position":60}]'),
      [
        { color: 'blue', position: 100 },
        { color: 'red', position: 30 },
        { color: 'red', position: 60 },
      ],
    );

    assert.deepEqual(
      await added('[{"color":"transparent","position":0},{"color":"#ff0000","position":100}]'),
      [
        { color: 'transparent', position: 0 },
        { color: '#ff000080', position: 50 },
        { color: '#ff0000', position: 100 },
      ],
    );
  });

  it('moves a focused marker with the arrow keys, ten units with Shift', async () => {
    const { changes, container } = await render(stopsJson(2));
    const marker = container.querySelector<HTMLElement>('[aria-label="Stop 1 marker"]');

    assert.equal(marker?.getAttribute('aria-valuetext'), '0%');

    await act(async () => {
      marker?.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight', shiftKey: true }),
      );
    });

    assert.equal(parseGradientStops(changes.at(-1) ?? '')[0]?.position, 10);
  });

  it('drags coincident markers apart in the drag direction and ignores other buttons', async () => {
    const { changes, container } = await render(
      '[{"color":"red","position":0},{"color":"lime","position":50},{"color":"rgba(0, 0, 255, 0.5)","position":50},{"color":"black","position":100}]',
    );
    const marker = container.querySelector<HTMLElement>('[aria-label="Stop 3 marker"]');
    const track = marker?.parentElement;

    assert.ok(marker && track);
    // A focusable span, not a button: role=slider is not allowed on <button>.
    assert.equal(marker.tagName, 'SPAN');
    assert.equal(marker.tabIndex, 0);
    assert.equal(marker.style.getPropertyValue('--stop-color'), '#0000ff80');
    track.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    marker.setPointerCapture = () => {};

    const pointer = async (type: string, clientX: number, button = 0): Promise<void> => {
      await act(async () => {
        marker.dispatchEvent(new MouseEvent(type, { bubbles: true, button, clientX }));
      });
    };

    await pointer('pointerdown', 100, 2);
    await pointer('pointermove', 60);

    assert.deepEqual(changes, []);

    await pointer('pointerdown', 100);
    await pointer('pointermove', 60);

    assert.deepEqual(
      JSON.parse(changes.at(-1) ?? '[]').map((stop: { position: number }) => stop.position),
      [0, 30, 50, 100],
    );

    await pointer('lostpointercapture', 60);
    await pointer('pointerdown', 100);
    await pointer('pointermove', 140);

    assert.deepEqual(
      JSON.parse(changes.at(-1) ?? '[]').map((stop: { position: number }) => stop.position),
      [0, 50, 70, 100],
    );
  });

  it('is rendered for the stops field of a css-gradient tool', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const tool = {
      fields: [{ defaultValue: stopsJson(2), id: 'stops', label: 'Stops', type: 'textarea' }],
      id: 'x',
      preview: 'css-gradient',
    } as unknown as SerializedToolDefinition;

    await act(async () => {
      createRoot(container).render(
        <CssDesignControls fields={{}} tool={tool} onFieldChange={() => {}} />,
      );
    });

    assert.ok(container.querySelector('[aria-label="Stop 1 marker"]'));
  });

  it('paints the validated gradient on the live preview stage', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const css =
      '.gradient {\n  background-image: radial-gradient(circle at 50% 50%, red 0%, blue 100%);\n}';

    const draw = async (fields: Record<string, string>): Promise<void> => {
      await act(async () => {
        root.render(<CssLivePreview css={css} fields={fields} kind="css-gradient" />);
      });
    };

    await draw({});

    const stage = container.querySelector<HTMLElement>('[data-css-preview="gradient"]');

    assert.match(stage?.style.backgroundImage ?? '', /radial-gradient/);
    assert.equal(stage?.children.length, 0);
    assert.match(container.textContent ?? '', /Live preview/);
    const note = [...container.querySelectorAll('p span')].find((span) =>
      span.textContent?.includes('Older browsers'),
    );

    assert.equal(note?.getAttribute('aria-hidden'), 'true');
    await draw({ interpolation: 'oklch' });
    assert.equal(note?.getAttribute('aria-hidden'), null);
  });
});

describe('css-mesh live stage', () => {
  it('maps the mesh preview kind to the gradient stage', () => {
    assert.equal(liveStageKinds['css-mesh'], 'gradient');
  });
});
