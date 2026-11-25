// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useToolInputs, type ToolInputSeed } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tool: SerializedToolDefinition = {
  category: 'Text',
  description: 'Demo.',
  fields: [
    {
      defaultValue: 'custom',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Custom', value: 'custom' },
        { label: 'Bytes', value: 'bytes' },
      ],
      type: 'select',
    },
  ],
  id: 'demo-tool',
  inputKind: 'text',
  name: 'Demo Tool',
  outputKind: 'text',
  supportsSelection: false,
};

type HarnessProps = {
  seed?: ToolInputSeed;
  onInputsChange?(text: string, fields: Record<string, string>): void;
};

function Harness({ seed, onInputsChange }: HarnessProps) {
  const inputs = useToolInputs(tool, seed, onInputsChange);

  return (
    <div data-fields={JSON.stringify(inputs.fields)} data-text={inputs.text}>
      <button type="button" onClick={() => inputs.onTextChange('hello')}>
        type
      </button>
    </div>
  );
}

describe('useToolInputs seed', () => {
  it('applies a new seed when its key changes and reports input changes', async () => {
    const changes: Array<[string, Record<string, string>]> = [];
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const state = () => ({
      fields: JSON.parse(
        container.firstElementChild?.getAttribute('data-fields') ?? '{}',
      ) as Record<string, string>,
      text: container.firstElementChild?.getAttribute('data-text'),
    });
    const render = (seed: ToolInputSeed) =>
      act(async () => {
        root.render(
          <Harness seed={seed} onInputsChange={(text, fields) => changes.push([text, fields])} />,
        );
      });

    await render({ key: 'a', text: 'first' });
    assert.equal(state().text, 'first');
    assert.deepEqual(state().fields, { mode: 'custom' });

    await render({ fields: { mode: 'bytes' }, key: 'b', text: 'second' });
    assert.equal(state().text, 'second');
    assert.deepEqual(state().fields, { mode: 'bytes' });

    await render({ fields: { mode: 'custom' }, key: 'b', text: 'ignored' });
    assert.equal(state().text, 'second');

    await act(async () => {
      container.querySelector('button')?.click();
    });

    assert.equal(state().text, 'hello');
    assert.deepEqual(changes.at(-1), ['hello', { mode: 'bytes' }]);

    await act(async () => {
      root.unmount();
    });
  });
});
