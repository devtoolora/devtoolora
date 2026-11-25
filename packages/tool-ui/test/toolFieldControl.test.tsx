// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { ToolField } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolFieldControl, type ToolPlatformActions } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fileField: ToolField = { id: 'image', label: 'Image', maxBytes: 1_500_000, type: 'file' };
const textField: ToolField = { id: 'image', label: 'Image', type: 'text' };

function mount() {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const calls: string[] = [];
  const render = (
    field: ToolField,
    platformActions?: ToolPlatformActions,
    value = '',
    fileName?: string,
  ) =>
    act(async () => {
      root.render(
        <ToolFieldControl
          field={field}
          fileName={fileName}
          platformActions={platformActions}
          value={value}
          onFileNameChange={(name) => calls.push(`name:${name}`)}
          onValueChange={(next) => calls.push(`value:${next}`)}
        />,
      );
    });

  return { calls, container, render, root };
}

describe('ToolFieldControl', () => {
  it('counts the files of a multiple file field, with their names when known', async () => {
    const view = mount();
    const field: ToolField = { ...fileField, label: 'Images', multiple: true };
    const files = (count: number) =>
      JSON.stringify(
        Array.from({ length: count }, (_, index) => ({ data: 'data:,', name: `${index}.png` })),
      );
    const selected = () => view.container.querySelector('.selected-file-name')?.textContent;

    await view.render(field, undefined, files(3));
    assert.equal(selected(), '3 files selected');
    await view.render(field, undefined, files(1));
    assert.equal(selected(), '1 file selected');
    await view.render(field, undefined, files(2), 'a.png, b.png');
    assert.equal(selected(), '2 files selected · a.png, b.png');

    await act(async () => {
      view.root.unmount();
    });
  });

  it('names the native file button by its label and keeps a leading acronym', async () => {
    const view = mount();
    const picker: ToolPlatformActions = {
      copyText: async () => {},
      pickFiles: async () => [],
      saveFile: async () => true,
    };

    await view.render({ ...fileField, label: 'SVG file (optional)' }, picker);

    assert.equal(
      view.container.querySelector('button')?.textContent,
      'Choose SVG file (optional)…',
    );

    await view.render({ ...fileField, label: 'Local file' }, picker);
    assert.equal(view.container.querySelector('button')?.textContent, 'Choose local file…');

    await act(async () => {
      view.root.unmount();
    });
  });

  it('keeps a native picker failure across a field type change and falls back to the browser input', async () => {
    const view = mount();
    const failingPicker: ToolPlatformActions = {
      copyText: async () => {},
      pickFiles: async () => {
        throw new Error('Picker unavailable');
      },
      saveFile: async () => true,
    };

    await view.render(fileField, failingPicker);
    assert.equal(view.container.querySelector('button')?.textContent, 'Choose image…');

    await act(async () => {
      view.container.querySelector('button')?.click();
      await Promise.resolve();
    });

    assert.equal(view.container.querySelector('[role="alert"]')?.textContent, 'Picker unavailable');
    assert.ok(view.container.querySelector('input[type="file"]'), 'browser file input');
    assert.deepEqual(view.calls, ['value:', 'name:']);
    await view.render(textField, failingPicker);
    assert.equal(view.container.querySelector('[role="alert"]'), null);
    await view.render(fileField, failingPicker);
    assert.equal(view.container.querySelector('[role="alert"]')?.textContent, 'Picker unavailable');
    assert.ok(view.container.querySelector('input[type="file"]'), 'still the browser file input');

    await act(async () => {
      view.root.unmount();
    });
  });

  it('applies natively picked files and rejects oversized browser files', async () => {
    const view = mount();
    const picker: ToolPlatformActions = {
      copyText: async () => {},
      pickFiles: async () => [{ data: 'data:image/png;base64,AAAA', name: 'a.png' }],
      saveFile: async () => true,
    };

    await view.render(fileField, picker);

    await act(async () => {
      view.container.querySelector('button')?.click();
      await Promise.resolve();
    });

    assert.deepEqual(view.calls, ['value:data:image/png;base64,AAAA', 'name:a.png']);
    view.calls.length = 0;
    await view.render(fileField, undefined, 'data:image/png;base64,AAAA');

    assert.equal(
      view.container.querySelector('.selected-file-name')?.textContent,
      'Sample file · 3 bytes',
    );

    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' });

    Object.defineProperty(input, 'files', { configurable: true, value: [big] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    assert.deepEqual(view.calls, ['value:', 'name:']);

    assert.equal(
      view.container.querySelector('[role="alert"]')?.textContent,
      'File must be at most 1.4 MiB.',
    );

    await act(async () => {
      view.root.unmount();
    });
  });

  it('keeps the focused file input and empties it, so the same file fires again', async () => {
    const view = mount();

    await view.render(fileField, undefined, '');

    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    let emptied = false;

    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: (next: string) => void (emptied = next === ''),
    });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await view.render(fileField, undefined, 'data:image/png;base64,AAAA');

    assert.ok(view.container.querySelector('input[type="file"]') === input, 'input remounted');
    assert.equal(emptied, true);

    await act(async () => {
      view.root.unmount();
    });
  });

  it('toggles checkbox group values and segmented options', async () => {
    const view = mount();
    const options = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ];

    await view.render({ id: 'g', label: 'Group', options, type: 'checkboxGroup' }, undefined, 'a');

    await act(async () => {
      view.container.querySelectorAll<HTMLInputElement>('input')[1]?.click();
      view.container.querySelectorAll<HTMLInputElement>('input')[0]?.click();
    });

    assert.deepEqual(view.calls, ['value:a,b', 'value:']);
    view.calls.length = 0;

    await view.render(
      { id: 's', label: 'Seg', options, presentation: 'segmented', type: 'select' },
      undefined,
      'a',
    );

    await act(async () => {
      view.container.querySelectorAll<HTMLButtonElement>('button')[1]?.click();
    });

    assert.deepEqual(view.calls, ['value:b']);

    await act(async () => {
      view.root.unmount();
    });
  });

  it('renders a slider and number input for a ranged number field', async () => {
    const view = mount();
    const field: ToolField = {
      id: 'n',
      label: 'Size',
      range: { max: 10, min: 0, step: 1, unit: 'px' },
      type: 'number',
    };

    await view.render(field, undefined, '3');
    const slider = view.container.querySelector<HTMLInputElement>(
      'input[type=range][min="0"][max="10"]',
    );

    assert.ok(slider);
    assert.ok(view.container.querySelector('input[type=number]'));

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, '7');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    assert.deepEqual(view.calls, ['value:7']);
  });

  it('keeps the slider up to a 10,000 span and drops it for wider ranges', async () => {
    const view = mount();
    const field = (min: number, max: number, step: number): ToolField => ({
      id: 'n',
      label: 'Value',
      range: { max, min, step },
      type: 'number',
    });
    const slider = () => view.container.querySelector('input[type=range]');
    const number = () => view.container.querySelector<HTMLInputElement>('input[type=number]');

    await view.render(field(1, 9999, 1), undefined, '42');
    assert.ok(slider());
    await view.render(field(1, 500, 0.01), undefined, '16');
    assert.ok(slider());
    await view.render(field(-1_000_000, 1_000_000, 0.01), undefined, '24');
    assert.equal(slider(), null);
    assert.equal(number()?.min, '-1000000');
    assert.equal(number()?.step, '0.01');
  });

  it('renders a color picker for a presentation color field outside css previews', async () => {
    const view = mount();
    const field = { id: 'c', label: 'Tint', presentation: 'color', type: 'text' } as ToolField;

    await view.render(field, undefined, 'rgba(1, 2, 3, 0.5)');
    const picker = view.container.querySelector<HTMLInputElement>(
      'input[aria-label="Tint picker"]',
    );

    assert.ok(picker);
    assert.equal(view.container.querySelectorAll('label').length, 1);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        picker,
        '#abcdef',
      );

      picker.dispatchEvent(new Event('input', { bubbles: true }));
    });

    assert.deepEqual(view.calls, ['value:#abcdef']);
  });

  it('shows any parsed css color in the swatch of a presentation color field', async () => {
    const view = mount();
    const field = { id: 'c', label: 'Tint', presentation: 'color', type: 'text' } as ToolField;
    const swatch = () =>
      view.container.querySelector<HTMLInputElement>('input[aria-label="Tint picker"]')?.value;

    await view.render(field, undefined, 'rebeccapurple');
    assert.equal(swatch(), '#663399');
    await view.render(field, undefined, 'rgb(255 0 0 / 0.4)');
    assert.equal(swatch(), '#ff0000');
    await view.render(field, undefined, 'oklch(70% 0.4 150)');
    assert.match(swatch() ?? '', /^#[0-9a-f]{6}$/);
    await view.render(field, undefined, 'nope');
    assert.equal(swatch(), '#808080');
  });

  it('describes ranged and text fields with their help text', async () => {
    const view = mount();
    const field: ToolField = {
      help: 'Pick a size',
      id: 'n',
      label: 'Size',
      range: { max: 10, min: 0 },
      type: 'number',
    };

    const description = (selector: string) => {
      const id = view.container.querySelector(selector)?.getAttribute('aria-describedby');

      return id ? document.getElementById(id)?.textContent : undefined;
    };

    await view.render(field, undefined, '3');
    assert.equal(description('input[type=number]'), 'Pick a size');
    assert.equal(description('input[type=range]'), 'Pick a size');
    await view.render({ help: 'Shown below', id: 't', label: 'Name', type: 'text' }, undefined, '');
    assert.equal(description('input[type=text]'), 'Shown below');
  });

  it('stops browsers from offering saved passwords on password fields', async () => {
    const view = mount();

    await view.render({ id: 'password', label: 'Password', type: 'password' });

    assert.equal(
      view.container.querySelector('input')?.getAttribute('autocomplete'),
      'new-password',
    );

    await act(async () => {
      view.root.unmount();
    });
  });
});
