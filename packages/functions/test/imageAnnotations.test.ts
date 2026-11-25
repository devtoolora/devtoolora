import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseAnnotations } from '@devtoolora/functions/image';

describe('parseAnnotations', () => {
  it('parses the seven commands, skipping comments and blank lines, case-insensitively', () => {
    const commands = parseAnnotations(
      [
        '# note',
        '',
        'TEXT 1 2 hi there',
        'label 3 4 Name',
        'rect 1 2 3 4',
        'Highlight 1 2 3 4',
        'redact 1 2 3 4',
        'arrow 1 2 3 4',
        'circle -5 6.5 7',
      ].join('\n'),
    );

    assert.deepEqual(commands, [
      { kind: 'text', message: 'hi there', x: 1, y: 2 },
      { kind: 'label', message: 'Name', x: 3, y: 4 },
      { height: 4, kind: 'rect', width: 3, x: 1, y: 2 },
      { height: 4, kind: 'highlight', width: 3, x: 1, y: 2 },
      { height: 4, kind: 'redact', width: 3, x: 1, y: 2 },
      { kind: 'arrow', x1: 1, x2: 3, y1: 2, y2: 4 },
      { kind: 'circle', r: 7, x: -5, y: 6.5 },
    ]);
  });

  it('names the line and the problem', () => {
    assert.throws(
      () => parseAnnotations('rect 1 2 3 4\n\nbox 1 2 3 4'),
      /Line 3: unknown command "box"\. Use text, label, rect, highlight, redact, arrow or circle\./,
    );

    assert.throws(() => parseAnnotations('rect 1 2 0 4'), /Line 1: W and H must be above 0\./);
    assert.throws(() => parseAnnotations('circle 1 2 0'), /Line 1: R must be above 0\./);
    assert.throws(() => parseAnnotations('rect 1 2 3'), /Line 1: rect needs 4 numbers: X Y W H\./);
    assert.throws(() => parseAnnotations('rect 1 x 3 4'), /Line 1: "x" is not a number\./);
    assert.throws(() => parseAnnotations('text 1 2'), /Line 1: text needs X, Y and a message\./);
    assert.throws(() => parseAnnotations('text 100001 0 x'), /Line 1: numbers must be between/);

    assert.throws(
      () => parseAnnotations(`text 0 0 ${'a'.repeat(501)}`),
      /Line 1: the message is longer than 500 characters\./,
    );
  });

  it('accepts exactly 200 commands and rejects the 201st', () => {
    const line = 'circle 1 1 1\n';

    assert.equal(parseAnnotations(line.repeat(200)).length, 200);
    assert.throws(() => parseAnnotations(line.repeat(201)), /Line 201: at most 200 commands/);
    assert.equal(parseAnnotations(`text 0 0 ${'a'.repeat(500)}`).length, 1);
    assert.equal(parseAnnotations('text 100000 -100000 x').length, 1);
  });
});
