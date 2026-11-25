import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { parseAllDocuments } from 'yaml';
import { formatYaml } from '@devtoolora/functions/format';

const format = (input: string): ReturnType<typeof formatYaml> =>
  formatYaml(input, { indent: 2, mode: 'format' });

describe('formatYaml', () => {
  it('normalizes spacing and keeps comments', () => {
    assert.equal(format('a:   1\nb: [1,2]\n').text, 'a: 1\nb: [ 1, 2 ]\n');
    assert.match(format('# keep\na: 1\n').text, /# keep/);
  });

  it('keeps document separators and aliases', () => {
    const result = format('a: 1\n---\nb: 2\n');

    assert.equal(result.documents, 2);
    assert.ok(result.text.includes('\n---\n'));
    assert.match(format('x: &a 1\ny: *a\n').text, /\*a/);
  });

  it('rejects duplicate keys with a position', () => {
    assert.throws(() => format('a: 1\na: 2\n'), { message: /duplicate key.*line 2, column 1/i });
  });

  it('enforces the document, nesting and alias limits', () => {
    assert.throws(() => format(Array.from({ length: 101 }, () => 'a: 1').join('\n---\n')), {
      message: /100 documents/,
    });

    assert.throws(() => format(`${'['.repeat(101)}${']'.repeat(101)}`), {
      message: /100 nesting levels/,
    });

    const bomb = ['a0: &a0 [x, x, x, x, x, x, x, x, x, x]'];

    for (let level = 1; level < 10; level += 1) {
      bomb.push(
        `a${level}: &a${level} [${Array(10)
          .fill(`*a${level - 1}`)
          .join(', ')}]`,
      );
    }

    assert.throws(() => format(bomb.join('\n')), { message: /10,000 alias/ });
  });

  it('keeps the document count and is idempotent across separators', () => {
    const inputs = [
      'a: 1\n---\nb: 2\n',
      'a: 1\n...\n---\nb: 2\n',
      'a: 1\n# between\n---\nb: 2\n',
      '---\na: 1\n---\n---\nb: 2\n',
      '---\n---\n',
      '%YAML 1.2\n---\n',
      '---\n...\n',
      '%YAML 1.2\n---\n...\n---\nb: 2\n',
    ];

    for (const input of inputs) {
      const first = format(input);
      const second = format(first.text);

      assert.equal(first.documents, parseAllDocuments(input).length, input);
      assert.equal(second.documents, first.documents, input);
      assert.equal(second.text, first.text, input);
    }

    assert.equal(format('a: 1\n---\nb: 2\n').text, 'a: 1\n---\nb: 2\n');
    assert.equal(format('%YAML 1.2\n---\n...\n').text, '%YAML 1.2\n---\n...\n');
  });

  it('parses the source text, not a trimmed copy', () => {
    assert.equal(format('  a: 1\n  b: 2\n').text, 'a: 1\nb: 2\n');
    assert.equal(format('a: |+\n  x\n\n\n').text, 'a: |+\n  x\n\n\n');
    assert.throws(() => format('\n\na: 1\na: 2\n'), { message: /line 4, column 1/ });
  });

  it('treats CRLF like LF', () => {
    assert.equal(format('a:   1\r\nb: 2\r\n').text, format('a:   1\nb: 2\n').text);
  });

  it('keeps the spelling of every number scalar', () => {
    const scalars = [
      '9007199254740993',
      '12345678901234567890',
      '123456789012345678901234567890',
      '3.14159265358979323846',
      '0644',
      '1e400',
      '1e-400',
      '5.',
      '1.50',
      '0x1F',
      '0o17',
      '+5',
      '1E3',
      '.5',
      '-.INF',
    ];

    for (const scalar of scalars) assert.equal(format(`a:   ${scalar}\n`).text, `a: ${scalar}\n`);

    assert.equal(format('1e400:   [0644,  1.10]\n').text, '1e400: [ 0644, 1.10 ]\n');
    assert.equal(format('%YAML 1.1\n---\na: 1_000\n').text, '%YAML 1.1\n---\na: 1_000\n');
  });

  it('keeps a document of only comments', () => {
    assert.deepEqual(format('# a\n# b\n'), { documents: 0, text: '# a\n# b\n' });
    assert.deepEqual(format('# a\r\n\r\n# b'), { documents: 0, text: '# a\n\n# b\n' });
    assert.equal(format('# a\n---\n# b\n').text, '# a\n---\n# b\n');
    assert.equal(format('# a\n---\n# b\n').documents, 1);
  });

  it('escapes characters that YAML readers refuse or read as line breaks', () => {
    assert.equal(format('t: "a\\x7fb"\n').text, 't: "a\\x7fb"\n');
    assert.equal(format('t: "a\\x85b"\n').text, 't: "a\\x85b"\n');
    assert.equal(format('t: "a\\u2028b\\u2029c"\n').text, 't: "a\\u2028b\\u2029c"\n');
    assert.equal(format('t: |\n  a\tb\n').text, 't: |\n  a\tb\n');
    assert.equal(format('t: a\tb\n').text, 't: "a\\tb"\n');
    assert.deepEqual(parseAllDocuments(format('t: "a\\x7f"\n').text)[0]?.toJS(), { t: 'a\u007F' });
  });
});
