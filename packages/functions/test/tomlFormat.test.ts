import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { formatToml } from '@devtoolora/functions/format';

const format = (input: string): ReturnType<typeof formatToml> =>
  formatToml(input, { mode: 'format' });

describe('formatToml', () => {
  it('keeps key order and normalizes spacing', () => {
    assert.equal(format('b=1\na = "x"').text, 'b = 1\na = "x"\n');
  });

  it('round-trips tables and arrays of tables', () => {
    const text = '[server]\nport = 80\n\n[[items]]\nid = 1\n\n[[items]]\nid = 2\n';

    assert.equal(format(text).text, text);
  });

  it('keeps dates as TOML dates and strings as strings', () => {
    assert.equal(format('d = 1979-05-27').text, 'd = 1979-05-27\n');
    assert.equal(format('d = "1979-05-27"').text, 'd = "1979-05-27"\n');
  });

  it('keeps large integers exact', () => {
    assert.equal(format('n = 9223372036854775807').text, 'n = 9223372036854775807\n');
  });

  it('counts comments outside strings only', () => {
    const result = format('# one\na = "x # no" # two\nb = \'#\'\n');

    assert.equal(result.comments, 2);
    assert.equal(result.text, 'a = "x # no"\nb = "#"\n');
  });

  it('validate keeps the input', () => {
    const text = 'a   = 1 # c\n';

    assert.equal(formatToml(text, { mode: 'validate' }).text, text);
  });

  it('reports line and column and limits', () => {
    assert.throws(() => format('a = '), { message: /line 1, column/ });
    assert.throws(() => format('  \n'), { message: /required|empty|Enter/i });
    assert.throws(() => format('a'.repeat(5_000_001)), { message: /5,000,000/ });
  });

  it('keeps every date and time form exactly', () => {
    const text =
      'a = 1979-05-27T07:32:00.123456789Z\nb = 07:32:00\nc = 1979-05-27T07:32:00-08:00\nd = 1979-05-27T07:32:00\n';

    assert.equal(format(text).text, text);
  });

  it('keeps float forms and signs', () => {
    assert.equal(
      format('a=1e21\nb=-0.0\nc=1.5\nd=1.0').text,
      'a = 1e+21\nb = -0.0\nc = 1.5\nd = 1.0\n',
    );
  });

  it('does not treat marker-like strings specially', () => {
    const text = 'a = "__toml_raw__:evil"\nb = "~toml0:1979-05-27"\n';

    assert.equal(format(text).text, text);
  });

  it('sorts integer-like keys because the parser returns plain objects', () => {
    assert.equal(format('"2"=1\n"1"=2').text, '1 = 2\n2 = 1\n');
  });

  it('rejects integers beyond 64 bits', () => {
    assert.throws(() => format('a = 9223372036854775808'), { message: /64-bit/ });
  });

  it('formats more than 5,000 values and more than 1,000,000 characters', () => {
    const many = Array.from({ length: 6_000 }, (_, index) => `k${index} = ${index}\n`).join('');
    const long = `s = "${'x'.repeat(1_100_000)}"\n`;

    assert.equal(format(many).text, many);
    assert.equal(format(long).text, long);

    assert.throws(() => format(`a = ${'['.repeat(129)}${']'.repeat(129)}`), {
      message: /^TOML formatting supports 128 nested levels/,
    });
  });

  it('reports line numbers of the untrimmed source', () => {
    assert.throws(() => format('\n\n\na = \n'), { message: /line 4, column/ });
  });

  it('formats inf and nan', () => {
    assert.equal(format('a = inf\nb = -inf\nc = nan').text, 'a = inf\nb = -inf\nc = nan\n');
  });

  it('formats a comment-only document to nothing', () => {
    assert.deepEqual(formatToml('# a', { mode: 'format' }), { comments: 1, text: '' });
  });
});
