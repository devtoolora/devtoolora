import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { resolveStackTrace } from '../src/logs/sourceMapTrace';

const encoder = new TextEncoder();

function mapFile(
  fields: Record<string, unknown> = {},
  name = 'app.min.js.map',
): { bytes: Uint8Array; name: string } {
  const json = {
    file: 'app.min.js',
    mappings: 'AAAA,SAASA;AACT',
    names: ['boom'],
    sources: ['src/app.ts'],
    version: 3,
    ...fields,
  };

  return { bytes: encoder.encode(JSON.stringify(json)), name };
}

const resolve = (text: string, context = false, files = [mapFile()]) =>
  resolveStackTrace(text, files, { context });

function messageIs(message: string): (error: Error) => boolean {
  return (error) => error.message === message;
}

describe('resolveStackTrace', () => {
  it('keeps the frame name because a map name belongs to the position, not to the function', () => {
    const trace = resolve(
      'E\n    at async x (https://cdn.test/app.min.js:1:12)\n    at new Y (https://cdn.test/app.min.js:1:12)',
    ).trace;

    assert.equal(trace, 'E\n    at async x (src/app.ts:1:10)\n    at new Y (src/app.ts:1:10)');
  });

  it('resolves the spec vector', () => {
    const result = resolve(
      'Error: boom\n    at x (https://cdn.test/app.min.js:1:12)\n    at https://cdn.test/app.min.js:2:1',
    );

    assert.equal(result.trace, 'Error: boom\n    at x (src/app.ts:1:10)\n    at src/app.ts:2:1');
    assert.equal(result.summary, 'Resolved 2 of 2 frames.');

    assert.deepEqual(result.report.frames[0]?.generated, {
      column: 12,
      file: 'https://cdn.test/app.min.js',
      line: 1,
    });

    assert.deepEqual(result.report.frames[0]?.original, {
      column: 10,
      line: 1,
      nameAtPosition: 'boom',
      source: 'src/app.ts',
    });

    assert.deepEqual(result.report.maps, [
      { file: 'app.min.js', name: 'app.min.js.map', sources: 1 },
    ]);
  });

  it('rewrites SpiderMonkey frames', () => {
    const result = resolve(
      'x@https://cdn.test/app.min.js#frag:1:12\n@https://cdn.test/app.min.js:2:1',
    );

    assert.equal(result.trace, 'x@src/app.ts:1:10\n@src/app.ts:2:1');
  });

  it('matches bundler and Windows locations by basename', () => {
    const result = resolve(
      [
        'at x (file:///C:/app/dist/app.min.js:1:12)',
        'at x (webpack:///./dist/app.min.js?v=3:1:12)',
        'at x (C:\\app\\dist\\app.min.js:1:12)',
      ].join('\n'),
    );

    assert.equal(result.summary, 'Resolved 3 of 3 frames.');
    assert.equal(result.trace, Array(3).fill('at x (src/app.ts:1:10)').join('\n'));
  });

  it('preserves CRLF', () => {
    const result = resolve('at keep (app.min.js:2:1)\r\nlast', false, [mapFile({ names: [] })]);

    assert.equal(result.trace, 'at keep (src/app.ts:2:1)\r\nlast');
  });

  it('pairs one map with one file by position', () => {
    const file = mapFile({ file: 'other.js' }, 'bundle.js.map');
    const result = resolve('at a (main.js:1:12)\nat main.js:2:1', false, [file]);

    assert.equal(result.trace, 'at a (src/app.ts:1:10)\nat src/app.ts:2:1');
    assert.ok(result.summary.includes('paired bundle.js.map with main.js by position'));
  });

  it('reports unmatched and unmapped frames', () => {
    const result = resolve('at a (vendor.js:1:1)\nat app.min.js:3:1\nat app.min.js:1:12');

    assert.equal(result.report.frames[0]?.reason, 'no map');
    assert.equal(result.report.frames[0]?.original, null);
    assert.equal(result.report.frames[1]?.reason, 'unmapped');
    assert.equal(result.report.frames[1]?.original, null);
    assert.equal(result.report.frames[2]?.reason, undefined);

    assert.equal(
      result.summary,
      'Resolved 1 of 3 frames · 1 without a map (vendor.js) · 1 unmapped.',
    );

    assert.equal(result.trace.split('\n')[0], 'at a (vendor.js:1:1)');
  });

  it('lists at most three distinct unmatched files', () => {
    const lines = ['a', 'b', 'c', 'd', 'a'].map((name) => `at ${name}.js:1:1`).join('\n');

    assert.equal(
      resolve(lines).summary,
      'Resolved 0 of 5 frames · 5 without a map (a.js, b.js, c.js, …).',
    );
  });

  it('shows context lines', () => {
    const file = mapFile({
      mappings: 'AACA',
      sources: ['b.ts'],
      sourcesContent: ['const a = 1;\nboom();\nconst c = 3;\n'],
    });
    const lines = resolve('Error\n    at app.min.js:1:1', true, [file]).trace.split('\n');

    assert.deepEqual(lines.slice(2), [
      '      1 | const a = 1;',
      '    > 2 | boom();',
      '      3 | const c = 3;',
    ]);

    assert.equal(lines.length, 5);
  });

  it('cuts long context lines and pads numbers', () => {
    const rows = Array(12).fill('short');

    rows[9] = 'x'.repeat(400);

    const file = mapFile({ mappings: 'AASA', sourcesContent: [rows.join('\n')] });
    const lines = resolve('at app.min.js:1:1', true, [file]).trace.split('\n');
    const code = (lines[3] ?? '').split(' | ')[1] ?? '';

    assert.equal(code.length, 300);
    assert.ok(code.endsWith('…'));

    assert.deepEqual(
      lines.slice(1).map((line) => line.split(' | ')[0]),
      ['   8', '   9', '> 10', '  11', '  12'],
    );
  });

  it('counts frames without source content', () => {
    const result = resolve('at app.min.js:1:12', true);

    assert.equal(result.trace, 'at src/app.ts:1:10');
    assert.equal(result.summary, 'Resolved 1 of 1 frames · 1 without source content.');
  });

  it('names its limits', () => {
    const frame = (count: number) => 'at app.min.js:1:1\n'.repeat(count).trimEnd();
    const trace = (size: number) => `${'a'.repeat(size - 1)}\n`;

    assert.doesNotThrow(() => resolve(frame(5000)));

    assert.throws(
      () => resolve(frame(5001)),
      messageIs('The stack trace has more than 5,000 frame lines.'),
    );

    assert.doesNotThrow(() => resolve(`at app.min.js:1:1${' '.repeat(1_048_576 - 17)}`));

    assert.throws(
      () => resolve(`${trace(1_048_577)}at app.min.js:1:1`),
      messageIs('The stack trace is limited to 1,048,576 characters.'),
    );

    assert.throws(
      () => resolve('Error: nothing'),
      messageIs('No stack frames with :line:column locations were found.'),
    );
  });

  it('bounds the resolved output', () => {
    const line = 'x'.repeat(299);
    const file = mapFile({ mappings: 'AAEA', sourcesContent: [Array(5).fill(line).join('\n')] });
    const one = resolve('at app.min.js:1:1', true, [file]).trace.length;
    const fits = Math.floor(5_000_001 / (one + 1));
    const make = (count: number) => 'at app.min.js:1:1\n'.repeat(count).trimEnd();

    assert.equal(resolve(make(fits), true, [file]).trace.length <= 5_000_000, true);

    assert.throws(
      () => resolve(make(fits + 1), true, [file]),
      messageIs('The resolved output is longer than 5,000,000 characters.'),
    );
  });

  it('scans locations in linear time and treats __proto__ as a name', () => {
    const started = performance.now();

    const slow = resolve(`at x (${':1'.repeat(50_000)}`);

    assert.equal(slow.report.frames.length, 1);
    assert.ok(performance.now() - started < 100);

    const proto = mapFile({ file: '__proto__.js' }, '__proto__.js.map');

    assert.equal(
      resolve('at __proto__.js:1:12', false, [proto]).summary,
      'Resolved 1 of 1 frames.',
    );
  });
});
