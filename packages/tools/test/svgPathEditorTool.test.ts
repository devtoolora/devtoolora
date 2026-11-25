import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { ToolResult } from '@devtoolora/core';
import { svgPathEditorTool } from '../src/catalog/imagesCodes';

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

const run = (text: string, fields: Record<string, string> = {}): ToolResult => {
  const output = svgPathEditorTool.run({ fields, text });

  assert.ok(!(output instanceof Promise));

  return output;
};

const decode = (base64 = ''): string => Buffer.from(base64, 'base64').toString('utf8');

describe('SVG Path Editor tool', () => {
  it('declares an auto-running tool with the svg-path preview', () => {
    assert.equal(svgPathEditorTool.autoRun, true);
    assert.equal(svgPathEditorTool.freshResults, true);
    assert.equal(svgPathEditorTool.preview, 'svg-path');
  });

  it('runs every operation', () => {
    assert.equal(run('M0 0 10 10').text, 'M0 0\nL10 10');
    assert.equal(run('m0 0l10 10', { operation: 'absolute' }).text, 'M0 0\nL10 10');
    assert.equal(run('M0 0L10 10', { operation: 'relative' }).text, 'm0 0\nl10 10');
    assert.equal(run('M 0.50 0.50 L 1.00 0.00', { operation: 'minify' }).text, 'M.5.5 1 0');

    assert.equal(
      run('M0 0L10 10', { dx: '5', dy: '2', operation: 'translate' }).text,
      'M5 2\nL15 12',
    );

    assert.equal(run('M0 0L10 10', { operation: 'scale', sx: '2', sy: '3' }).text, 'M0 0\nL20 30');
    assert.equal(run('M0.12345 0', { precision: '2' }).text, 'M0.12 0');
  });

  it('notes the arc conversion of a non-uniform scale', () => {
    const output = run('M10 50A40 40 0 0 1 90 50', { operation: 'scale', sx: '1', sy: '0.5' });

    assert.match(output.text, /C/);
    assert.match(output.summary ?? '', /Arcs were converted to cubic Béziers/);
  });

  it('summarizes commands, segments, subpaths, box and length', () => {
    assert.equal(
      run('M0 0L10 20').summary,
      '2 commands · 2 segments · 1 subpath · 10×20 at 0,0 · length 22.361',
    );

    assert.equal(
      run('M0 0 10 20', { precision: '1' }).summary,
      '1 command · 2 segments · 1 subpath · 10×20 at 0,0 · length 22.4',
    );
  });

  it('takes the d attribute of one path element or document', () => {
    assert.equal(run('<path d="M1 2L3 4"/>').text, 'M1 2\nL3 4');

    assert.equal(
      run(`<svg ${SVG_NS} viewBox="0 0 9 9"><g><path d="M1 2L3 4"/></g></svg>`).text,
      'M1 2\nL3 4',
    );
  });

  it('requires exactly one path', () => {
    const three = `<svg ${SVG_NS}><path d="M0 0"/><path d="M1 1"/><path d="M2 2"/></svg>`;

    assert.throws(() => run(three), {
      message: 'Found 3 <path> elements; paste one path or its d attribute.',
    });

    assert.throws(() => run(`<svg ${SVG_NS}><rect width="1" height="1"/></svg>`), {
      message: 'Found 0 <path> elements; paste one path or its d attribute.',
    });

    assert.throws(() => run(`<svg ${SVG_NS}><path fill="red"/></svg>`), {
      message: 'The <path> element has no d attribute.',
    });

    for (const d of ['', '  \n '])
      assert.throws(() => run(`<path d="${d}"/>`), {
        message: 'The <path> element has no d attribute.',
      });
  });

  it('ignores transforms with a note', () => {
    const note = 'Transforms on the path or its ancestors were ignored.';

    assert.ok(run('<path transform="scale(2)" d="M0 0L1 1"/>').summary?.endsWith(note));

    assert.ok(
      run(
        `<svg ${SVG_NS}><g transform="rotate(45)"><path d="M0 0L1 1"/></g></svg>`,
      ).summary?.endsWith(note),
    );

    assert.ok(!run('<path d="M0 0L1 1"/>').summary?.includes(note));
  });

  it('rejects unsafe markup', () => {
    assert.throws(() => run(`<svg ${SVG_NS}><script>alert(1)</script><path d="M0 0"/></svg>`), {
      message: 'SVG must not contain a <script> element.',
    });
  });

  it('reports invalid path data and fields by name', () => {
    assert.throws(() => run('M0 0 L1'), {
      message: 'Invalid path data at character 8: expected a number.',
    });

    assert.throws(() => run('M0 0', { dx: 'abc', operation: 'translate' }), {
      message: 'Offset x must be a number between -1,000,000 and 1,000,000.',
    });

    assert.throws(() => run('M0 0', { dy: '2000000', operation: 'translate' }), {
      message: 'Offset y must be a number between -1,000,000 and 1,000,000.',
    });

    assert.throws(() => run('M0 0', { operation: 'scale', sx: 'abc' }), {
      message: 'Scale x must be between 0.001 and 1,000 (or -0.001 and -1,000).',
    });

    assert.throws(() => run('M0 0', { operation: 'scale', sy: '0' }), {
      message: 'Scale y must be between 0.001 and 1,000 (or -0.001 and -1,000).',
    });

    assert.throws(() => run('M0 0', { precision: '7' }), { message: /^Precision must be/ });
  });

  it('rounds in absolute space, so relative output never drifts', () => {
    const steps = 'M0 0 L0.4 0 L0.8 0 L1.2 0 L1.6 0 L2 0';
    const relativeSteps = 'm0 0 l0.4 0 l0.4 0 l0.4 0 l0.4 0 l0.4 0';
    const long = `m0 0${' l1.0004 0'.repeat(1000)}`;

    assert.equal(
      run(steps, { operation: 'relative', precision: '0' }).text,
      'm0 0\nl0 0\nl1 0\nl0 0\nl1 0\nl0 0',
    );

    assert.equal(run(steps, { operation: 'relative', precision: '0' }).svgPath?.bbox.width, 2);
    assert.equal(run(relativeSteps, { precision: '0' }).svgPath?.bbox.width, 2);

    assert.equal(
      run(relativeSteps, { operation: 'minify', precision: '0' }).text,
      'm0 0 0 0 1 0 0 0 1 0 0 0',
    );

    assert.equal(run(long, { operation: 'relative' }).svgPath?.bbox.width, 1000.4);
    assert.equal(run(long).svgPath?.bbox.width, 1000.4);
    assert.equal(run(long, { operation: 'minify' }).svgPath?.bbox.width, 1000.4);
  });

  it('writes path.svg and path.json', () => {
    const output = run('M0 0L10 20', { operation: 'relative' });

    assert.equal(output.artifact?.fileName, 'path.svg');
    assert.equal(output.artifact?.mimeType, 'image/svg+xml');

    assert.equal(
      decode(output.artifact?.base64),
      `<svg ${SVG_NS} viewBox="0 0 10 20"><path d="m0 0 l10 20" fill="none" stroke="currentColor"/></svg>`,
    );

    assert.equal(output.artifacts?.[0]?.fileName, 'path.json');

    assert.deepEqual(JSON.parse(decode(output.artifacts?.[0]?.base64)), {
      bbox: { height: 20, width: 10, x: 0, y: 0 },
      commands: [
        { absolute: 'M0 0', command: 'm0 0', index: 0 },
        { absolute: 'L10 20', command: 'l10 20', index: 1 },
      ],
      length: 22.361,
    });
  });

  it('draws path.svg as a fill when the display is fill', () => {
    assert.equal(
      decode(run('M0 0L10 20', { display: 'fill' }).artifact?.base64),
      `<svg ${SVG_NS} viewBox="0 0 10 20"><path d="M0 0 L10 20"/></svg>`,
    );
  });

  it('checks the scale and offset limits with exact messages', () => {
    const scale = 'Scale x must be between 0.001 and 1,000 (or -0.001 and -1,000).';
    const offset = 'Offset x must be a number between -1,000,000 and 1,000,000.';
    const scaled = (sx: string) => run('M1 1L2 2', { operation: 'scale', sx });
    const moved = (dx: string) => run('M1 1L2 2', { dx, operation: 'translate' });

    for (const ok of ['0.001', '1000', '-0.001', '-1000']) assert.ok(scaled(ok).text);
    for (const bad of ['0.0009', '1000.001', '-1000.001'])
      assert.throws(() => scaled(bad), { message: scale });

    for (const ok of ['1000000', '-1000000']) assert.ok(moved(ok).text);
    for (const bad of ['1000001', '-1000001']) assert.throws(() => moved(bad), { message: offset });
  });

  it('pads a zero-size side of the path.svg box to one unit, centred', () => {
    const svgOf = (path: string, fields: Record<string, string> = {}) =>
      decode(run(path, fields).artifact?.base64).match(/viewBox="([^"]*)"/)?.[1];

    assert.equal(svgOf('M0 5H10'), '0 4.5 10 1');
    assert.equal(svgOf('M3 0V8'), '2.5 0 1 8');
    assert.equal(svgOf('M3 4'), '2.5 3.5 1 1');
    assert.equal(svgOf('M3 4', { precision: '0' }), '2.5 3.5 1 1');
  });

  it('labels the offset and scale fields', () => {
    const labels = svgPathEditorTool.fields
      ?.filter((field) => ['dx', 'dy', 'sx', 'sy'].includes(field.id))
      .map((field) => field.label);

    assert.deepEqual(labels, ['Offset x', 'Offset y', 'Scale x', 'Scale y']);
  });

  it('returns the structured path for the preview', () => {
    const output = run('M0 0Q5 10 10 0', { display: 'fill' });

    assert.deepEqual(output.svgPath, {
      bbox: { height: 5, width: 10, x: 0, y: 0 },
      d: 'M0 0\nQ5 10 10 0',
      display: 'fill',
      pointCount: 3,
      points: [
        { index: 0, kind: 'end', x: 0, y: 0 },
        { anchor: { x: 0, y: 0 }, index: 1, kind: 'control', x: 5, y: 10 },
        { index: 1, kind: 'end', x: 10, y: 0 },
      ],
    });

    assert.equal(run('M0 0').svgPath?.display, 'stroke');
  });

  it('caps the preview points at 2,000', () => {
    const path = (count: number) =>
      `M0 0${Array.from({ length: count - 1 }, (_, i) => ` L${i + 1} 1`).join('')}`;

    assert.equal(run(path(2000)).svgPath?.points.length, 2000);

    const over = run(path(2001)).svgPath;

    assert.deepEqual(over?.points, []);
    assert.equal(over?.pointCount, 2001);
  });
});
