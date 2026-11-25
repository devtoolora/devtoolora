import type { FlowFieldCommand, FlowFieldEvent } from './protocol';
import { createFlowField } from './renderer';
import { createWorkerHost } from './workerHost';

const worker = self as DedicatedWorkerGlobalScope;
const hasAnimationFrame = typeof worker.requestAnimationFrame === 'function';

const host = createWorkerHost({
  cancelFrame: (id) =>
    hasAnimationFrame ? worker.cancelAnimationFrame(id) : worker.clearTimeout(id),
  createField: createFlowField,
  post: (event: FlowFieldEvent) => worker.postMessage(event),
  requestFrame: (callback) =>
    hasAnimationFrame
      ? worker.requestAnimationFrame(callback)
      : worker.setTimeout(() => callback(performance.now()), 16),
});

worker.addEventListener('message', (event: MessageEvent<FlowFieldCommand>) => {
  host.handle(event.data);
});
