// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useToolRunner, type ToolRunnerHost } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const isolatedTool: SerializedToolDefinition = {
  category: 'Text',
  description: 'Isolated.',
  id: 'isolated-tool',
  inputKind: 'text',
  isolatedWorker: true,
  name: 'Isolated Tool',
  outputKind: 'text',
  supportsSelection: false,
};

class RecordingWorker extends EventTarget {
  constructor(
    readonly kind: string,
    readonly runs: string[],
  ) {
    super();
  }

  postMessage(message: { id: string; text?: string; type: string }): void {
    if (message.type === 'runTool') this.runs.push(this.kind);

    const data =
      message.type === 'getTool'
        ? { id: message.id, ok: true, tool: isolatedTool, type: 'getTool' }
        : { id: message.id, ok: true, result: { text: this.kind }, type: 'runTool' };

    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));
  }

  terminate(): void {}
}

async function runIsolatedTool(host: ToolRunnerHost): Promise<string | undefined> {
  let runner: ReturnType<typeof useToolRunner> | undefined;

  function Probe() {
    runner = useToolRunner(host, isolatedTool.id);

    return null;
  }

  const root = createRoot(document.body.appendChild(document.createElement('div')));

  await act(async () => {
    root.render(<Probe />);
    await Promise.resolve();
  });

  await act(async () => {
    runner?.runTool(isolatedTool.id, { fields: {}, text: 'x' });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const text = runner?.result?.text;

  await act(async () => {
    root.unmount();
  });

  return text;
}

describe('isolated worker runs', () => {
  it('start the worker from createIsolatedWorker when the host has one', async () => {
    const runs: string[] = [];
    const host: ToolRunnerHost = {
      createIsolatedWorker: () => new RecordingWorker('isolated', runs) as unknown as Worker,
      createWorker: () => new RecordingWorker('shared', runs) as unknown as Worker,
    };

    assert.equal(await runIsolatedTool(host), 'isolated');
    assert.deepEqual(runs, ['isolated']);
  });

  it('fall back to createWorker for a new worker per run', async () => {
    const runs: string[] = [];
    let created = 0;
    const host: ToolRunnerHost = {
      createWorker: () => {
        created += 1;

        return new RecordingWorker('shared', runs) as unknown as Worker;
      },
    };

    assert.equal(await runIsolatedTool(host), 'shared');
    assert.deepEqual(runs, ['shared']);
    assert.equal(created, 2);
  });
});
