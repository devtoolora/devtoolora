import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { FunctionError } from '../src/errors';
import { parseRegex, type RegexNode, type RegexNodeType } from '../src/text/regexParse';
import { regexEngineTable } from './fixtures/regexEngineTable';

function messageIs(message: string): (error: Error) => boolean {
  return (error) => error.message === message;
}

function invalid(source: string, flags: string, message: string): void {
  assert.throws(
    () => parseRegex(source, flags),
    (error: Error) =>
      error instanceof FunctionError && error.code === 'INVALID_REGEX' && error.message === message,
  );
}

function types(nodes: RegexNode[]): RegexNodeType[] {
  return nodes.map((node) => node.type);
}

function captureNumber(nodes: RegexNode[], target: RegexNode): number {
  let count = 0;

  function visit(list: RegexNode[]): boolean {
    for (const node of list) {
      if (node.type === 'group' && (node.value === 'capture' || node.value === 'named')) count += 1;

      if (node === target || visit(node.children)) return true;
    }

    return false;
  }

  return visit(nodes) ? count : 0;
}

describe('parseRegex', () => {
  it('agrees with the engine on every probed pattern', () => {
    assert.equal(regexEngineTable.length, 164);

    for (const row of regexEngineTable) {
      const label = `${row.flags} ${row.pattern}`;

      if (row.ok) {
        assert.doesNotThrow(() => parseRegex(row.pattern, row.flags), label);

        continue;
      }

      assert.throws(
        () => parseRegex(row.pattern, row.flags),
        (error: Error) =>
          error instanceof FunctionError &&
          error.code === 'INVALID_REGEX' &&
          /at index \d+\.$/.test(error.message),
        label,
      );
    }
  });

  it('builds the spec vector tree', () => {
    const nodes = parseRegex('^(?<year>\\d{4})-(\\d{2})$', '');

    assert.deepEqual(types(nodes), ['anchor', 'group', 'literal', 'group', 'anchor']);

    assert.deepEqual(nodes[1], {
      children: [{ children: [], end: 14, max: 4, min: 4, start: 9, type: 'escape', value: 'd' }],
      end: 15,
      name: 'year',
      start: 1,
      type: 'group',
      value: 'named',
    });

    assert.equal(nodes[3]?.value, 'capture');
    assert.equal(captureNumber(nodes, nodes[3] as RegexNode), 2);
    assert.deepEqual(nodes[2], { children: [], end: 16, start: 15, type: 'literal', value: '-' });
    assert.deepEqual(nodes[0], { children: [], end: 1, start: 0, type: 'anchor', value: '^' });
  });

  it('merges adjacent literal characters', () => {
    assert.deepEqual(parseRegex('abc+d', ''), [
      { children: [], end: 2, start: 0, type: 'literal', value: 'ab' },
      { children: [], end: 4, max: Infinity, min: 1, start: 2, type: 'literal', value: 'c' },
      { children: [], end: 5, start: 4, type: 'literal', value: 'd' },
    ]);
  });

  it('folds quantifiers into their atoms', () => {
    const [star, plus, lazy, braces] = parseRegex('a*(b)+?.{2,}[c]{1,3}?', '');

    assert.deepEqual([star?.min, star?.max, star?.lazy, star?.end], [0, Infinity, undefined, 2]);
    assert.deepEqual([plus?.min, plus?.max, plus?.lazy, plus?.end], [1, Infinity, true, 7]);
    assert.deepEqual([lazy?.type, lazy?.min, lazy?.max], ['any', 2, Infinity]);
    assert.deepEqual([braces?.type, braces?.min, braces?.max, braces?.lazy], ['class', 1, 3, true]);

    assert.deepEqual(types(parseRegex('a|b|', '')), [
      'literal',
      'alternation',
      'literal',
      'alternation',
    ]);
  });

  it('names group kinds and backreferences', () => {
    const nodes = parseRegex('(?:a)(?=b)(?!c)(?<=d)(?<!e)(?i-m:f)(g)\\1\\k<x>(?<x>h)', '');

    assert.deepEqual(
      nodes.map((node) => node.value),
      [
        'nonCapture',
        'lookahead',
        'negativeLookahead',
        'lookbehind',
        'negativeLookbehind',
        'modifiers',
        'capture',
        '1',
        undefined,
        'named',
      ],
    );

    assert.equal(nodes[5]?.name, 'i-m');

    assert.deepEqual(
      [nodes[7]?.type, nodes[8]?.type, nodes[8]?.name],
      ['backreference', 'backreference', 'x'],
    );
  });

  it('parses escapes in both grammars', () => {
    const plain = parseRegex('\\b\\x41\\u{1F600}\\101\\8\\c', '');

    assert.deepEqual(types(plain), [
      'anchor',
      'escape',
      'escape',
      'literal',
      'escape',
      'escape',
      'literal',
    ]);

    assert.deepEqual(
      plain.map((node) => node.value),
      ['b', 'A', 'u', '{1F600}', 'A', '8', '\\c'],
    );

    const unicode = parseRegex('\\u{1F600}\\ud83d\\ude00\\P{Lu}😀+', 'u');

    assert.deepEqual(types(unicode), ['escape', 'escape', 'property', 'literal']);

    assert.deepEqual(
      unicode.map((node) => node.value),
      ['😀', '😀', 'Lu', '😀'],
    );

    assert.deepEqual([unicode[3]?.start, unicode[3]?.end, unicode[3]?.min], [27, 30, 1]);
  });

  it('parses classes and v-mode set operations', () => {
    const [ranges] = parseRegex('[^a-z\\d-]', '');

    assert.equal(ranges?.value, 'negated');
    assert.deepEqual(types(ranges?.children ?? []), ['classRange', 'escape', 'literal']);
    assert.deepEqual(types(ranges?.children[0]?.children ?? []), ['literal', 'literal']);

    const [subtraction] = parseRegex('[[a-z]--\\q{ab|}]', 'v');

    assert.deepEqual(types(subtraction?.children ?? []), ['class', 'classOperator', 'classString']);
    assert.equal(subtraction?.children[1]?.value, '--');

    assert.deepEqual(
      subtraction?.children[2]?.children.map((node) => [node.value, node.start, node.end]),
      [
        ['ab', 11, 13],
        ['', 14, 14],
      ],
    );

    const [intersection] = parseRegex('[\\w&&\\p{L}]', 'v');

    assert.deepEqual(types(intersection?.children ?? []), ['escape', 'classOperator', 'property']);
  });

  it('reports positions', () => {
    invalid('abcd(ef', '', 'Unterminated group opened at index 4.');
    invalid('a)', '', 'Unmatched ")" at index 1.');
    invalid('x{2,1}', '', 'Quantifier {n,m} is out of order at index 1.');
    invalid('\\p{Foo}', 'u', 'Unknown Unicode property "Foo" at index 0.');
    // A property of strings exists only un-negated: the oracle compiles the escape as written.
    invalid('a\\P{RGI_Emoji}', 'v', 'Unknown Unicode property "RGI_Emoji" at index 1.');
    invalid('a{', 'u', 'Incomplete quantifier at index 1.');
  });

  it('pins every error message', () => {
    invalid('ab[c', '', 'Unterminated character class opened at index 2.');
    invalid('a**', '', 'Nothing to repeat at index 2.');
    invalid('(?<=a)?', '', 'Nothing to repeat at index 6.');
    invalid('a}', 'u', 'Lone quantifier bracket at index 1.');
    invalid('[b-a]', '', 'Character class range is out of order at index 1.');
    invalid('[a-\\d]', 'u', 'Invalid class range at index 1.');
    invalid('[(]', 'v', 'Invalid character in class at index 1.');
    invalid('[a&&&b]', 'v', 'Invalid character in class at index 4.');
    invalid('x\\a', 'u', 'Invalid escape at index 1.');
    invalid('(?x:a)', '', 'Invalid group at index 0.');
    invalid('(?<1a>x)', '', 'Invalid group name at index 3.');
    invalid('(?<a>x)(?<a>y)', '', 'Duplicate group name "a" at index 10.');
    invalid('\\k<b>(?<a>c)', '', 'Unknown group name "b" at index 0.');
    invalid('(?ii:a)', '', 'Invalid modifiers at index 3.');
    invalid('(?-:a)', '', 'Invalid modifiers at index 2.');
    invalid('[a-z--[aeiou]]', 'v', 'Invalid set operation at index 4.');
    invalid('ab\\', '', '\\ at end of pattern at index 2.');
    invalid('a[^\\q{ab}]', 'v', 'Negated character class may contain strings at index 1.');
    invalid('[[^\\p{RGI_Emoji}]]', 'v', 'Negated character class may contain strings at index 1.');
  });

  it('clamps quantifier bounds above 2^31-1 like V8', () => {
    assert.equal(parseRegex('a{2147483648}', '')[0]?.max, 2147483647);
    assert.equal(parseRegex('a{0,99999999999}', '')[0]?.max, 2147483647);
    assert.equal(parseRegex('a{99999999999,2147483648}', 'u')[0]?.min, 2147483647);
    invalid('a{2147483648,5}', '', 'Quantifier {n,m} is out of order at index 1.');
  });

  it('accepts an empty modifier list on one side only', () => {
    const accepted: Array<[string, string]> = [
      ['(?i-:a)', ''],
      ['(?ims-:a)', 'u'],
      ['x(?s-:y)z', 'v'],
      ['(?-i:a)', ''],
    ];

    for (const [pattern, flags] of accepted) {
      assert.equal(new RegExp(pattern, flags).source, pattern);
      assert.doesNotThrow(() => parseRegex(pattern, flags), `${flags} ${pattern}`);
    }

    assert.equal(parseRegex('(?i-:a)', '')[0]?.name, 'i-');
    invalid('(?-:a)', 'v', 'Invalid modifiers at index 2.');
  });

  it('accepts prototype group names', () => {
    const nodes = parseRegex('(?<__proto__>a)\\k<__proto__>', '');

    assert.deepEqual(
      nodes.map((node) => [node.type, node.name]),
      [
        ['group', '__proto__'],
        ['backreference', '__proto__'],
      ],
    );

    assert.doesNotThrow(() => parseRegex('(?<a\\u0062>x)\\k<ab>', 'u'));
  });

  it('names its limits', () => {
    const lengthMessage = 'Regex Explainer supports patterns of at most 10,000 UTF-16 units.';
    const depthMessage = 'Regex Explainer supports at most 64 nested groups and classes.';
    const nested = (count: number) => '('.repeat(count) + ')'.repeat(count);
    const limit = (fn: () => unknown, message: string) =>
      assert.throws(
        fn,
        (error: Error) =>
          error instanceof FunctionError &&
          error.code === 'REGEX_LIMIT' &&
          error.message === message,
      );

    assert.equal(parseRegex('a'.repeat(10_000), '').length, 1);
    limit(() => parseRegex('a'.repeat(10_001), ''), lengthMessage);
    assert.doesNotThrow(() => parseRegex(nested(64), ''));
    limit(() => parseRegex(nested(65), ''), depthMessage);
    assert.doesNotThrow(() => parseRegex(`${'['.repeat(64)}${']'.repeat(64)}`, 'v'));
    limit(() => parseRegex(`(${'['.repeat(64)}${']'.repeat(64)})`, 'v'), depthMessage);

    const alternations = parseRegex('|'.repeat(10_000), '');

    assert.equal(alternations.length, 10_000);
    assert.ok(alternations.every((node) => node.type === 'alternation'));
    assert.throws(() => parseRegex('a)', ''), messageIs('Unmatched ")" at index 1.'));
  });
});
