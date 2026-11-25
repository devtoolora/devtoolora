import {
  getBrowserWorkerTool,
  listBrowserWorkerTools,
  runBrowserWorkerTool,
} from '@devtoolora/browser-catalog';
import {
  handleRuntimeRequest,
  isRuntimeRequest,
  type RuntimeReply,
  type RuntimeRequest,
} from '@devtoolora/functions/runtime';

type WorkerRequest =
  | RuntimeRequest
  | { id: string; toolId: string; type: 'getTool' }
  | { id: string; type: 'listTools' }
  | { fields: Record<string, string>; id: string; text: string; toolId: string; type: 'runTool' };

type WorkerResponse =
  | RuntimeReply
  | { id: string; ok: true; tool: ReturnType<typeof getBrowserWorkerTool>; type: 'getTool' }
  | { id: string; ok: true; tools: ReturnType<typeof listBrowserWorkerTools>; type: 'listTools' }
  | {
      id: string;
      ok: true;
      result: Awaited<ReturnType<typeof runBrowserWorkerTool>>;
      type: 'runTool';
    }
  | { error: string; id: string; ok: false };

const worker = self as unknown as Worker;

worker.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  void handleMessage(event.data);
});

async function handleMessage(message: WorkerRequest): Promise<void> {
  try {
    if (isRuntimeRequest(message)) {
      worker.postMessage(await handleRuntimeRequest(message));

      return;
    }

    if (message.type === 'listTools') {
      worker.postMessage({
        id: message.id,
        ok: true,
        type: 'listTools',
        tools: listBrowserWorkerTools(),
      } satisfies WorkerResponse);

      return;
    }

    if (message.type === 'getTool') {
      worker.postMessage({
        id: message.id,
        ok: true,
        type: 'getTool',
        tool: getBrowserWorkerTool(message.toolId),
      } satisfies WorkerResponse);

      return;
    }

    const result = await runBrowserWorkerTool(message.toolId, {
      text: message.text,
      fields: message.fields,
    });

    worker.postMessage({
      id: message.id,
      ok: true,
      type: 'runTool',
      result,
    } satisfies WorkerResponse);
  } catch (error) {
    worker.postMessage({
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
}
