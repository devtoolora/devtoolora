import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import type { FlowFieldEvent, FlowFieldViewport } from '../../src/features/hero/flowField/protocol';
import type { FlowField } from '../../src/features/hero/flowField/renderer';
import {
  createWorkerHost,
  PREWARM_SLICE,
  PREWARM_STEPS,
} from '../../src/features/hero/flowField/workerHost';

const VIEWPORT: FlowFieldViewport = { dpr: 1.5, height: 600, star: { x: 0.8, y: 0.7 }, width: 800 };

function createFrames() {
  const pending = new Map<number, (now: number) => void>();
  let nextId = 1;
  let now = 0;

  return {
    cancelFrame: vi.fn((id: number) => {
      pending.delete(id);
    }),
    pendingCount: () => pending.size,
    requestFrame: vi.fn((callback: (now: number) => void) => {
      const id = nextId;

      nextId += 1;
      pending.set(id, callback);

      return id;
    }),
    runFrame() {
      const callbacks = [...pending.values()];

      pending.clear();
      now += 16;
      callbacks.forEach((callback) => callback(now));

      return callbacks.length;
    },
  };
}

function createFakeField() {
  return {
    fence: vi.fn((): (() => boolean) => () => true),
    render: vi.fn(),
    resize: vi.fn(() => true),
    revealNow: vi.fn(),
    setPointer: vi.fn(),
    setStar: vi.fn(),
    setTheme: vi.fn(),
    step: vi.fn(),
  } satisfies FlowField;
}

function setup(field: FlowField | null = createFakeField()) {
  const frames = createFrames();
  const events: FlowFieldEvent[] = [];
  const post = vi.fn((event: FlowFieldEvent) => events.push(event));
  const canvas = Object.assign(new EventTarget(), { height: 900, width: 1200 }) as OffscreenCanvas;
  const host = createWorkerHost({
    cancelFrame: frames.cancelFrame,
    createField: () => field,
    post,
    requestFrame: frames.requestFrame,
  });
  const init = () =>
    host.handle({ canvas, isLight: false, side: 160, type: 'init', viewport: VIEWPORT });

  const runUntilReady = () => {
    for (let frame = 0; frame < 100 && !events.some(({ type }) => type === 'ready'); frame += 1) {
      frames.runFrame();
    }
  };

  return { canvas, events, frames, host, init, post, runUntilReady };
}

describe('createWorkerHost', () => {
  it('posts failed when the field cannot be created', () => {
    const { events, init } = setup(null);

    init();

    assert.deepEqual(events, [{ reason: 'webgl', type: 'failed' }]);
  });

  it('prewarms in slices before reporting ready', () => {
    const field = createFakeField();
    const { events, frames, host, init, post } = setup(field);
    const stepsPerFrame: number[] = [];

    init();
    host.handle({ running: true, type: 'running' });
    host.handle({ running: false, type: 'running' });

    while (!events.some(({ type }) => type === 'ready') && stepsPerFrame.length < 100) {
      const before = field.step.mock.calls.length;

      frames.runFrame();
      stepsPerFrame.push(field.step.mock.calls.length - before);
    }

    assert.equal(field.step.mock.calls.length, PREWARM_STEPS);
    assert.ok(stepsPerFrame.every((steps) => steps <= PREWARM_SLICE));
    assert.deepEqual(field.render.mock.calls, [[0]]);
    assert.deepEqual(events, [{ bufferHeight: 900, bufferWidth: 1200, type: 'ready' }]);

    assert.ok(
      field.revealNow.mock.invocationCallOrder[0]! < field.render.mock.invocationCallOrder[0]!,
    );

    assert.ok(field.render.mock.invocationCallOrder[0]! < post.mock.invocationCallOrder[0]!);
    assert.equal(frames.pendingCount(), 0);

    host.handle({ running: true, type: 'running' });
    frames.runFrame();
    frames.runFrame();

    assert.equal(field.step.mock.calls.length, PREWARM_STEPS + 1);
    assert.ok(field.render.mock.calls.length > 1);
  });

  it('starts the loop after ready when running arrived during prewarm', () => {
    const field = createFakeField();
    const { frames, host, init, runUntilReady } = setup(field);

    init();
    host.handle({ running: true, type: 'running' });
    runUntilReady();
    frames.runFrame();
    frames.runFrame();

    assert.ok(field.step.mock.calls.length > PREWARM_STEPS);
    assert.equal(frames.pendingCount(), 1);
  });

  it('waits for the GPU to finish a slice before queueing the next one', () => {
    const field = createFakeField();
    const { events, frames, init } = setup(field);
    let isGpuDone = false;

    field.fence.mockImplementation(() => () => isGpuDone);
    init();
    frames.runFrame();
    frames.runFrame();
    frames.runFrame();

    assert.equal(field.step.mock.calls.length, PREWARM_SLICE);

    for (let frame = 0; frame < 100 && field.render.mock.calls.length === 0; frame += 1) {
      isGpuDone = true;
      frames.runFrame();
      isGpuDone = false;
    }

    frames.runFrame();

    assert.equal(field.step.mock.calls.length, PREWARM_STEPS);
    assert.deepEqual(events, []);

    isGpuDone = true;
    frames.runFrame();

    assert.deepEqual(events, [{ bufferHeight: 900, bufferWidth: 1200, type: 'ready' }]);
  });

  it('applies theme commands that arrive during prewarm', () => {
    const field = createFakeField();
    const { frames, host, init, post, runUntilReady } = setup(field);

    init();
    frames.runFrame();
    host.handle({ isLight: true, type: 'theme' });
    runUntilReady();

    assert.deepEqual(field.setTheme.mock.calls, [[true]]);
    assert.ok(field.setTheme.mock.invocationCallOrder[0]! < post.mock.invocationCallOrder[0]!);
  });

  it('stops scheduling frames while not running', () => {
    const { frames, host, init, runUntilReady } = setup();

    init();
    host.handle({ running: true, type: 'running' });
    runUntilReady();
    frames.runFrame();
    host.handle({ running: false, type: 'running' });

    const requested = frames.requestFrame.mock.calls.length;

    assert.equal(frames.runFrame(), 0);
    assert.equal(frames.requestFrame.mock.calls.length, requested);
  });

  it('renders one frame after a resize while paused', () => {
    const field = createFakeField();
    const { events, frames, host, init, runUntilReady } = setup(field);
    const viewport: FlowFieldViewport = {
      dpr: 1,
      height: 700,
      star: { x: 0.5, y: 0.6 },
      width: 1000,
    };

    init();
    runUntilReady();
    field.render.mockClear();
    host.handle({ type: 'resize', viewport });

    assert.deepEqual(field.resize.mock.calls.at(-1), [1000, 700, 1]);
    assert.deepEqual(field.setStar.mock.calls.at(-1), [0.5, 0.6]);
    assert.deepEqual(field.render.mock.calls, [[0]]);
    assert.deepEqual(events.at(-1), { bufferHeight: 900, bufferWidth: 1200, type: 'resized' });
    assert.equal(frames.pendingCount(), 0);
  });

  it('posts failed on context loss', () => {
    const field = createFakeField();
    const { canvas, events, frames, host, init, runUntilReady } = setup(field);

    init();
    host.handle({ running: true, type: 'running' });
    runUntilReady();
    canvas.dispatchEvent(new Event('webglcontextlost'));

    const steps = field.step.mock.calls.length;

    frames.runFrame();

    assert.deepEqual(events.at(-1), { reason: 'context-lost', type: 'failed' });
    assert.equal(field.step.mock.calls.length, steps);
    assert.equal(frames.pendingCount(), 0);
  });
});
