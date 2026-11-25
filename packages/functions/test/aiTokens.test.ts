import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import { aiLimits, analyzeTokens, estimateTokens } from '../src/ai';

const range = (text: string) => {
  const { estimate, high, low, margin } = analyzeTokens(text);

  return { estimate, high, low, margin };
};

describe('token estimate', () => {
  it('ignores whitespace runs when picking the margin', () => {
    const code = ['let value = 1', 'call(value)', 'return value'];
    const flat = code.join('\n');
    const indented = code.map((line) => `${' '.repeat(40)}${line}`).join('\n');

    assert.equal(analyzeTokens(indented).margin, analyzeTokens(flat).margin);
  });

  it('matches the spec vectors', () => {
    assert.deepEqual(range(''), { estimate: 0, high: 0, low: 0, margin: 0.2 });
    assert.deepEqual(range('Hello world'), { estimate: 3, high: 4, low: 2, margin: 0.2 });

    assert.deepEqual(range('日本語のテキスト'), {
      estimate: 8,
      high: 12,
      low: 4,
      margin: 0.5,
    });

    assert.deepEqual(range('{"a":1}'), { estimate: 3, high: 5, low: 1, margin: 0.4 });
  });

  it('weighs an emoji as two tokens and exposes the plain estimate', () => {
    assert.equal(estimateTokens('\u{1f44d}'), 2);
    assert.equal(estimateTokens('Hello world'), 3);
  });

  it('counts whitespace runs and newlines once each', () => {
    assert.equal(estimateTokens('a  b'), 2);
    assert.equal(estimateTokens('a\r\nb'), 2);
    assert.equal(estimateTokens('a\n\nb'), 3);
  });

  it('reports counts', () => {
    assert.deepEqual(analyzeTokens('a b\nc').counts, {
      codePoints: 5,
      lines: 2,
      utf16Units: 5,
      utf8Bytes: 5,
      words: 3,
    });

    assert.equal(analyzeTokens('').counts.lines, 0);
    assert.equal(analyzeTokens('a\n').counts.lines, 1);
  });

  it('reports context fit from the high estimate', () => {
    const { contextFit } = analyzeTokens('Hello world');

    assert.deepEqual(contextFit[0], { percent: 0, tokens: 8192 });

    assert.deepEqual(
      contextFit.map(({ tokens }) => tokens),
      [8192, 32768, 128000, 200000, 1000000],
    );
  });

  it('enforces the text limit', () => {
    assert.doesNotThrow(() => analyzeTokens('a'.repeat(aiLimits.textUnits)));

    assert.throws(
      () => analyzeTokens('a'.repeat(aiLimits.textUnits + 1)),
      (error) =>
        error instanceof FunctionError &&
        error.message === 'Text must be at most 1,000,000 characters (UTF-16 units).',
    );
  });

  it('estimates text of any length without the estimator input limit', () => {
    const text = 'a '.repeat(aiLimits.textUnits);

    assert.equal(
      estimateTokens(text),
      analyzeTokens(text.slice(0, aiLimits.textUnits)).estimate * 2,
    );
  });
});
