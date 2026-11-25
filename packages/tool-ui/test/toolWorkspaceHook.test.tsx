// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useToolWorkspace, type ToolInputSeed, type ToolRunnerHost } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tools: SerializedToolDefinition[] = [
  {
    autoRun: true,
    category: 'Text',
    description: 'Upper.',
    freshResults: true,
    id: 'upper-tool',
    inputKind: 'text',
    name: 'Upper Tool',
    outputKind: 'text',
    supportsSelection: false,
  },
  {
    category: 'Text',
    description: 'Manual.',
    id: 'manual-tool',
    inputKind: 'text',
    name: 'Manual Tool',
    outputKind: 'text',
    supportsSelection: false,
  },
];

class FakeWorker extends EventTarget {
  postMessage(message: {
    fields: Record<string, string>;
    id: string;
    text: string;
    toolId: string;
    type: string;
  }): void {
    if (message.type === 'getTool') {
      const tool = tools.find((item) => item.id === message.toolId);
      const data = tool
        ? { id: message.id, ok: true, tool, type: 'getTool' }
        : { error: `Unknown tool: ${message.toolId}`, id: message.id, ok: false };

      queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));

      return;
    }

    queueMicrotask(() =>
      this.dispatchEvent(
        new MessageEvent('message', {
          data: {
            id: message.id,
            ok: true,
            result: { text: message.text.toUpperCase() },
            type: 'runTool',
          },
        }),
      ),
    );
  }

  terminate(): void {}
}

const host: ToolRunnerHost = { createWorker: () => new FakeWorker() as unknown as Worker };

type HarnessProps = {
  initialInput?: ToolInputSeed;
  metadataId: string;
  onInputsChange?(text: string, fields: Record<string, string>): void;
};

function Harness({ initialInput, metadataId, onInputsChange }: HarnessProps) {
  const workspace = useToolWorkspace({ host, initialInput, metadataId, onInputsChange });

  return (
    <div
      data-result={workspace.runner.result?.text ?? ''}
      data-reveal={String(workspace.shouldRevealError)}
      data-stale={String(workspace.isStale)}
      data-text={workspace.inputs.text}
    >
      <button type="button" onClick={() => workspace.inputs.onTextChange('abc')}>
        abc
      </button>
      <button type="button" onClick={() => workspace.inputs.onTextChange('abcd')}>
        abcd
      </button>
      <button type="button" onClick={workspace.handleRun}>
        Run
      </button>
    </div>
  );
}

class SilentWorker extends EventTarget {
  postMessage(): void {}

  terminate(): void {}
}

const silentHost: ToolRunnerHost = { createWorker: () => new SilentWorker() as unknown as Worker };

function PendingHarness({ initialDefinition }: { initialDefinition?: SerializedToolDefinition }) {
  const workspace = useToolWorkspace({
    host: silentHost,
    initialDefinition,
    initialInput: { key: 'seed', text: 'abc' },
    metadataId: 'pending-tool',
  });

  return <div data-can-run={String(workspace.canRun)} data-tool={workspace.tool?.id ?? ''} />;
}

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

describe('useToolWorkspace', () => {
  it('auto-runs 250 ms after the input changes and marks the old result stale meanwhile', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const state = () => container.firstElementChild as HTMLElement;

    await act(async () => {
      root.render(<Harness metadataId="upper-tool" />);
    });

    await wait(0);

    await act(async () => {
      container.querySelectorAll('button')[0]?.click();
    });

    assert.equal(state().dataset.result, '');
    await wait(320);
    assert.equal(state().dataset.result, 'ABC');
    assert.equal(state().dataset.stale, 'false');

    await act(async () => {
      container.querySelectorAll('button')[1]?.click();
    });

    assert.equal(state().dataset.result, 'ABC');
    assert.equal(state().dataset.stale, 'true');
    await wait(320);
    assert.equal(state().dataset.result, 'ABCD');
    assert.equal(state().dataset.stale, 'false');

    await act(async () => {
      root.unmount();
    });
  });

  it('reveals the error of a manual run only, never of an auto-run', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const state = () => container.firstElementChild as HTMLElement;
    const click = (index: number) =>
      act(async () => {
        container.querySelectorAll('button')[index]?.click();
      });

    await act(async () => {
      root.render(<Harness metadataId="upper-tool" />);
    });

    await wait(0);
    await click(0);
    await wait(320);
    assert.equal(state().dataset.reveal, 'false');
    await click(2);
    await wait(0);
    assert.equal(state().dataset.reveal, 'true');
    await click(1);
    await wait(320);
    assert.equal(state().dataset.result, 'ABCD');
    assert.equal(state().dataset.reveal, 'false');

    await act(async () => {
      root.unmount();
    });
  });

  it('clears the result when metadataId changes', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const state = () => container.firstElementChild as HTMLElement;

    await act(async () => {
      root.render(<Harness metadataId="upper-tool" />);
    });

    await wait(0);

    await act(async () => {
      container.querySelector('button')?.click();
    });

    await wait(320);
    assert.equal(state().dataset.result, 'ABC');

    await act(async () => {
      root.render(<Harness metadataId="manual-tool" />);
    });

    assert.equal(state().dataset.result, '');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows the initial definition until the worker answers, without running it', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const state = () => container.firstElementChild as HTMLElement;

    await act(async () => {
      root.render(<PendingHarness />);
    });

    assert.equal(state().dataset.tool, '');

    await act(async () => {
      root.render(<PendingHarness initialDefinition={{ ...tools[1]!, id: 'pending-tool' }} />);
    });

    assert.equal(state().dataset.tool, 'pending-tool');
    assert.equal(state().dataset.canRun, 'false');

    await act(async () => {
      root.unmount();
    });
  });

  it('seeds the input from initialInput and reports changes', async () => {
    const changes: string[] = [];
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const state = () => container.firstElementChild as HTMLElement;

    await act(async () => {
      root.render(
        <Harness
          initialInput={{ key: 'seed', text: 'seeded' }}
          metadataId="manual-tool"
          onInputsChange={(text) => changes.push(text)}
        />,
      );
    });

    await wait(0);
    assert.equal(state().dataset.text, 'seeded');

    await act(async () => {
      container.querySelector('button')?.click();
    });

    assert.equal(state().dataset.text, 'abc');
    assert.equal(changes.at(-1), 'abc');

    await act(async () => {
      root.unmount();
    });
  });
});
