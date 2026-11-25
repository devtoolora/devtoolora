import type { SerializedToolDefinition, ToolResult } from '@devtoolora/core';
import {
  loadBrowserWorkerTool,
  loadBrowserWorkerTools,
  runBrowserWorkerToolLazily,
} from '@devtoolora/browser-catalog/lazy';
import {
  handleRuntimeRequest,
  isRuntimeRequest,
  type RuntimeReply,
  type RuntimeRequest,
} from '@devtoolora/functions/runtime';

type WebWorkerRequest =
  | RuntimeRequest
  | { id: string; toolId: string; type: 'getTool' }
  | { id: string; type: 'listTools' }
  | { fields: Record<string, string>; id: string; text: string; toolId: string; type: 'runTool' };

type WebWorkerResponse =
  | RuntimeReply
  | { id: string; ok: true; tool: SerializedToolDefinition; type: 'getTool' }
  | { id: string; ok: true; tools: SerializedToolDefinition[]; type: 'listTools' }
  | { id: string; ok: true; result: ToolResult; type: 'runTool' }
  | { error: string; id: string; ok: false };

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener('message', (event: MessageEvent<WebWorkerRequest>) => {
  void handleMessage(event.data);
});

async function handleMessage(message: WebWorkerRequest): Promise<void> {
  try {
    worker.postMessage(await runRequest(message));
  } catch (error) {
    worker.postMessage({
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WebWorkerResponse);
  }
}

async function runRequest(message: WebWorkerRequest): Promise<WebWorkerResponse> {
  if (isRuntimeRequest(message)) return handleRuntimeRequest(message);

  if (message.type === 'listTools') {
    return { id: message.id, ok: true, type: 'listTools', tools: await loadBrowserWorkerTools() };
  }

  if (message.type === 'getTool') {
    const tool = await loadBrowserWorkerTool(message.toolId);

    return { id: message.id, ok: true, type: 'getTool', tool };
  }

  const result = await runBrowserWorkerToolLazily(message.toolId, {
    text: message.text,
    fields: message.fields,
  });

  return { id: message.id, ok: true, type: 'runTool', result };
}
