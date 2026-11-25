import type { ToolInput, ToolResult, ToolRuntime } from '@devtoolora/core';
import {
  supportsWasmSimd,
  WASM_SIMD_MESSAGE,
  type RuntimeFileRecord,
  type RuntimeReply,
  type RuntimeRequest,
} from '@devtoolora/functions/runtime';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ToolRunnerHost } from './useToolRunner';

type RuntimeWorkerStatus = 'error' | 'loading' | 'ready' | 'unavailable';

export type RuntimeProgress = { loaded: number; total: number };

export type RuntimeWorkerState = {
  message: string;
  progress?: RuntimeProgress;
  status: RuntimeWorkerStatus;
};

export type RuntimeWorker = RuntimeWorkerState & {
  run(toolId: string, input: ToolInput): Promise<ToolResult>;
};

type RuntimeHost = Pick<ToolRunnerHost, 'runtimeScriptBaseUrl'> &
  Required<Pick<ToolRunnerHost, 'createRuntimeWorker' | 'fetchRuntimeFile'>>;

type RunRequest = ToolInput & { id: string; toolId: string; type: 'runTool' };

type WorkerReply =
  | RuntimeReply
  | { id: string; ok: true; result: ToolResult; type: 'runTool' }
  | { error: string; id: string; ok: false };

type SuccessReply = Extract<WorkerReply, { ok: true }>;

type LoadedWorker = {
  files: Set<string>;
  records: RuntimeFileRecord[];
  worker: Worker;
};

type WorkerSlot = {
  controller: AbortController;
  isRunning: boolean;
  loaded: Promise<LoadedWorker>;
};

const DEFAULT_LANGUAGE = 'eng';
const MANIFEST_NAME = 'runtime-manifest.json';
const RUN_LIMIT_MS = 120_000;
const UNAVAILABLE_MESSAGE = 'This tool is not available here.';
const WASM_TRAP = /RuntimeError|Aborted|out of bounds|memory/;
const READY: RuntimeWorkerState = { message: '', status: 'ready' };

// Page-lifetime caches keyed `runtime/name`; a failed fetch is dropped so Retry fetches it again.
const manifestCache = new Map<string, Promise<RuntimeFileRecord[]>>();
const fileCache = new Map<string, Promise<ArrayBuffer>>();
const buffers = new Map<string, ArrayBuffer>();

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

function cached<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  let pending = cache.get(key);

  if (!pending) {
    pending = load();
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }

  return pending;
}

function isRuntimeHost(host: ToolRunnerHost): host is ToolRunnerHost & RuntimeHost {
  return Boolean(host.createRuntimeWorker && host.fetchRuntimeFile);
}

function unavailableMessage(host: ToolRunnerHost, runtime: ToolRuntime): string {
  if (!isRuntimeHost(host)) return UNAVAILABLE_MESSAGE;

  return runtime === 'ocr' && !supportsWasmSimd() ? WASM_SIMD_MESSAGE : '';
}

function parseRecords(buffer: ArrayBuffer, runtime: ToolRuntime): RuntimeFileRecord[] {
  try {
    const manifest: unknown = JSON.parse(new TextDecoder().decode(buffer));
    const records = (manifest as Partial<Record<ToolRuntime, unknown>> | null)?.[runtime];

    if (Array.isArray(records)) return records as RuntimeFileRecord[];
  } catch {
    // Reported below with the file name.
  }

  throw new Error(`Could not load ${MANIFEST_NAME} (invalid).`);
}

function fetchRecords(host: RuntimeHost, runtime: ToolRuntime): Promise<RuntimeFileRecord[]> {
  return cached(manifestCache, runtime, async () =>
    parseRecords(await host.fetchRuntimeFile(runtime, MANIFEST_NAME, () => {}), runtime),
  );
}

function fetchFile(
  host: RuntimeHost,
  runtime: ToolRuntime,
  name: string,
  onProgress: (loaded: number) => void,
): Promise<ArrayBuffer> {
  const key = `${runtime}/${name}`;

  return cached(fileCache, key, async () => {
    const buffer = await host.fetchRuntimeFile(runtime, name, onProgress);

    buffers.set(key, buffer);

    return buffer;
  });
}

/** Copies, so transferring them to a worker never detaches the page's buffers. */
function bufferCopies(runtime: ToolRuntime, names: string[]): Record<string, ArrayBuffer> {
  const files: Record<string, ArrayBuffer> = {};

  for (const name of names) {
    const buffer = buffers.get(`${runtime}/${name}`);

    if (buffer) files[name] = buffer.slice(0);
  }

  return files;
}

function request(
  worker: Worker,
  message: RunRequest | RuntimeRequest,
  signal: AbortSignal,
): Promise<SuccessReply> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', handleMessage);
      signal.removeEventListener('abort', handleAbort);
    };

    const handleMessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data?.id !== message.id) return;

      cleanup();

      if (event.data.ok) resolve(event.data);
      else reject(new Error(event.data.error));
    };

    const handleAbort = () => {
      cleanup();
      reject(toError(signal.reason));
    };

    if (signal.aborted) return handleAbort();

    worker.addEventListener('message', handleMessage);
    signal.addEventListener('abort', handleAbort);

    try {
      worker.postMessage(message, 'files' in message ? Object.values(message.files) : []);
    } catch (postError) {
      cleanup();
      reject(toError(postError));
    }
  });
}

class RuntimeSession {
  private isDisposed = false;
  private slot: WorkerSlot | null = null;
  private status: RuntimeWorkerStatus = 'ready';

  constructor(
    private readonly host: RuntimeHost,
    private readonly runtime: ToolRuntime,
    private readonly onStateChange: (state: RuntimeWorkerState) => void,
  ) {}

  open(): void {
    this.ensureSlot();
  }

  dispose(): void {
    if (this.slot) this.stop(this.slot, new Error('The tool page was closed.'));

    this.isDisposed = true;
  }

  run(toolId: string, input: ToolInput): Promise<ToolResult> {
    if (this.slot?.isRunning) this.stop(this.slot, new Error('The run was replaced.'));

    const slot = this.ensureSlot();

    slot.isRunning = true;

    return this.runOn(slot, toolId, input).finally(() => {
      slot.isRunning = false;
    });
  }

  private report(state: RuntimeWorkerState, signal: AbortSignal): void {
    if (this.isDisposed || signal.aborted) return;

    this.status = state.status;
    this.onStateChange(state);
  }

  private stop(slot: WorkerSlot, reason: Error): void {
    if (this.slot === slot) this.slot = null;
    if (!slot.controller.signal.aborted) slot.controller.abort(reason);
  }

  private fail(slot: WorkerSlot, error: unknown): void {
    const { signal } = slot.controller;

    if (signal.aborted) return;

    this.report({ message: toError(error).message, status: 'error' }, signal);
    this.stop(slot, toError(error));
  }

  private ensureSlot(): WorkerSlot {
    if (this.slot) return this.slot;

    const controller = new AbortController();
    const slot: WorkerSlot = {
      controller,
      isRunning: false,
      loaded: this.startWorker(controller.signal, (error) => this.fail(slot, error)),
    };

    slot.loaded.catch((error: unknown) => this.fail(slot, error));
    this.slot = slot;

    return slot;
  }

  private async startWorker(
    signal: AbortSignal,
    onCrash: (error: Error) => void,
  ): Promise<LoadedWorker> {
    this.report({ message: '', status: 'loading' }, signal);
    const records = await fetchRecords(this.host, this.runtime);
    const initial = records.filter(
      (record) =>
        record.kind === 'data' && (!record.language || record.language === DEFAULT_LANGUAGE),
    );

    await this.fetchWithProgress(initial, signal);
    signal.throwIfAborted();

    const worker = await this.host.createRuntimeWorker(this.runtime);

    if (signal.aborted) worker.terminate();

    signal.throwIfAborted();
    signal.addEventListener('abort', () => worker.terminate());

    worker.addEventListener('error', (event) =>
      onCrash(new Error(event.message || 'The runtime worker stopped unexpectedly.')),
    );

    const files = bufferCopies(
      this.runtime,
      records.map((record) => record.name),
    );

    await request(worker, this.runtimeRequest('loadRuntime', files, records), signal);
    this.report(READY, signal);

    return { files: new Set(Object.keys(files)), records, worker };
  }

  private async fetchWithProgress(
    records: RuntimeFileRecord[],
    signal: AbortSignal,
  ): Promise<void> {
    const total = records.reduce((sum, record) => sum + record.bytes, 0);
    const loadedByName = new Map<string, number>();

    const update = (name: string, loaded: number) => {
      loadedByName.set(name, loaded);
      const loadedTotal = [...loadedByName.values()].reduce((sum, bytes) => sum + bytes, 0);

      this.report(
        { message: '', progress: { loaded: loadedTotal, total }, status: 'loading' },
        signal,
      );
    };

    await Promise.all(
      records.map(async (record) => {
        await fetchFile(this.host, this.runtime, record.name, (loaded) =>
          update(record.name, loaded),
        );

        update(record.name, record.bytes);
      }),
    );
  }

  private async runOn(slot: WorkerSlot, toolId: string, input: ToolInput): Promise<ToolResult> {
    const loaded = await slot.loaded;
    const { signal } = slot.controller;

    await this.addLanguages(loaded, input, signal);

    if (this.status === 'error') this.report(READY, signal);

    const timeout = window.setTimeout(
      () => this.stop(slot, new Error('The run exceeded the 120-second limit and was stopped.')),
      RUN_LIMIT_MS,
    );

    try {
      const message: RunRequest = { id: crypto.randomUUID(), toolId, type: 'runTool', ...input };
      const reply = await request(loaded.worker, message, signal);

      if (reply.type !== 'runTool') throw new Error('The runtime worker returned no result.');

      return reply.result;
    } catch (error) {
      // A wasm trap can leave the module's memory corrupt, so the next run gets a fresh worker.
      if (WASM_TRAP.test(toError(error).message)) this.stop(slot, toError(error));

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private async addLanguages(
    loaded: LoadedWorker,
    input: ToolInput,
    signal: AbortSignal,
  ): Promise<void> {
    const languages = (input.fields.language ?? DEFAULT_LANGUAGE).split('+');
    const missing = loaded.records.filter(
      (record) =>
        record.kind === 'data' &&
        record.language !== undefined &&
        languages.includes(record.language) &&
        !loaded.files.has(record.name),
    );

    if (missing.length === 0) return;

    try {
      await Promise.all(
        missing.map((record) => fetchFile(this.host, this.runtime, record.name, () => {})),
      );
    } catch (fetchError) {
      this.report({ message: toError(fetchError).message, status: 'error' }, signal);

      throw fetchError;
    }

    const names = missing.map((record) => record.name);
    const files = bufferCopies(this.runtime, names);

    await request(
      loaded.worker,
      this.runtimeRequest('addRuntimeFiles', files, loaded.records),
      signal,
    );

    for (const name of names) loaded.files.add(name);
  }

  private runtimeRequest(
    type: RuntimeRequest['type'],
    files: Record<string, ArrayBuffer>,
    records: RuntimeFileRecord[],
  ): RuntimeRequest {
    return {
      files,
      id: crypto.randomUUID(),
      records,
      runtime: this.runtime,
      scriptBaseUrl: this.host.runtimeScriptBaseUrl,
      type,
    };
  }
}

export function useRuntimeWorker(
  hostRef: RefObject<ToolRunnerHost>,
  runtime: ToolRuntime | undefined,
  version: number,
): RuntimeWorker {
  const [state, setState] = useState<RuntimeWorkerState>(READY);
  const sessionRef = useRef<RuntimeSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!runtime || !isRuntimeHost(host) || unavailableMessage(host, runtime)) return;

    const session = new RuntimeSession(host, runtime, setState);

    sessionRef.current = session;
    session.open();

    return () => {
      session.dispose();
      sessionRef.current = null;
      setState(READY);
    };
  }, [hostRef, runtime, version]);

  const run = useCallback(
    (toolId: string, input: ToolInput) =>
      sessionRef.current?.run(toolId, input) ?? Promise.reject(new Error(UNAVAILABLE_MESSAGE)),
    [],
  );

  if (!runtime) return { ...READY, run };

  const unavailable = unavailableMessage(hostRef.current, runtime);

  if (unavailable) return { message: unavailable, run, status: 'unavailable' };

  return { ...state, run };
}
