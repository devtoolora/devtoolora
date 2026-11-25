import type {
  SerializedToolDefinition,
  ToolInput,
  ToolResult,
  ToolRuntime,
} from '@devtoolora/core';
import { runIsolatedWorkerTool } from '@devtoolora/browser-catalog/worker';
import type { SvgRenderRequest } from '@devtoolora/functions/svg';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { answerSvgRender, isSvgRenderRequest } from './svgPageRender';
import { useRuntimeWorker, type RuntimeWorker } from './useRuntimeWorker';

type WorkerResponse =
  | { id: string; ok: true; tool: SerializedToolDefinition; type: 'getTool' }
  | { id: string; ok: true; result: ToolResult; type: 'runTool' }
  | { error: string; id: string; ok: false };

export type ToolRunnerHost = {
  createIsolatedWorker?(): Worker;
  createRuntimeWorker?(runtime: ToolRuntime): Promise<Worker>;
  createWorker(): Worker;
  fetchRuntimeFile?(
    runtime: ToolRuntime,
    name: string,
    onProgress: (loaded: number) => void,
  ): Promise<ArrayBuffer>;
  runtimeScriptBaseUrl?: string;
  runtimeSource?: 'bundled' | 'download';
};

type DefinitionStatus = 'loading' | 'ready' | 'error';

type Runner = {
  createFailureRef: RefObject<Error | null>;
  definitionRequestId: RefObject<string>;
  definitionTimeoutRef: RefObject<number | undefined>;
  hasDefinitionsRef: RefObject<boolean>;
  hostRef: RefObject<ToolRunnerHost>;
  latestRunId: RefObject<string>;
  regexAbortRef: RefObject<AbortController | null>;
  setCanRetry: Dispatch<SetStateAction<boolean>>;
  setDefinitionError: Dispatch<SetStateAction<string>>;
  setDefinitionStatus: Dispatch<SetStateAction<DefinitionStatus>>;
  setError: Dispatch<SetStateAction<string>>;
  setIsRunning: Dispatch<SetStateAction<boolean>>;
  setResult: Dispatch<SetStateAction<ToolResult | undefined>>;
  setTool: Dispatch<SetStateAction<SerializedToolDefinition | undefined>>;
  setWorkerVersion: Dispatch<SetStateAction<number>>;
  toolIdRef: RefObject<string>;
  workerRef: RefObject<Worker | null>;
};

const cachedTools = new Map<string, SerializedToolDefinition>();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function releaseWorker(runner: Runner, worker: Worker): void {
  worker.terminate();
  if (runner.workerRef.current === worker) runner.workerRef.current = null;
}

function failDefinitions(runner: Runner, message: string): void {
  runner.setDefinitionStatus('error');
  runner.setDefinitionError(message);
}

function failRun(runner: Runner, message: string): void {
  runner.setIsRunning(false);
  runner.setError(message);
  runner.setCanRetry(true);
}

function handleDefinitionResponse(runner: Runner, worker: Worker, response: WorkerResponse): void {
  window.clearTimeout(runner.definitionTimeoutRef.current);

  if (response.ok && response.type === 'getTool') {
    runner.hasDefinitionsRef.current = true;
    cachedTools.set(runner.toolIdRef.current, response.tool);
    runner.setTool(response.tool);
    runner.setDefinitionStatus('ready');
  } else {
    cachedTools.delete(runner.toolIdRef.current);

    failDefinitions(
      runner,
      'error' in response
        ? response.error
        : 'The local worker returned an invalid tool definition.',
    );

    releaseWorker(runner, worker);
  }
}

function handleWorkerResponse(runner: Runner, worker: Worker, response: WorkerResponse): void {
  if (!response || typeof response !== 'object' || typeof response.id !== 'string') {
    window.clearTimeout(runner.definitionTimeoutRef.current);

    if (runner.hasDefinitionsRef.current)
      failRun(runner, 'The browser received an invalid response from the local worker.');
    else failDefinitions(runner, 'The browser could not read the local tool definitions.');

    releaseWorker(runner, worker);

    return;
  }

  if (response.id === runner.definitionRequestId.current) {
    handleDefinitionResponse(runner, worker, response);

    return;
  }

  if (response.id !== runner.latestRunId.current) return;

  runner.setIsRunning(false);

  if ('error' in response) {
    runner.setError(response.error);
    runner.setResult(undefined);

    return;
  }

  if (response.type === 'runTool') runner.setResult(response.result);
}

function connectWorker(runner: Runner): (() => void) | undefined {
  let worker: Worker;

  try {
    worker = runner.hostRef.current.createWorker();
  } catch (workerError) {
    runner.createFailureRef.current =
      workerError instanceof Error ? workerError : new Error(String(workerError));

    failDefinitions(runner, runner.createFailureRef.current.message);

    return;
  }

  runner.createFailureRef.current = null;
  runner.workerRef.current = worker;

  const handleMessage = (event: MessageEvent<WorkerResponse | SvgRenderRequest>) => {
    if (isSvgRenderRequest(event.data)) void answerSvgRender(event.data);
    else handleWorkerResponse(runner, worker, event.data);
  };

  const handleWorkerError = (event: ErrorEvent) => {
    window.clearTimeout(runner.definitionTimeoutRef.current);
    cachedTools.delete(runner.toolIdRef.current);
    const message = event.message || 'The local tool worker stopped unexpectedly.';

    releaseWorker(runner, worker);

    if (!runner.hasDefinitionsRef.current) failDefinitions(runner, message);
    else failRun(runner, message);
  };

  const handleMessageError = () => {
    window.clearTimeout(runner.definitionTimeoutRef.current);
    cachedTools.delete(runner.toolIdRef.current);
    releaseWorker(runner, worker);

    if (runner.hasDefinitionsRef.current)
      failRun(runner, 'The browser could not read the local tool result.');
    else failDefinitions(runner, 'The browser could not read the local tool definitions.');
  };

  worker.addEventListener('message', handleMessage);
  worker.addEventListener('error', handleWorkerError);
  worker.addEventListener('messageerror', handleMessageError);

  return () => {
    runner.regexAbortRef.current?.abort();
    releaseWorker(runner, worker);
  };
}

function requestDefinition(runner: Runner, toolId: string): (() => void) | undefined {
  runner.toolIdRef.current = toolId;
  const cachedTool = cachedTools.get(toolId);

  runner.setTool(cachedTool);
  runner.setDefinitionStatus(cachedTool ? 'ready' : 'loading');
  runner.setDefinitionError('');
  runner.setError('');
  runner.latestRunId.current = '';
  runner.setIsRunning(false);
  runner.setCanRetry(false);
  runner.hasDefinitionsRef.current = Boolean(cachedTool);
  const worker = runner.workerRef.current;

  if (!worker) {
    // A failed createWorker waits for Retry; respawning here would loop both effects.
    if (runner.createFailureRef.current)
      failDefinitions(runner, runner.createFailureRef.current.message);
    else runner.setWorkerVersion((current) => current + 1);

    return;
  }

  runner.definitionTimeoutRef.current = window.setTimeout(() => {
    failDefinitions(runner, 'The local tool worker did not start in time.');
    releaseWorker(runner, worker);
  }, 10_000);

  const id = crypto.randomUUID();

  runner.definitionRequestId.current = id;

  try {
    worker.postMessage({ id, toolId, type: 'getTool' });
  } catch (postError) {
    window.clearTimeout(runner.definitionTimeoutRef.current);
    cachedTools.delete(toolId);
    failDefinitions(runner, errorMessage(postError));
    worker.terminate();
    runner.workerRef.current = null;
  }

  return () => window.clearTimeout(runner.definitionTimeoutRef.current);
}

function settleRun(runner: Runner, id: string, output: Promise<ToolResult>): void {
  void output
    .then((result) => {
      if (runner.latestRunId.current !== id) return;

      runner.setResult(result);
      runner.setIsRunning(false);
    })
    .catch((runError: unknown) => {
      if (runner.latestRunId.current !== id) return;

      runner.setError(errorMessage(runError));
      runner.setResult(undefined);
      runner.setIsRunning(false);
    });
}

function runIsolated(runner: Runner, id: string, toolId: string, input: ToolInput): void {
  const controller = new AbortController();

  runner.regexAbortRef.current = controller;

  try {
    const host = runner.hostRef.current;
    const worker = host.createIsolatedWorker?.() ?? host.createWorker();

    settleRun(runner, id, runIsolatedWorkerTool(worker, toolId, input, controller.signal));
  } catch (runError) {
    runner.setError(errorMessage(runError));
    runner.setResult(undefined);
    runner.setIsRunning(false);
  }
}

function startRun(
  runner: Runner,
  toolId: string,
  input: ToolInput,
  runRuntime: RuntimeWorker['run'],
): void {
  runner.regexAbortRef.current?.abort();
  const id = crypto.randomUUID();
  const tool = cachedTools.get(toolId);

  runner.latestRunId.current = id;
  runner.setError('');
  runner.setCanRetry(false);
  runner.setIsRunning(true);

  if (tool?.runtime) {
    settleRun(runner, id, runRuntime(toolId, input));

    return;
  }

  if (tool?.isolatedWorker) {
    runIsolated(runner, id, toolId, input);

    return;
  }

  try {
    if (!runner.workerRef.current) throw new Error('The local tool worker is unavailable.');

    runner.workerRef.current.postMessage({ id, type: 'runTool', toolId, ...input });
  } catch (postError) {
    runner.setIsRunning(false);
    runner.setResult(undefined);
    runner.setError(errorMessage(postError));
    runner.setCanRetry(true);
  }
}

function useRunnerState(host: ToolRunnerHost, toolId: string) {
  // Read through a ref so a new host object never restarts the worker effect.
  const hostRef = useRef(host);

  hostRef.current = host;
  const workerRef = useRef<Worker | null>(null);
  const regexAbortRef = useRef<AbortController | null>(null);
  const latestRunId = useRef('');
  const definitionRequestId = useRef('');
  const toolIdRef = useRef(toolId);
  const hasDefinitionsRef = useRef(false);
  const definitionTimeoutRef = useRef<number | undefined>(undefined);
  const createFailureRef = useRef<Error | null>(null);
  const [tool, setTool] = useState<SerializedToolDefinition | undefined>(() =>
    cachedTools.get(toolId),
  );
  const [result, setResult] = useState<ToolResult>();
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [definitionStatus, setDefinitionStatus] = useState<DefinitionStatus>(() =>
    cachedTools.has(toolId) ? 'ready' : 'loading',
  );
  const [definitionError, setDefinitionError] = useState('');
  const [workerVersion, setWorkerVersion] = useState(0);
  // Refs and state setters only, so the object stays stable for effect and callback deps.
  const runner: Runner = useMemo(
    () => ({
      createFailureRef,
      definitionRequestId,
      definitionTimeoutRef,
      hasDefinitionsRef,
      hostRef,
      latestRunId,
      regexAbortRef,
      setCanRetry,
      setDefinitionError,
      setDefinitionStatus,
      setError,
      setIsRunning,
      setResult,
      setTool,
      setWorkerVersion,
      toolIdRef,
      workerRef,
    }),
    [],
  );

  return {
    canRetry,
    definitionError,
    definitionStatus,
    error,
    isRunning,
    result,
    runner,
    tool,
    workerVersion,
  };
}

export function useToolRunner(host: ToolRunnerHost, toolId: string) {
  const state = useRunnerState(host, toolId);
  const { runner, tool, workerVersion } = state;

  // State lags one render behind a toolId change; never hand the previous tool to the new page.
  const isStale = tool !== undefined && tool.id !== toolId;
  const currentTool = isStale ? cachedTools.get(toolId) : tool;
  const staleStatus = currentTool ? 'ready' : 'loading';
  const runtime = useRuntimeWorker(runner.hostRef, currentTool?.runtime, workerVersion);
  const runtimeError = runtime.status === 'error' ? runtime.message : '';
  const { run: runRuntime } = runtime;

  useEffect(() => connectWorker(runner), [runner, workerVersion]);
  useEffect(() => requestDefinition(runner, toolId), [runner, toolId, workerVersion]);

  const runTool = useCallback(
    (toolId: string, input: ToolInput) => startRun(runner, toolId, input, runRuntime),
    [runRuntime, runner],
  );

  // Drop any in-flight run without touching the visible result; a later response for a superseded
  // input must never land.
  const discardPending = useCallback(() => {
    runner.latestRunId.current = '';
    runner.regexAbortRef.current?.abort();
    runner.setIsRunning(false);
  }, [runner]);

  const clearResult = useCallback(() => {
    runner.latestRunId.current = '';
    runner.regexAbortRef.current?.abort();
    runner.setResult(undefined);
    runner.setError('');
    runner.setIsRunning(false);
    runner.setCanRetry(false);
  }, [runner]);

  const retryWorker = useCallback(() => {
    cachedTools.delete(toolId);
    runner.latestRunId.current = '';
    runner.setResult(undefined);
    runner.setCanRetry(false);
    runner.setWorkerVersion((current) => current + 1);
  }, [runner, toolId]);

  return {
    tool: currentTool,
    definitionStatus: isStale ? staleStatus : state.definitionStatus,
    result: state.result,
    error: runtimeError || state.error,
    isRunning: state.isRunning,
    canRetry: state.canRetry || Boolean(runtimeError),
    definitionError: state.definitionError,
    runTool,
    clearResult,
    discardPending,
    retryWorker,
    runtime,
  };
}
