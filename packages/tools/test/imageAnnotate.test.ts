import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { browserImageCodeTools } from '../src/catalog/imagesCodes';
import {
  dataUri,
  decodeArtifact,
  encodePng,
  installFakeImageApis,
  solidImage,
  type Call,
} from './fakeImageApis';

const png = dataUri(encodePng(solidImage(40, 20, [255, 0, 0, 255])), 'image/png');
let calls: Call[] = [];
let restore = () => {};

async function annotate(annotations: string, fields: Record<string, string> = {}) {
  const tool = browserImageCodeTools.find((entry) => entry.id === 'image-tools');

  assert.ok(tool);
  calls.length = 0;

  return tool.run({
    fields: { annotations, image: png, operation: 'annotate', ...fields },
    text: '',
  });
}

function pixel(result: ToolResult, x: number, y: number): number[] {
  const image = decodeArtifact(result.artifact!.base64);

  return Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
}

describe('image-tools annotate details', () => {
  beforeEach(() => ({ calls, restore } = installFakeImageApis()));
  afterEach(() => restore());

  it('ignores the hidden format and quality fields', async () => {
    const result = await annotate('rect 1 1 5 5', { format: 'jpeg', quality: '10' });

    assert.equal(result.artifact?.mimeType, 'image/png');
    assert.match(result.artifact?.fileName ?? '', /\.png$/);
  });

  it('draws the shaft of a short arrow forward and skips it when shorter than the head', async () => {
    await annotate('arrow 0 0 40 0');
    const line = calls.find((call) => call.method === 'lineTo');

    assert.ok((line!.args[0] as number) > 0 && (line!.args[0] as number) < 40);

    await annotate('arrow 0 0 6 0');
    assert.equal(calls.filter((call) => call.method === 'lineTo').length, 2);
    assert.ok(calls.every((call) => call.method !== 'moveTo' || call.args[0] === 6));
  });

  it('rejects a zero-length arrow', async () => {
    await assert.rejects(annotate('arrow 3 3 3 3'), /Line 1: the arrow starts and ends/);
  });

  it('rounds redaction outward and draws it opaque black after a highlight', async () => {
    const result = await annotate('highlight 0 0 4 4\nredact 10.5 5.5 3 3');
    const fill = calls.filter((call) => call.method === 'fillRect')[1];

    assert.deepEqual(fill?.args, [10, 5, 4, 4]);

    assert.deepEqual(fill?.state, {
      fillStyle: '#000000',
      font: '32px sans-serif',
      globalAlpha: 1,
    });

    assert.deepEqual(pixel(result, 10, 5), [0, 0, 0, 255]);
    assert.deepEqual(pixel(result, 13, 8), [0, 0, 0, 255]);
  });

  it('strokes rects and circles with the chosen width', async () => {
    await annotate('rect 1 2 3 4\ncircle 9 9 5', { annotationWidth: '7' });

    assert.deepEqual(calls.find((call) => call.method === 'strokeRect')?.args, [1, 2, 3, 4]);
    assert.deepEqual(calls.find((call) => call.method === 'arc')?.args, [9, 9, 5, 0, Math.PI * 2]);
  });

  it('counts the message in code points and allows line separators', async () => {
    const emoji = String.fromCodePoint(0x1f600);
    const separator = String.fromCharCode(0x2028);

    await annotate(`text 0 0 ${emoji.repeat(500)}`);
    await assert.rejects(annotate(`text 0 0 ${emoji.repeat(501)}`), /longer than 500/);
    await annotate(`text 0 0 a${separator}b`);
    assert.equal(calls.find((call) => call.method === 'fillText')?.args[0], `a${separator}b`);
  });

  it('truncates echoed tokens and requires a command', async () => {
    await assert.rejects(
      annotate(`rect ${'z'.repeat(100)} 1 2 3`),
      (error: unknown) => error instanceof Error && error.message.length < 100,
    );

    await assert.rejects(annotate('# nothing'), (error) => error instanceof ToolError);
  });
});
