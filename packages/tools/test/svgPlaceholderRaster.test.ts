import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { type ToolResult } from '@devtoolora/core';
import { browserImageCodeTools } from '../src/catalog/imagesCodes';
import { installFakeImageApis, type Call } from './fakeImageApis';

let calls: Call[] = [];
let restore = () => {};

beforeEach(() => ({ calls, restore } = installFakeImageApis()));
afterEach(() => restore());

async function runTool(id: string, fields: Record<string, string>): Promise<ToolResult> {
  const tool = browserImageCodeTools.find((entry) => entry.id === id);

  assert.ok(tool, id);

  const defaults = Object.fromEntries(
    (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
  );

  return tool.run({ fields: { ...defaults, ...fields }, text: '' });
}

describe('svg placeholder: png and jpeg', () => {
  const fields = {
    background: '#1f2937',
    foreground: '#ffffff',
    height: '630',
    text: '',
    width: '1200',
  };

  it('labels the image with the size entered, not a default text', async () => {
    const output = await runTool('svg-placeholder', { height: '400', width: '400' });

    assert.match(output.text, />400x400</);
  });

  it('draws a png with the svg font size and returns a data uri', async () => {
    const output = await runTool('svg-placeholder', { ...fields, format: 'png', text: '1200x630' });

    assert.equal(output.artifact?.fileName, 'placeholder-1200x630.png');
    assert.ok(output.text.startsWith('data:image/png;base64,'));
    assert.ok(output.previewDataUri?.startsWith('data:image/png;base64,'));

    const text = calls.find((call) => call.method === 'fillText');

    assert.equal(text?.args[0], '1200x630');
    assert.equal(text?.state?.font, '86px Arial, sans-serif');
    assert.equal(text?.state?.fillStyle, '#ffffff');
  });

  it('applies the jpeg extension', async () => {
    const output = await runTool('svg-placeholder', { ...fields, format: 'jpeg', quality: '40' });

    assert.equal(output.artifact?.fileName, 'placeholder-1200x630.jpg');

    assert.deepEqual(calls.find((call) => call.method === 'convertToBlob')?.args, [
      { quality: 0.4, type: 'image/jpeg' },
    ]);

    assert.ok(output.text.startsWith('data:image/jpeg;base64,'));
  });

  it('refuses rasters above 16,777,216 pixels before drawing', async () => {
    calls.length = 0;

    await assert.rejects(
      runTool('svg-placeholder', { ...fields, format: 'png', height: '5000', width: '5000' }),
      /16,777,216/,
    );

    assert.equal(calls.length, 0);
  });

  it('rejects an invalid color in every format', async () => {
    for (const format of ['svg', 'png', 'jpeg'])
      await assert.rejects(
        runTool('svg-placeholder', { ...fields, background: 'nope', format }),
        /color/i,
        format,
      );
  });

  it('keeps svg output unchanged', async () => {
    const output = await runTool('svg-placeholder', { ...fields, text: '1200x630' });

    assert.equal(
      output.text,
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="100%" height="100%" fill="#1f2937"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="86">1200x630</text></svg>',
    );

    assert.equal(output.artifact?.fileName, 'placeholder.svg');
  });

  it('ignores quality for png', async () => {
    await runTool('svg-placeholder', { ...fields, format: 'png', quality: '40' });

    assert.equal(
      (
        calls.find((call) => call.method === 'convertToBlob')?.args[0] as
          { type?: string } | undefined
      )?.type,
      'image/png',
    );
  });
});
