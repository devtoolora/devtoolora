import type { FlowFieldCommand, FlowFieldEvent, FlowFieldViewport } from './protocol';
import type { FlowField } from './renderer';

export const PREWARM_STEPS = 260;
export const PREWARM_SLICE = 16;

const MAX_DT = 1 / 30;

export type WorkerHostDeps = {
  cancelFrame(id: number): void;
  createField(canvas: OffscreenCanvas, side: number, isLight: boolean): FlowField | null;
  post(event: FlowFieldEvent): void;
  requestFrame(callback: (now: number) => void): number;
};

type Host = {
  canvas: OffscreenCanvas | null;
  deps: WorkerHostDeps;
  field: FlowField | null;
  frame: number | null;
  isGpuDone: () => boolean;
  isReady: boolean;
  isRevealed: boolean;
  isRunning: boolean;
  last: number | null;
  listeners: AbortController;
  prewarmed: number;
};

function schedule(host: Host, callback: (now: number) => void): void {
  host.frame = host.deps.requestFrame((now) => {
    host.frame = null;
    callback(now);
  });
}

function cancel(host: Host): void {
  if (host.frame !== null) {
    host.deps.cancelFrame(host.frame);
    host.frame = null;
  }
}

function postSize(host: Host, type: 'ready' | 'resized'): void {
  host.deps.post({
    bufferHeight: host.canvas?.height ?? 0,
    bufferWidth: host.canvas?.width ?? 0,
    type,
  });
}

function tick(host: Host, now: number): void {
  const { field } = host;

  if (!field) {
    return;
  }

  schedule(host, (next) => tick(host, next));
  const dt = host.last === null ? 0 : Math.min(Math.max((now - host.last) / 1000, 0), MAX_DT);

  host.last = now;

  if (dt > 0) {
    field.step(dt);
    field.render(dt);
  }
}

function syncLoop(host: Host): void {
  if (!host.isReady || !host.field) {
    return;
  }

  if (host.isRunning && host.frame === null) {
    host.last = null;
    schedule(host, (now) => tick(host, now));
  } else if (!host.isRunning) {
    cancel(host);
  }
}

function runPrewarmStage(host: Host, field: FlowField): void {
  if (host.prewarmed < PREWARM_STEPS) {
    const steps = Math.min(PREWARM_SLICE, PREWARM_STEPS - host.prewarmed);

    for (let i = 0; i < steps; i += 1) {
      field.step(1 / 60);
    }

    host.prewarmed += steps;
  } else {
    // the first visible frame is a fully developed field, never the reveal fade-in
    field.revealNow();
    field.render(0);
    host.isRevealed = true;
  }

  host.isGpuDone = field.fence();
}

// Nothing is presented during prewarm, so rAF gives no backpressure: waiting on a fence keeps the
// GPU queue at one slice and makes `ready` mean the revealed frame is actually drawn.
function prewarmFrame(host: Host): void {
  const { field } = host;

  if (!field) {
    return;
  }

  if (host.isGpuDone() && host.isRevealed) {
    host.isReady = true;
    postSize(host, 'ready');
    syncLoop(host);

    return;
  }

  if (host.isGpuDone()) {
    runPrewarmStage(host, field);
  }

  schedule(host, () => prewarmFrame(host));
}

function applyViewport(field: FlowField, { dpr, height, star, width }: FlowFieldViewport): boolean {
  field.setStar(star.x, star.y);

  return field.resize(width, height, dpr);
}

function fail(host: Host, reason: 'context-lost' | 'webgl'): void {
  cancel(host);
  host.field = null;
  host.deps.post({ reason, type: 'failed' });
}

function init(host: Host, command: Extract<FlowFieldCommand, { type: 'init' }>): void {
  const field = host.deps.createField(command.canvas, command.side, command.isLight);

  if (!field) {
    fail(host, 'webgl');

    return;
  }

  host.canvas = command.canvas;
  host.field = field;
  applyViewport(field, command.viewport);

  command.canvas.addEventListener('webglcontextlost', () => fail(host, 'context-lost'), {
    signal: host.listeners.signal,
  });

  schedule(host, () => prewarmFrame(host));
}

function resize(host: Host, viewport: FlowFieldViewport): void {
  if (!host.field || !applyViewport(host.field, viewport) || !host.isReady) {
    return;
  }

  if (!host.isRunning) {
    host.field.render(0);
  }

  postSize(host, 'resized');
}

export function createWorkerHost(deps: WorkerHostDeps): {
  handle(command: FlowFieldCommand): void;
} {
  const host: Host = {
    canvas: null,
    deps,
    field: null,
    frame: null,
    isGpuDone: () => true,
    isReady: false,
    isRevealed: false,
    isRunning: false,
    last: null,
    listeners: new AbortController(),
    prewarmed: 0,
  };

  const handle = (command: FlowFieldCommand): void => {
    switch (command.type) {
      case 'init':
        return init(host, command);
      case 'resize':
        return resize(host, command.viewport);
      case 'pointer':
        return host.field?.setPointer(command.x, command.y, command.active);
      case 'theme':
        return host.field?.setTheme(command.isLight);
      case 'running':
        host.isRunning = command.running;

        return syncLoop(host);
    }
  };

  return { handle };
}
