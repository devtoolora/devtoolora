import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { rasterizeSvg, type SvgRenderReply, type SvgRenderRequest } from '../src/svg';

const scope = globalThis as Record<string, unknown>;
const requests: SvgRenderRequest[] = [];
let reply: SvgRenderReply = { bytes: new Uint8Array([1, 2, 3]) };

describe('rasterizeSvg', () => {
  beforeEach(() => {
    requests.length = 0;
    reply = { bytes: new Uint8Array([1, 2, 3]) };
    scope.WorkerGlobalScope = class {};

    scope.postMessage = (request: SvgRenderRequest) => {
      requests.push(request);
      request.port.postMessage(reply);
    };
  });

  afterEach(() => {
    delete scope.WorkerGlobalScope;
    delete scope.postMessage;
  });

  it('asks the page to draw and returns its bytes at the computed size', async () => {
    const result = await rasterizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text>Hi</text></svg>',
      { maxWidth: 400 },
    );

    assert.deepEqual([result.width, result.height, [...result.bytes]], [400, 200, [1, 2, 3]]);
    assert.equal(requests[0]?.type, 'renderSvg');
    assert.deepEqual([requests[0]?.width, requests[0]?.height], [400, 200]);

    assert.equal(
      requests[0]?.source,
      '<svg width="400" height="200" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"  ><text>Hi</text></svg>',
    );
  });

  it('adds the namespace pasted inline markup omits and keeps the other root attributes', async () => {
    await rasterizeSvg(
      '<?xml version="1.0"?>\n<svg stroke-width="2" viewBox="0 0 24 24" data-x=\'width="9"\'/>',
    );

    assert.equal(
      requests[0]?.source,
      '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" stroke-width="2"  data-x=\'width="9"\'/>',
    );
  });

  it('rejects a requested size above the limit but fits a huge SVG into it', async () => {
    await assert.rejects(rasterizeSvg('<svg/>', { maxWidth: 20000 }), /between 1 and 10000/);

    const result = await rasterizeSvg('<svg width="20000" height="100"/>');

    assert.deepEqual([result.width, result.height], [10000, 50]);
  });

  it('reports a render the page refused', async () => {
    reply = { error: 'not well-formed' };

    await assert.rejects(rasterizeSvg('<svg><rect></svg>'), /not well-formed/);
  });

  it('refuses outside a worker, where no page can answer', async () => {
    delete scope.WorkerGlobalScope;

    await assert.rejects(rasterizeSvg('<svg/>'), /requires a browser page/);
  });
});
