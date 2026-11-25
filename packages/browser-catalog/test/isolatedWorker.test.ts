import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runIsolatedWorkerTool } from '../src/isolatedWorker';

class FakeWorker extends EventTarget {
  stopped = false;
  onPost?: (request: { id: string }) => void;
  postMessage(request: { id: string }): void {
    this.onPost?.(request);
  }
  terminate(): void {
    this.stopped = true;
  }
}

describe('isolated regex worker deadline', () => {
  it('terminates after success, rejects timeout and supports a fresh subsequent run', async () => {
    const stuck = new FakeWorker();

    await assert.rejects(
      runIsolatedWorkerTool(stuck as unknown as Worker, 'regex-test', { fields: {}, text: '' }),
      /2-second/,
    );

    assert.equal(stuck.stopped, true);
    const worker = new FakeWorker();

    worker.onPost = ({ id }) =>
      worker.dispatchEvent(
        new MessageEvent('message', {
          data: { id, ok: true, result: { text: 'recovered' }, type: 'runTool' },
        }),
      );

    assert.equal(
      (
        await runIsolatedWorkerTool(worker as unknown as Worker, 'regex-test', {
          fields: {},
          text: '',
        })
      ).text,
      'recovered',
    );

    assert.equal(worker.stopped, true);
  });

  it('terminates on cancellation and reported error', async () => {
    const controller = new AbortController();
    const worker = new FakeWorker();
    const running = runIsolatedWorkerTool(
      worker as unknown as Worker,
      'regex-test',
      { fields: {}, text: '' },
      controller.signal,
    );

    controller.abort();
    await assert.rejects(running, /cancelled/);
    assert.equal(worker.stopped, true);
    const failed = new FakeWorker();

    failed.onPost = ({ id }) =>
      failed.dispatchEvent(
        new MessageEvent('message', { data: { error: 'invalid pattern', id, ok: false } }),
      );

    await assert.rejects(
      runIsolatedWorkerTool(failed as unknown as Worker, 'regex-test', { fields: {}, text: '' }),
      /invalid pattern/,
    );

    assert.equal(failed.stopped, true);
  });

  it('uses the same deadline and fresh-worker result protocol for Find & Replace', async () => {
    const stuck = new FakeWorker();

    await assert.rejects(
      runIsolatedWorkerTool(stuck as unknown as Worker, 'find-replace', {
        fields: { regex: 'true' },
        text: 'x',
      }),
      /2-second/,
    );

    assert.equal(stuck.stopped, true);
    const worker = new FakeWorker();

    worker.onPost = ({ id }) =>
      worker.dispatchEvent(
        new MessageEvent('message', {
          data: { id, ok: true, result: { text: 'literal $&' }, type: 'runTool' },
        }),
      );

    assert.equal(
      (
        await runIsolatedWorkerTool(worker as unknown as Worker, 'find-replace', {
          fields: {},
          text: 'x',
        })
      ).text,
      'literal $&',
    );

    assert.equal(worker.stopped, true);
  });
});
