import type { ToolInput, ToolResult } from '@devtoolora/core';

const REGEX_TIMEOUT_MESSAGE =
  'Regex exceeded the 2-second execution limit. The isolated worker was stopped. Simplify the pattern or reduce the input, then run again.';

interface WorkerReply {
  error?: string;
  id: string;
  ok: boolean;
  result?: ToolResult;
  type?: string;
}

export function runIsolatedWorkerTool(
  worker: Worker,
  toolId: string,
  input: ToolInput,
  signal?: AbortSignal,
): Promise<ToolResult> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    let settled = false;
    const timer = setTimeout(() => finish(new Error(REGEX_TIMEOUT_MESSAGE)), 2_000);

    function finish(error?: Error, result?: ToolResult): void {
      if (settled) return;

      settled = true;
      clearTimeout(timer);
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      worker.removeEventListener('messageerror', handleMessageError);
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error('The isolated worker returned no result.'));
    }

    function handleMessage(event: MessageEvent<WorkerReply>): void {
      if (!event.data || event.data.id !== id) return;
      if (event.data.ok && event.data.type === 'runTool' && event.data.result)
        finish(undefined, event.data.result);
      else finish(new Error(event.data.error || 'Regex worker failed.'));
    }

    function handleError(event: ErrorEvent): void {
      finish(new Error(event.message || 'Regex worker failed.'));
    }

    function handleMessageError(): void {
      finish(new Error('Regex worker returned an unreadable result.'));
    }

    function handleAbort(): void {
      finish(new Error('Regex execution cancelled.'));
    }

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.addEventListener('messageerror', handleMessageError);
    signal?.addEventListener('abort', handleAbort);

    if (signal?.aborted) {
      handleAbort();

      return;
    }

    try {
      worker.postMessage({ ...input, id, toolId, type: 'runTool' });
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
