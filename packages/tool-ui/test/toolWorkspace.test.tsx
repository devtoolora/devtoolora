// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolWorkspace, useToolRunner, type ToolRunnerHost } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const demoTool: SerializedToolDefinition = {
  category: 'Text',
  description: 'Demo.',
  id: 'demo-tool',
  inputKind: 'text',
  name: 'Demo Tool',
  outputKind: 'text',
  supportsSelection: false,
};

const otherTool: SerializedToolDefinition = { ...demoTool, id: 'other-tool', name: 'Other Tool' };
const lateTool: SerializedToolDefinition = { ...demoTool, id: 'late-tool', name: 'Late Tool' };
const fakeCatalog = [demoTool, otherTool, lateTool];

class FakeWorker extends EventTarget {
  postMessage(message: { id: string; toolId?: string; type: string }): void {
    const tool = fakeCatalog.find((item) => item.id === message.toolId);
    const data =
      message.type === 'getTool' && tool
        ? { id: message.id, ok: true, tool, type: 'getTool' }
        : { error: `Unknown tool: ${message.toolId}`, id: message.id, ok: false };

    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));
  }

  terminate(): void {}
}

class FailingWorker extends EventTarget {
  postMessage(message: { id: string }): void {
    const data = { error: 'Chunk failed', id: message.id, ok: false };

    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));
  }

  terminate(): void {}
}

function mount(host: ToolRunnerHost, metadataId: string) {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const render = (id: string) =>
    act(async () => {
      root.render(<ToolWorkspace host={host} metadataId={id} onDefinitionLoad={() => {}} />);
      await Promise.resolve();
    });

  return { container, render, root, ready: render(metadataId) };
}

describe('ToolWorkspace host adapter', () => {
  it('creates its worker through the host and renders the tool from the listed catalog', async () => {
    let created = 0;
    const host: ToolRunnerHost = {
      createWorker: () => {
        created += 1;

        return new FakeWorker() as unknown as Worker;
      },
    };
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToolWorkspace host={host} metadataId="demo-tool" onDefinitionLoad={() => {}} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    assert.equal(created, 1);

    assert.match(
      container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '',
      /Run Demo Tool/,
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('renders the host back link next to Retry when the worker cannot start', async () => {
    const host: ToolRunnerHost = {
      createWorker: () => {
        throw new Error('no worker here');
      },
    };
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ToolWorkspace
          backLink={<a href="/tools">Back to tools</a>}
          host={host}
          metadataId="demo-tool"
          onDefinitionLoad={() => {}}
        />,
      );
    });

    // The heading wording depends on whether an earlier test already cached the catalog; the
    // failure state itself is what matters.
    assert.ok(container.querySelector('[role="alert"] h2'), 'failure heading');
    assert.ok(container.querySelector('[role="alert"] button'), 'Retry button');
    assert.equal(container.querySelector('a[href="/tools"]')?.textContent, 'Back to tools');

    await act(async () => {
      root.unmount();
    });
  });

  it('requests a new definition when the tool id changes', async () => {
    const host: ToolRunnerHost = { createWorker: () => new FakeWorker() as unknown as Worker };
    const { container, render, root, ready } = mount(host, 'demo-tool');

    await ready;

    await act(async () => {
      await Promise.resolve();
    });

    assert.match(
      container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '',
      /Run Demo Tool/,
    );

    await render('other-tool');

    await act(async () => {
      await Promise.resolve();
    });

    const label = container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '';

    assert.match(label, /Run Other Tool/);
    assert.doesNotMatch(label, /Demo Tool/);

    await act(async () => {
      root.unmount();
    });
  });

  it('reports an error when the definition request fails', async () => {
    const host: ToolRunnerHost = { createWorker: () => new FailingWorker() as unknown as Worker };
    const { container, root, ready } = mount(host, 'demo-tool');

    await ready;

    await act(async () => {
      await Promise.resolve();
    });

    assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /Chunk failed/);
    assert.ok(container.querySelector('[role="alert"] button'), 'Retry button');

    await act(async () => {
      root.unmount();
    });
  });

  it('never reports the previous tool under a new tool id, not even for one render', async () => {
    const host: ToolRunnerHost = { createWorker: () => new FakeWorker() as unknown as Worker };
    const renders: string[] = [];

    function Probe({ toolId }: { toolId: string }) {
      const runner = useToolRunner(host, toolId);

      renders.push(`${toolId}|${runner.tool?.id ?? '-'}|${runner.definitionStatus}`);

      return null;
    }

    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    for (const toolId of ['demo-tool', 'other-tool']) {
      await act(async () => {
        root.render(<Probe toolId={toolId} />);
        await Promise.resolve();
      });
    }

    assert.equal(renders.includes('other-tool|demo-tool|ready'), false, renders.join('\n'));
    assert.ok(renders.includes('other-tool|other-tool|ready'), renders.join('\n'));

    await act(async () => {
      root.unmount();
    });
  });

  it('drops a run reply that arrives after the tool changed', async () => {
    class SlowRunWorker extends FakeWorker {
      pending: Array<() => void> = [];
      override postMessage(message: { id: string; toolId?: string; type: string }): void {
        if (message.type === 'runTool') {
          const data = { id: message.id, ok: true, result: { text: 'late' }, type: 'runTool' };

          this.pending.push(() => this.dispatchEvent(new MessageEvent('message', { data })));

          return;
        }

        super.postMessage(message);
      }
    }

    const worker = new SlowRunWorker();
    const host: ToolRunnerHost = { createWorker: () => worker as unknown as Worker };
    let runner: ReturnType<typeof useToolRunner> | undefined;

    function Probe({ toolId }: { toolId: string }) {
      runner = useToolRunner(host, toolId);

      return null;
    }

    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => {
      root.render(<Probe toolId="demo-tool" />);
      await Promise.resolve();
    });

    await act(async () => {
      runner?.runTool('demo-tool', { fields: {}, text: 'x' });
    });

    await act(async () => {
      root.render(<Probe toolId="other-tool" />);
      await Promise.resolve();
    });

    await act(async () => {
      worker.pending.splice(0).forEach((reply) => reply());
    });

    assert.equal(runner?.result, undefined);
    assert.equal(runner?.isRunning, false);

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps one worker across tool switches', async () => {
    let created = 0;
    const host: ToolRunnerHost = {
      createWorker: () => {
        created += 1;

        return new FakeWorker() as unknown as Worker;
      },
    };
    const { container, render, root, ready } = mount(host, 'demo-tool');

    await ready;

    await act(async () => {
      await Promise.resolve();
    });

    await render('other-tool');

    await act(async () => {
      await Promise.resolve();
    });

    assert.equal(created, 1);

    assert.match(
      container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '',
      /Run Other Tool/,
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('starts a new worker for the next tool after the worker died', async () => {
    class DyingWorker extends FakeWorker {
      override postMessage(message: { id: string; toolId?: string; type: string }): void {
        if (message.toolId === 'demo-tool') {
          queueMicrotask(() => this.dispatchEvent(new ErrorEvent('error', { message: 'boom' })));

          return;
        }

        super.postMessage(message);
      }
    }

    let created = 0;
    const host: ToolRunnerHost = {
      createWorker: () => {
        created += 1;

        return new DyingWorker() as unknown as Worker;
      },
    };
    const { container, render, root, ready } = mount(host, 'demo-tool');

    await ready;

    await act(async () => {
      await Promise.resolve();
    });

    assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /boom/);
    await render('other-tool');

    await act(async () => {
      await Promise.resolve();
    });

    assert.equal(created, 2);

    assert.match(
      container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '',
      /Run Other Tool/,
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('ignores a late definition reply for the previous tool', async () => {
    class LateWorker extends FakeWorker {
      pending: Array<() => void> = [];
      override postMessage(message: { id: string; toolId?: string; type: string }): void {
        if (message.toolId === 'late-tool') {
          this.pending.push(() => super.postMessage(message));

          return;
        }

        super.postMessage(message);
      }
    }

    const worker = new LateWorker();
    const host: ToolRunnerHost = { createWorker: () => worker as unknown as Worker };
    const { container, render, root, ready } = mount(host, 'late-tool');

    await ready;
    await render('other-tool');

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      worker.pending.splice(0).forEach((reply) => reply());
      await Promise.resolve();
    });

    assert.match(
      container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '',
      /Run Other Tool/,
    );

    await render('late-tool');

    await act(async () => {
      worker.pending.splice(0).forEach((reply) => reply());
      await Promise.resolve();
    });

    assert.match(
      container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '',
      /Run Late Tool/,
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('runs on Cmd/Ctrl+Enter only from inside the workspace and only when the tool can run', async () => {
    const runs: string[] = [];

    class RunWorker extends FakeWorker {
      override postMessage(message: { id: string; toolId?: string; type: string }): void {
        if (message.type === 'runTool') runs.push(message.id);
        else super.postMessage(message);
      }
    }

    const host: ToolRunnerHost = { createWorker: () => new RunWorker() as unknown as Worker };
    const { container, root, ready } = mount(host, 'demo-tool');

    await ready;

    await act(async () => {
      await Promise.resolve();
    });

    const textarea = container.querySelector('textarea')!;

    const press = (target: EventTarget) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        key: 'Enter',
      });

      target.dispatchEvent(event);

      return event.defaultPrevented;
    };

    assert.equal(press(textarea), false);

    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        textarea,
        'x',
      );

      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    assert.equal(press(window), false);
    assert.equal(press(document.body), false);
    assert.equal(runs.length, 0);
    assert.equal(press(textarea), true);
    assert.equal(runs.length, 1);

    await act(async () => {
      root.unmount();
    });
  });
});
