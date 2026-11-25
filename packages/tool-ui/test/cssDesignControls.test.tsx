// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { CssDesignControls } from '../src/tool-runner/editors/css-design-controls';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const toolWith = (preview: string, fields: unknown[]): SerializedToolDefinition =>
  ({ fields, id: 'x', preview }) as unknown as SerializedToolDefinition;

async function render(
  tool: SerializedToolDefinition,
  onFieldChange: (id: string, value: string) => void = () => {},
) {
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    createRoot(container).render(
      <CssDesignControls fields={{}} tool={tool} onFieldChange={onFieldChange} />,
    );
  });

  return container;
}

describe('CssDesignControls', () => {
  it('renders a slider from field.range', async () => {
    const container = await render(
      toolWith('css-filter', [
        { id: 'blur', label: 'Blur', range: { max: 50, min: 0, unit: 'px' }, type: 'number' },
      ]),
    );
    const slider = container.querySelector<HTMLInputElement>('input[type=range]');

    assert.equal(slider?.min, '0');
    assert.equal(slider?.max, '50');
    assert.equal(slider?.getAttribute('aria-valuetext'), '0 px');
  });

  it('renders a color picker for presentation color fields and writes plain hex', async () => {
    const changes: Array<[string, string]> = [];
    const container = await render(
      toolWith('css-glass', [
        { defaultValue: '#336699', id: 'tint', label: 'Tint', presentation: 'color', type: 'text' },
      ]),
      (id, value) => {
        changes.push([id, value]);
      },
    );
    const picker = container.querySelector<HTMLInputElement>('input[type=color]');

    assert.ok(picker);
    assert.equal(picker.value, '#336699');

    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

      set?.call(picker, '#ABCDEF');
      picker.dispatchEvent(new Event('input', { bubbles: true }));
    });

    assert.deepEqual(changes.at(-1), ['tint', '#abcdef']);
  });

  it('keeps the triangle color control', async () => {
    const container = await render(
      toolWith('css-triangle', [
        { defaultValue: '#2563eb', id: 'color', label: 'Color', type: 'text' },
      ]),
    );

    assert.ok(container.querySelector('input[type=color]'));
  });

  it('writes plain hex into hex-only fields and keeps alpha for the triangle', async () => {
    for (const [preview, start, expected] of [
      ['css-glass', '', '#abcdef'],
      ['css-glass', 'nonsense', '#abcdef'],
      ['css-glass', 'rgba(1, 2, 3, 0.5)', '#abcdef'],
      ['css-glass', '#01020380', '#abcdef'],
      ['css-triangle', 'rgba(1, 2, 3, 0.5)', 'rgba(171, 205, 239, 0.5)'],
    ] as const) {
      const changes: string[] = [];
      const field =
        preview === 'css-triangle'
          ? { defaultValue: start, id: 'color', label: 'Color', type: 'text' }
          : { defaultValue: start, id: 'tint', label: 'Tint', presentation: 'color', type: 'text' };
      const container = await render(toolWith(preview, [field]), (_id, value) => {
        changes.push(value);
      });
      const picker = container.querySelector<HTMLInputElement>('input[type=color]');

      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

        set?.call(picker, '#abcdef');
        picker?.dispatchEvent(new Event('input', { bubbles: true }));
      });

      assert.equal(changes.at(-1), expected, `${preview} ${start}`);
    }
  });

  it('names each color picker after its field and shows one label per field', async () => {
    const container = await render(
      toolWith('css-loader', [
        {
          defaultValue: '#2563eb',
          id: 'color',
          label: 'Color',
          presentation: 'color',
          type: 'text',
        },
        {
          defaultValue: 'nonsense',
          id: 'trackColor',
          label: 'Track color',
          presentation: 'color',
          type: 'text',
        },
      ]),
    );
    const pickers = [...container.querySelectorAll<HTMLInputElement>('input[type=color]')];

    assert.deepEqual(
      pickers.map((picker) => picker.getAttribute('aria-label')),
      ['Color picker', 'Track color picker'],
    );

    assert.deepEqual(
      [...container.querySelectorAll('label')].map((label) => label.textContent),
      ['Color', 'Track color'],
    );

    assert.equal(pickers[1]?.value, '#808080');

    const trackLabel = [...container.querySelectorAll('label')].find(
      (label) => label.textContent === 'Track color',
    );

    assert.equal(
      (document.getElementById(trackLabel?.htmlFor ?? '') as HTMLInputElement | null)?.value,
      'nonsense',
    );
  });

  it('writes a preset curve into the point rows and turns a point edit into custom', async () => {
    const changes: Array<[string, string]> = [];
    const point = (id: string, min: number) => ({
      id,
      label: id,
      range: { max: min === 0 ? 1 : 2, min, step: 0.01 },
      type: 'number',
    });
    const container = await render(
      toolWith('css-easing', [
        {
          defaultValue: 'custom',
          id: 'preset',
          label: 'Preset',
          options: [
            { label: 'Custom curve', value: 'custom' },
            { label: 'Ease out back', value: 'easeOutBack' },
          ],
          type: 'select',
        },
        point('x1', 0),
        point('y1', -1),
        point('x2', 0),
        point('y2', -1),
      ]),
      (id, value) => {
        changes.push([id, value]);
      },
    );
    const select = container.querySelector('select');

    await act(async () => {
      if (select) select.value = 'easeOutBack';

      select?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    assert.deepEqual(changes, [
      ['preset', 'easeOutBack'],
      ['x1', '0.34'],
      ['y1', '1.56'],
      ['x2', '0.64'],
      ['y2', '1'],
    ]);

    changes.length = 0;
    const slider = container.querySelector<HTMLInputElement>('input[aria-label="y2 slider"]');

    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

      set?.call(slider, '1.2');
      slider?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    assert.deepEqual(changes, [
      ['y2', '1.2'],
      ['preset', 'custom'],
    ]);
  });
});
