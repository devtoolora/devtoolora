import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { decodeVlqSegment, readSourceMaps, scanSegments } from '../src/logs/sourceMap';

const MIB = 1_048_576;
const encoder = new TextEncoder();

function file(json: string, name = 'app.js.map'): { bytes: Uint8Array; name: string } {
  return { bytes: encoder.encode(json), name };
}

function mapJson(fields: Record<string, unknown>): string {
  return JSON.stringify({ mappings: '', names: [], sources: [], version: 3, ...fields });
}

function parseOne(fields: Record<string, unknown>) {
  return readSourceMaps([file(mapJson(fields))])[0]!;
}

function messageIs(message: string): (error: Error) => boolean {
  return (error) => error.message === message;
}

function padded(size: number): { bytes: Uint8Array; name: string } {
  const base = '{"version":3,"mappings":"","sources":[],"names":[]}';

  return file(base + ' '.repeat(size - base.length), 'big.js.map');
}

describe('decodeVlqSegment', () => {
  it('decodes the spec VLQ vectors', () => {
    const vectors: Array<[string, number[]]> = [
      ['AAAA', [0, 0, 0, 0]],
      ['gB', [16]],
      ['D', [-1]],
      ['2H', [123]],
      ['+/////D', [2147483647]],
      ['SAASA', [9, 0, 0, 9, 0]],
      ['AACT', [0, 0, 1, -9]],
      ['B', [0]],
      ['C', [1]],
    ];

    for (const [segment, expected] of vectors) {
      assert.deepEqual(decodeVlqSegment(segment, 0, 'a.map'), expected, segment);
    }
  });

  it('rejects bad VLQ', () => {
    assert.throws(
      () => decodeVlqSegment('gggggggB', 10, 'a.map'),
      messageIs('a.map: a mapping value has more than 7 digits at offset 10.'),
    );

    assert.throws(
      () => decodeVlqSegment('+/////H', 0, 'a.map'),
      messageIs('a.map: a mapping value exceeds 2,147,483,647 at offset 0.'),
    );

    assert.throws(
      () => decodeVlqSegment('ggggggE', 0, 'a.map'),
      messageIs('a.map: a mapping value exceeds 2,147,483,647 at offset 0.'),
    );

    assert.throws(
      () => decodeVlqSegment('A!A', 5, 'a.map'),
      messageIs('a.map: invalid mapping character at offset 6.'),
    );
  });
});

describe('scanSegments', () => {
  it('scans the vector map', () => {
    const map = parseOne({
      file: 'app.min.js',
      mappings: 'AAAA,SAASA;AACT',
      names: ['boom'],
      sources: ['src/app.ts'],
    });
    const result = scanSegments(map, new Set([0, 1]));

    assert.deepEqual(result.get(0), [
      { column: 0, source: 0, sourceColumn: 0, sourceLine: 0 },
      { column: 9, name: 0, source: 0, sourceColumn: 9, sourceLine: 0 },
    ]);

    assert.deepEqual(result.get(1), [{ column: 0, source: 0, sourceColumn: 0, sourceLine: 1 }]);
  });

  it('stops scanning after the highest needed line', () => {
    const map = parseOne({ mappings: 'AAAA;!!!;AAAA' });

    assert.deepEqual([...scanSegments(map, new Set([0])).keys()], [0]);
  });

  it('accepts a very large line set', () => {
    const map = parseOne({ mappings: 'AAAA' });
    const lines = new Set(Array.from({ length: 200_000 }, (_, index) => index));

    assert.deepEqual([...scanSegments(map, lines).keys()], [0]);
  });

  it('keeps one-field segments and resets columns per line', () => {
    const map = parseOne({ mappings: 'E,C;C', sources: ['a'] });
    const result = scanSegments(map, new Set([0, 1]));

    assert.deepEqual(result.get(0), [{ column: 2 }, { column: 3 }]);
    assert.deepEqual(result.get(1), [{ column: 1 }]);
  });

  it('stops after 10,000,000 segments', () => {
    const map = parseOne({ mappings: 'A,'.repeat(10_000_000) + 'A' });

    assert.throws(
      () => scanSegments(map, new Set([0])),
      messageIs('app.js.map has more than 10,000,000 mapping segments.'),
    );
  });
});

describe('readSourceMaps', () => {
  it('checks shape and limits', () => {
    const bad = (fields: Record<string, unknown>, message: string): void => {
      assert.throws(() => parseOne(fields), messageIs(message));
    };

    bad({ version: 2 }, 'app.js.map: version must be 3.');
    bad({ sections: [] }, 'Index source maps (sections) are not supported.');
    bad({ mappings: 1 }, 'app.js.map: mappings must be a string.');
    bad({ sources: [1] }, 'app.js.map: sources and names must be arrays of strings or null.');
    bad({ names: 'x' }, 'app.js.map: sources and names must be arrays of strings or null.');

    bad(
      { sources: new Array(100_001).fill('a') },
      'app.js.map has more than 100,000 sources or names.',
    );

    assert.equal(parseOne({ sources: new Array(100_000).fill('a') }).sources.length, 100_000);
    assert.throws(() => readSourceMaps([file('{')]), messageIs('app.js.map is not valid JSON.'));
    assert.throws(() => readSourceMaps([file('[]')]), messageIs('app.js.map is not valid JSON.'));
  });

  it('rejects bad segments while scanning', () => {
    const three = parseOne({ mappings: 'AAAA;AAA' });

    assert.throws(
      () => scanSegments(three, new Set([1])),
      messageIs('app.js.map: generated line 2 has a segment with 3 fields.'),
    );

    const negative = parseOne({ mappings: 'AAAA;DAAA' });

    assert.throws(
      () => scanSegments(negative, new Set([1])),
      messageIs('app.js.map: generated line 2 has a negative source index, line or column.'),
    );

    const invalid = parseOne({ mappings: 'A!AA' });

    assert.throws(
      () => scanSegments(invalid, new Set([0])),
      messageIs('app.js.map: invalid mapping character at offset 1.'),
    );
  });

  it('applies sourceRoot, nulls and sourcesContent', () => {
    const rooted = parseOne({
      sourceRoot: 'webpack:/root',
      sources: ['a.ts', null],
      sourcesContent: ['x', null],
    });

    assert.deepEqual(rooted.sources, ['webpack:/root/a.ts', null]);
    assert.deepEqual(rooted.sourcesContent, ['x', null]);
    assert.equal(parseOne({ sourceRoot: 'r/', sources: ['a'] }).sources[0], 'r/a');
    assert.equal(parseOne({}).sourcesContent, null);

    assert.throws(() => parseOne({ sources: ['a'], sourcesContent: ['x', 'y'] }), /more entries/);

    assert.deepEqual(parseOne({ sources: ['a', 'b'], sourcesContent: ['x'] }).sourcesContent, [
      'x',
    ]);

    assert.equal(parseOne({}).sourceRoot, '');
  });

  it('checks file count', () => {
    const one = file(mapJson({}));

    assert.throws(() => readSourceMaps([]), messageIs('Add 1 to 20 source map files.'));
    assert.equal(readSourceMaps(new Array(20).fill(one)).length, 20);

    assert.throws(
      () => readSourceMaps(new Array(21).fill(one)),
      messageIs('Add 1 to 20 source map files.'),
    );
  });

  it('checks file and total sizes before parsing', () => {
    assert.equal(readSourceMaps([padded(50 * MIB)]).length, 1);

    assert.throws(
      () => readSourceMaps([padded(50 * MIB + 1)]),
      messageIs('big.js.map is larger than 50 MiB.'),
    );

    const spy = vi.spyOn(JSON, 'parse');

    try {
      assert.throws(
        () => readSourceMaps([padded(50 * MIB), padded(50 * MIB), file('{}', 'tiny.map')]),
        messageIs('Source maps are limited to 100 MiB in total.'),
      );

      assert.equal(spy.mock.calls.length, 0);
    } finally {
      spy.mockRestore();
    }
  });

  it('treats __proto__ as an ordinary file name', () => {
    const [data] = readSourceMaps([file(mapJson({ file: 'x.js' }), '__proto__.js.map')]);

    assert.ok(data);
    assert.equal(data.name, '__proto__.js.map');
    assert.equal(data.file, 'x.js');
  });
});
