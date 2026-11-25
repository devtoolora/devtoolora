import { addRuntimeFiles, type RuntimeFileRecord, type RuntimeName } from './files';
import { setRuntimeScriptBase } from './script';

export type RuntimeRequest = {
  files: Record<string, ArrayBuffer>;
  id: string;
  records: RuntimeFileRecord[];
  runtime: RuntimeName;
  scriptBaseUrl?: string;
  type: 'addRuntimeFiles' | 'loadRuntime';
};

export type RuntimeReply = {
  id: string;
  ok: true;
  type: 'runtimeFilesAdded' | 'runtimeReady';
};

export function isRuntimeRequest(message: { type: string }): message is RuntimeRequest {
  return message.type === 'addRuntimeFiles' || message.type === 'loadRuntime';
}

// Dynamic imports keep the wasm engines out of the worker entry chunk.
async function prepareRuntime(runtime: RuntimeName): Promise<void> {
  if (runtime === 'ocr') await (await import('../image/ocr')).prepareOcr();
  else await (await import('../image/heic')).prepareHeic();
}

export async function handleRuntimeRequest(
  message: RuntimeRequest,
  prepare: (runtime: RuntimeName) => Promise<void> = prepareRuntime,
): Promise<RuntimeReply> {
  if (message.scriptBaseUrl) setRuntimeScriptBase(message.scriptBaseUrl);

  await addRuntimeFiles(message.runtime, message.files, message.records);

  if (message.type === 'addRuntimeFiles') {
    return { id: message.id, ok: true, type: 'runtimeFilesAdded' };
  }

  await prepare(message.runtime);

  return { id: message.id, ok: true, type: 'runtimeReady' };
}
