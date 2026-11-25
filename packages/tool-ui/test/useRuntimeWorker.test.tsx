// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import type { SerializedToolDefinition, ToolInput, ToolRuntime } from '@devtoolora/core';
import {
  runtimeManifest,
  WASM_SIMD_MESSAGE,
  type RuntimeFileRecord,
} from '@devtoolora/functions/runtime';
import type { ToolRunnerHost } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const simd = vi.hoisted(() => ({ supported: true }));

vi.mock('@devtoolora/functions/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@devtoolora/functions/runtime')>()),
  supportsWasmSimd: () => simd.supported,
}));

const baseTool: SerializedToolDefinition = {
  category: 'Text',
  description: 'Runtime demo.',
  id: 'ocr-demo',
  inputKind: 'text',
  name: 'OCR Demo',
  outputKind: 'text',
  runtime: 'ocr',
  supportsSelection: false,
};

const heicTool: SerializedToolDefinition = {
  ...baseTool,
  id: 'heic-demo',
  name: 'HEIC Demo',
  runtime: 'heic',
};

const catalog = [baseTool, heicTool];
const SCRIPT_BASE = 'https://example.test/assets/runtime/';

type RuntimeManifestJson = Record<ToolRuntime, RuntimeFileRecord[]>;

type PostedMessage = {
  message: {
    files?: Record<string, ArrayBuffer>;
    id: string;
    records?: RuntimeFileRecord[];
    runtime?: ToolRuntime;
    scriptBaseUrl?: string;
    type: string;
  };
  transfer: Transferable[];
};

function at<T>(items: T[], index: number): T {
  const item = items[index];

  assert.ok(item, `item ${index}`);

  return item;
}

class FakeSharedWorker extends EventTarget {
  postMessage(message: { id: string; toolId?: string }): void {
    const tool = catalog.find((item) => item.id === message.toolId);
    const data = { id: message.id, ok: true, tool, type: 'getTool' };

    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));
  }

  terminate(): void {}
}

class FakeRuntimeWorker extends EventTarget {
  readonly messages: PostedMessage[] = [];
  terminated = false;

  constructor(
    private readonly hangsRuns: boolean,
    private readonly runError?: string,
  ) {
    super();
  }

  postMessage(message: PostedMessage['message'], transfer: Transferable[] = []): void {
    this.messages.push({ message, transfer });
    const data = this.replyTo(message);

    if (data) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));
  }

  posted(index: number): PostedMessage {
    return at(this.messages, index);
  }

  terminate(): void {
    this.terminated = true;
  }

  types(): string[] {
    return this.messages.map((posted) => posted.message.type);
  }

  private replyTo({ id, type }: PostedMessage['message']): object | undefined {
    if (type === 'loadRuntime') return { id, ok: true, type: 'runtimeReady' };
    if (type === 'addRuntimeFiles') return { id, ok: true, type: 'runtimeFilesAdded' };
    if (this.hangsRuns) return undefined;
    if (this.runError) return { error: this.runError, id, ok: false };

    return { id, ok: true, result: { text: 'recognized' }, type: 'runTool' };
  }
}

type FakeHostOptions = {
  failOnce?: string;
  gate?: { name: string; release: Promise<void> };
  hangsRuns?: boolean;
  manifest?: RuntimeManifestJson;
  runError?: string;
  runtimeSource?: 'bundled' | 'download';
};

function manifestJson(): RuntimeManifestJson {
  const strip = (runtime: ToolRuntime) =>
    runtimeManifest[runtime].map(({ source: _source, ...record }) => record);

  return { heic: strip('heic'), ocr: strip('ocr') };
}

function fakeHost(options: FakeHostOptions = {}) {
  const fetched: string[] = [];
  const workers: FakeRuntimeWorker[] = [];
  const failures = new Set(options.failOnce ? [options.failOnce] : []);
  const manifest = options.manifest ?? manifestJson();

  const host: ToolRunnerHost = {
    createRuntimeWorker: async () => {
      const worker = new FakeRuntimeWorker(options.hangsRuns ?? false, options.runError);

      workers.push(worker);

      return worker as unknown as Worker;
    },
    createWorker: () => new FakeSharedWorker() as unknown as Worker,
    fetchRuntimeFile: async (runtime, name, onProgress) => {
      fetched.push(name);

      if (failures.delete(name)) throw new Error(`Could not load ${name} (offline).`);
      if (name === 'runtime-manifest.json')
        return new TextEncoder().encode(JSON.stringify(manifest)).buffer as ArrayBuffer;

      const bytes = manifest[runtime].find((record) => record.name === name)?.bytes ?? 0;

      if (options.gate?.name === name) {
        onProgress(Math.round(bytes / 2));
        await options.gate.release;
      }

      onProgress(bytes);

      return new ArrayBuffer(16);
    },
    runtimeScriptBaseUrl: SCRIPT_BASE,
    runtimeSource: options.runtimeSource,
  };

  return { fetched, host, workers };
}

/** A fresh module graph per test: the runtime buffers live at module level for the page. */
async function loadUi() {
  vi.resetModules();
  const [{ act }, { createRoot }, ui] = await Promise.all([
    import('react'),
    import('react-dom/client'),
    import('../src'),
  ]);

  // Async steps here are microtasks only, so this also works under fake timers.
  const settle = () =>
    act(async () => {
      for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    });

  return { act, createRoot, settle, ui };
}

type Ui = Awaited<ReturnType<typeof loadUi>>;

async function mountWorkspace(
  { act, createRoot, settle, ui }: Ui,
  host: ToolRunnerHost,
  id: string,
) {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  await act(async () => {
    root.render(<ui.ToolWorkspace host={host} metadataId={id} onDefinitionLoad={() => {}} />);
  });

  await settle();

  return { container, root };
}

async function mountRunner({ act, createRoot, settle, ui }: Ui, host: ToolRunnerHost, id: string) {
  const probe: { runner?: ReturnType<typeof ui.useToolRunner> } = {};

  function Probe() {
    probe.runner = ui.useToolRunner(host, id);

    return null;
  }

  const root = createRoot(document.body.appendChild(document.createElement('div')));

  await act(async () => {
    root.render(<Probe />);
  });

  await settle();

  const runner = () => {
    assert.ok(probe.runner, 'runner mounted');

    return probe.runner;
  };

  const run = async (input: ToolInput) => {
    await act(async () => runner().runTool(id, input));
    await settle();
  };

  return { root, run, runner };
}

afterEach(() => {
  simd.supported = true;
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useRuntimeWorker', () => {
  it('host without runtime methods shows the unavailable message', async () => {
    const ui = await loadUi();
    const host: ToolRunnerHost = {
      createWorker: () => new FakeSharedWorker() as unknown as Worker,
    };
    const { container, root } = await mountWorkspace(ui, host, 'ocr-demo');

    assert.match(container.textContent ?? '', /This tool is not available here\./);
    assert.equal(container.querySelector('.tool-workspace'), null);

    await ui.act(async () => root.unmount());
  });

  it('fetches engine and English on open with progress', async () => {
    const ui = await loadUi();
    let release = () => {};
    const gate = {
      name: 'eng.traineddata.gzip',
      release: new Promise<void>((resolve) => (release = resolve)),
    };
    const { fetched, host, workers } = fakeHost({ gate });
    const { container, root } = await mountWorkspace(ui, host, 'ocr-demo');

    assert.deepEqual(fetched, [
      'runtime-manifest.json',
      'tesseract-core-simd-lstm.wasm',
      'eng.traineddata.gzip',
    ]);

    assert.match(container.textContent ?? '', /Loading OCR engine… \d+\.\d of 5\.8 MB/);
    assert.ok(container.querySelector('progress'), 'progress element');
    assert.equal(container.querySelector('[role="status"]')?.textContent, 'Loading OCR engine…');
    assert.equal(workers.length, 0);

    release();
    await ui.settle();

    assert.equal(workers.length, 1);
    const load = at(workers, 0).posted(0);

    assert.equal(load.message.type, 'loadRuntime');
    assert.equal(load.message.runtime, 'ocr');

    assert.deepEqual(Object.keys(load.message.files ?? {}).sort(), [
      'eng.traineddata.gzip',
      'tesseract-core-simd-lstm.wasm',
    ]);

    assert.deepEqual(new Set(load.transfer), new Set(Object.values(load.message.files ?? {})));
    assert.equal(container.querySelector('progress'), null);
    assert.ok(container.querySelector('.tool-workspace'));

    await ui.act(async () => root.unmount());
    assert.equal(at(workers, 0).terminated, true);
  });

  it('Czech is fetched once on demand', async () => {
    const ui = await loadUi();
    const { fetched, host, workers } = fakeHost();
    const { root, run, runner } = await mountRunner(ui, host, 'ocr-demo');

    await run({ fields: { language: 'eng+ces' }, text: '' });

    assert.equal(runner().result?.text, 'recognized');

    assert.deepEqual(
      fetched.filter((name) => name === 'ces.traineddata.gzip'),
      ['ces.traineddata.gzip'],
    );

    assert.deepEqual(at(workers, 0).types(), ['loadRuntime', 'addRuntimeFiles', 'runTool']);

    assert.deepEqual(Object.keys(at(workers, 0).posted(1).message.files ?? {}), [
      'ces.traineddata.gzip',
    ]);

    const fetchCount = fetched.length;

    await run({ fields: { language: 'eng+ces' }, text: '' });

    assert.equal(fetched.length, fetchCount);

    assert.deepEqual(at(workers, 0).types(), [
      'loadRuntime',
      'addRuntimeFiles',
      'runTool',
      'runTool',
    ]);

    await ui.act(async () => root.unmount());
    assert.equal(at(workers, 0).terminated, true);
  });

  it('replacing a run terminates the worker and the next run reuses buffers', async () => {
    const ui = await loadUi();
    const { fetched, host, workers } = fakeHost({ hangsRuns: true });
    const { root, run, runner } = await mountRunner(ui, host, 'ocr-demo');

    await run({ fields: { language: 'eng' }, text: '' });
    const fetchCount = fetched.length;

    assert.equal(runner().isRunning, true);

    await run({ fields: { language: 'eng' }, text: '' });

    assert.equal(workers.length, 2);
    assert.equal(at(workers, 0).terminated, true);
    assert.equal(at(workers, 1).terminated, false);
    assert.equal(fetched.length, fetchCount);

    const first = at(workers, 0).posted(0).message.files ?? {};
    const second = at(workers, 1).posted(0).message;

    assert.equal(second.type, 'loadRuntime');
    assert.deepEqual(Object.keys(second.files ?? {}).sort(), Object.keys(first).sort());

    for (const [name, buffer] of Object.entries(second.files ?? {}))
      assert.notEqual(buffer, first[name], `${name} is a fresh copy`);

    assert.deepEqual(at(workers, 1).types(), ['loadRuntime', 'runTool']);

    await ui.act(async () => root.unmount());
  });

  it('a wasm trap stops the worker so the next run starts a fresh one', async () => {
    const ui = await loadUi();
    const trap = fakeHost({ runError: 'memory access out of bounds' });
    const trapped = await mountRunner(ui, trap.host, 'ocr-demo');

    await trapped.run({ fields: { language: 'eng' }, text: '' });

    assert.equal(trapped.runner().error, 'memory access out of bounds');
    assert.equal(at(trap.workers, 0).terminated, true);

    const fetchCount = trap.fetched.length;

    await trapped.run({ fields: { language: 'eng' }, text: '' });

    assert.equal(trap.workers.length, 2);
    assert.deepEqual(at(trap.workers, 1).types(), ['loadRuntime', 'runTool']);
    assert.equal(trap.fetched.length, fetchCount);
    await ui.act(async () => trapped.root.unmount());

    const plain = fakeHost({ runError: 'This is not a HEIC/HEIF file.' });
    const failed = await mountRunner(ui, plain.host, 'ocr-demo');

    await failed.run({ fields: { language: 'eng' }, text: '' });

    assert.equal(failed.runner().error, 'This is not a HEIC/HEIF file.');
    assert.equal(at(plain.workers, 0).terminated, false);
    await ui.act(async () => failed.root.unmount());
  });

  it('times out after 120 seconds', async () => {
    vi.useFakeTimers();
    const ui = await loadUi();
    const { host, workers } = fakeHost({ hangsRuns: true });
    const { root, run, runner } = await mountRunner(ui, host, 'ocr-demo');

    await run({ fields: { language: 'eng' }, text: '' });

    await ui.act(async () => {
      await vi.advanceTimersByTimeAsync(119_999);
    });

    assert.equal(runner().isRunning, true);

    await ui.act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    await ui.settle();

    assert.equal(runner().error, 'The run exceeded the 120-second limit and was stopped.');
    assert.equal(runner().isRunning, false);
    assert.equal(at(workers, 0).terminated, true);

    await ui.act(async () => root.unmount());
  });

  it('offline open shows a retryable error and creates no worker', async () => {
    const ui = await loadUi();
    const { fetched, host, workers } = fakeHost({ failOnce: 'eng.traineddata.gzip' });
    const { root, runner } = await mountRunner(ui, host, 'ocr-demo');

    assert.equal(runner().error, 'Could not load eng.traineddata.gzip (offline).');
    assert.equal(runner().canRetry, true);
    assert.equal(workers.length, 0);

    const fetchCount = fetched.length;

    await ui.act(async () => runner().retryWorker());
    await ui.settle();

    assert.deepEqual(fetched.slice(fetchCount), ['eng.traineddata.gzip']);
    assert.equal(workers.length, 1);
    assert.equal(runner().error, '');
    assert.equal(runner().canRetry, false);

    await ui.act(async () => root.unmount());
  });

  it('missing SIMD shows the WebAssembly message', async () => {
    simd.supported = false;
    const ui = await loadUi();
    const { fetched, host } = fakeHost();
    const ocr = await mountWorkspace(ui, host, 'ocr-demo');

    assert.ok(ocr.container.textContent?.includes(WASM_SIMD_MESSAGE), 'SIMD message');
    assert.equal(ocr.container.querySelector('.tool-workspace'), null);
    assert.deepEqual(fetched, []);

    await ui.act(async () => ocr.root.unmount());

    const heic = await mountWorkspace(ui, host, 'heic-demo');

    assert.ok(heic.container.querySelector('.tool-workspace'), 'HEIC needs no SIMD');

    await ui.act(async () => heic.root.unmount());
  });

  it("download note only when runtimeSource is 'download'", async () => {
    const ui = await loadUi();
    const note = 'Downloads about 1.5 MB on first use. Cached for offline use.';
    const download = await mountWorkspace(
      ui,
      fakeHost({ runtimeSource: 'download' }).host,
      'heic-demo',
    );

    assert.ok(download.container.textContent?.includes(note), 'download note');

    await ui.act(async () => download.root.unmount());

    const bundled = await mountWorkspace(ui, fakeHost().host, 'heic-demo');

    assert.ok(bundled.container.querySelector('.tool-workspace'));
    assert.doesNotMatch(bundled.container.textContent ?? '', /Downloads about/);

    await ui.act(async () => bundled.root.unmount());
  });

  it('sends hashes from runtime-manifest.json', async () => {
    const ui = await loadUi();
    const manifest = manifestJson();
    const replaced = manifest.heic.map((record) =>
      record.name === 'libheif.wasm' ? { ...record, sha256: 'f'.repeat(64) } : record,
    );
    const { fetched, host, workers } = fakeHost({ manifest: { ...manifest, heic: replaced } });
    const { root } = await mountRunner(ui, host, 'heic-demo');
    const load = at(workers, 0).posted(0);

    assert.deepEqual(fetched, ['runtime-manifest.json', 'libheif.wasm']);
    assert.deepEqual(load.message.records, replaced);
    assert.equal(load.message.scriptBaseUrl, SCRIPT_BASE);

    await ui.act(async () => root.unmount());
  });
});
