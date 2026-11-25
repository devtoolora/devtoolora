import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  describeInvisible,
  inspectInvisibleText,
  markInvisibleText,
} from '@devtoolora/functions/text';

describe('curated invisible character inspection', () => {
  it('reports names and original UTF-16/code-point/line positions without deleting source', () => {
    const text = '😀\u200Bx\r\nA\uFEFF\rB\u200D';
    const result = inspectInvisibleText(text);

    assert.equal(result.text, text);
    assert.equal(result.removed, 0);
    assert.equal(result.count, 3);

    assert.deepEqual(
      result.matches.map(({ column, end, index, line, pointIndex }) => ({
        column,
        end,
        index,
        line,
        pointIndex,
      })),
      [
        { column: 3, end: 3, index: 2, line: 1, pointIndex: 1 },
        { column: 2, end: 8, index: 7, line: 2, pointIndex: 6 },
        { column: 2, end: 11, index: 10, line: 3, pointIndex: 9 },
      ],
    );

    assert.equal(result.matches[0]!.name, 'ZERO WIDTH SPACE');
    assert.match(result.matches[0]!.context, /\[ZWSP\]/);
    assert.match(result.annotatedText, /\[BOM\]/);
    assert.equal(result.inputLines, 3);
  });

  it('defaults to targeted removal and preserves meaningful emoji and joining controls', () => {
    const source = '\uFEFFzero\u200Bwidth 👨‍👩‍👧‍👦 ♥️\n';
    const result = inspectInvisibleText(source, { mode: 'remove' });

    assert.equal(result.text, 'zerowidth 👨‍👩‍👧‍👦 ♥️\n');
    assert.equal(result.count, 6);
    assert.equal(result.removed, 2);
    assert.equal(result.matches.filter((match) => match.removed).length, 2);
    assert.equal(inspectInvisibleText('👨‍👩‍👧‍👦', { mode: 'remove', scope: 'joiners' }).text, '👨👩👧👦');
    assert.equal(inspectInvisibleText('♥️', { mode: 'remove', scope: 'selectors' }).text, '♥');

    assert.equal(
      inspectInvisibleText('a\u00ADb\u2060c\u200Bd', { mode: 'remove', scope: 'layout' }).text,
      'abcd',
    );
  });

  it('handles bidi, math, supplementary selectors and tags as explicit declared groups', () => {
    const source = 'name\u202Etxt\u202C\u2066x\u2069';

    assert.equal(inspectInvisibleText(source).groups.bidi, 4);
    assert.equal(inspectInvisibleText(source, { mode: 'remove', scope: 'bidi' }).text, 'nametxtx');
    assert.equal(inspectInvisibleText('a\u2062b', { mode: 'remove' }).text, 'a\u2062b');
    assert.equal(inspectInvisibleText('a\u2062b', { mode: 'remove', scope: 'all' }).text, 'ab');
    const selector = inspectInvisibleText('𠀀\u{E0100}').matches[0]!;

    assert.equal(selector.codePoint, 'U+E0100');
    assert.equal(selector.index, 2);
    assert.equal(selector.end, 4);
    assert.equal(selector.pointIndex, 1);
    assert.equal(selector.name, 'VARIATION SELECTOR-17');
    assert.equal(describeInvisible(0xe01ef)?.name, 'VARIATION SELECTOR-256');

    assert.equal(
      inspectInvisibleText('🏴\u{E0067}\u{E0062}\u{E007F}', { mode: 'remove', scope: 'selectors' })
        .text,
      '🏴',
    );

    assert.equal(describeInvisible(0x180f)?.tag, 'FVS4');
  });

  it('keeps contexts valid Unicode and makes scope coverage limits explicit', () => {
    const result = inspectInvisibleText('😀'.repeat(8) + 'a\u200Ba' + '😀'.repeat(8));

    assert.equal(/[\uD800-\uDFFF]/u.test(result.matches[0]!.context), false);
    assert.ok(result.matches[0]!.context.startsWith('…'));
    assert.equal(markInvisibleText('\u202Etext\u202C'), '[RLO]text[PDF]');
    const unlisted = ' \t\u00A0\u2800\u3164\u2028';

    assert.equal(inspectInvisibleText(unlisted).count, 0);
    assert.equal(inspectInvisibleText(unlisted, { mode: 'remove', scope: 'all' }).text, unlisted);
    assert.equal(inspectInvisibleText('').count, 0);
  });

  it('retains raw endings and detects physical interpretation changes after deletion', () => {
    assert.equal(
      inspectInvisibleText('one\u200B\r\ntwo\uFEFF\rthree\n', { mode: 'remove' }).text,
      'one\r\ntwo\rthree\n',
    );

    const empty = inspectInvisibleText('\u200B\uFEFF', { mode: 'remove' });

    assert.equal(empty.text, '');
    assert.equal(empty.lineStructureChanged, true);
    const merged = inspectInvisibleText('a\r\u200B\n', { mode: 'remove' });

    assert.equal(merged.text, 'a\r\n');
    assert.equal(merged.inputLines, 2);
    assert.equal(merged.outputLines, 1);
    assert.equal(merged.lineStructureChanged, true);
  });

  it('enforces complete-operation budgets and stays idempotent for every removal scope', () => {
    const text = '\uFEFFx\u200B\u200D\u2060\u202E\u202C♥️\u{E0067}';

    for (const scope of ['common', 'layout', 'joiners', 'bidi', 'selectors', 'all'] as const) {
      const result = inspectInvisibleText(text, { mode: 'remove', scope });

      assert.equal(inspectInvisibleText(result.text, { mode: 'remove', scope }).text, result.text);
    }

    assert.equal(inspectInvisibleText('x'.repeat(100_000)).count, 0);
    assert.equal(inspectInvisibleText('\u200B'.repeat(10_000)).count, 10_000);
    assert.throws(() => inspectInvisibleText('x'.repeat(100_001)), /100,000/);
    assert.throws(() => inspectInvisibleText('\u200B'.repeat(10_001)), /10,000 detected/);
    assert.throws(() => inspectInvisibleText('\uD800'), /Unicode/);
    assert.throws(() => inspectInvisibleText('\0'), /NUL/);
  });
});
