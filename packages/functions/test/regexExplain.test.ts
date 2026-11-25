import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { explainRegex } from '../src/text';

const VECTOR = [
  'Flags: none',
  '^         Start of input',
  '(?<year>  Named capture group "year" (group 1)',
  '  \\d{4}   A digit (0-9), exactly 4 times',
  ')',
  '-         The character "-"',
  '(         Capture group 2',
  '  \\d{2}   A digit (0-9), exactly 2 times',
  ')',
  '$         End of input',
  '',
].join('\n');
const FLAGS_MESSAGE =
  'Flags must be unique JavaScript flags d g i m s u v y; u and v cannot be combined.';
const LIMIT_MESSAGE = 'Regex Explainer output is longer than 500,000 characters.';

function messageOf(input: string, flags: string): string {
  try {
    explainRegex(input, flags);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return '';
}

describe('explainRegex', () => {
  it('explains the spec vector', () => {
    const result = explainRegex('^(?<year>\\d{4})-(\\d{2})$', '');

    assert.equal(result.text, VECTOR);
    assert.equal(result.json.nodes.length, 5);
    assert.equal(result.summary, 'Explained 7 nodes · no warnings.');

    assert.deepEqual(result.json.nodes[1], {
      children: [
        {
          children: [],
          end: 14,
          explanation: 'A digit (0-9), exactly 4 times',
          start: 9,
          type: 'escape',
        },
      ],
      end: 15,
      explanation: 'Named capture group "year" (group 1)',
      start: 1,
      type: 'group',
    });
  });

  it('splits a pasted literal with an escaped slash', () => {
    const result = explainRegex('/a\\/b/gi', 'm');

    assert.equal(result.json.flags, 'gi');
    assert.equal(result.text, 'Flags: g (global), i (ignore case)\na\\/b  The characters "a/b"\n');
    assert.equal(result.summary, 'Explained 1 node · no warnings · flags from the /…/ literal.');
  });

  it('keeps the field flags for a literal without flags', () => {
    const result = explainRegex('/ab/', 'm');

    assert.equal(result.json.flags, 'm');
    assert.equal(result.summary, 'Explained 1 node · no warnings.');
  });

  it('words flags, lazy quantifiers and anchors', () => {
    const result = explainRegex('^.+?$', 'ms');

    assert.equal(
      result.text,
      [
        'Flags: m (multiline), s (dot matches newlines)',
        '^    Start of a line',
        '.+?  Any character, one or more times, as few times as possible',
        '$    End of a line',
        '',
      ].join('\n'),
    );
  });

  it('words groups, classes, escapes and references', () => {
    const text = explainRegex('(?<!a)(?i-:b)[^a-c\\d]\\k<n>(?<n>\\x41)\\1\\p{L}\\n', 'u').text;

    for (const line of [
      'Not preceded by',
      'Group with flags i on',
      'One character not in the set',
      'A character from "a" to "c"',
      'The text matched by group "n"',
      'The text matched by group 1',
      'A character with Unicode property L',
      'The character U+0041 ("A")',
      'The character U+000A',
    ])
      assert.ok(text.includes(line), line);

    assert.ok(
      explainRegex('\\101', '').text.includes('The character U+0041 ("A") (legacy octal escape)'),
    );

    assert.ok(explainRegex('(?-i:a)', '').text.includes('Group with flags i off'));
    assert.ok(explainRegex('(?s-i:a)', '').text.includes('Group with flags s on, i off'));
    assert.ok(explainRegex('\\P{L}', 'u').text.includes('A character without Unicode property L'));
  });

  it('words v-mode sets and quantifier forms', () => {
    const sets = explainRegex('[[a-z]--[aeiou]][\\q{a|bc}]', 'v').text;

    assert.ok(sets.includes('Minus'));
    assert.ok(sets.includes('One of the strings "a", "bc"'));
    assert.ok(explainRegex('[a&&b]', 'v').text.includes('Intersected with'));

    const quantifiers = explainRegex('a*b?c{2,}d{1,3}(?:x)+e|f', '').text;

    for (const line of [
      ', zero or more times',
      ', optionally',
      ', 2 or more times',
      ', 1 to 3 times',
      ', one or more times',
      'Or',
    ])
      assert.ok(quantifiers.includes(line), line);
  });

  it('words quantifier bounds as written, even above the engine clamp', () => {
    assert.ok(explainRegex('a{2147483648}', '').text.includes(', exactly 2147483648 times'));
    assert.ok(explainRegex('a{0,99999999999}', '').text.includes(', 0 to 99999999999 times'));

    assert.ok(
      explainRegex('a{99999999999999999999,99999999999999999999}', '').text.includes(
        ', exactly 99999999999999999999 times',
      ),
    );

    assert.ok(
      explainRegex('a{2147483648,2147483649}?', '').text.includes(
        ', 2147483648 to 2147483649 times, as few times as possible',
      ),
    );

    assert.ok(explainRegex('a{007,}', '').text.includes(', 7 or more times'));
    assert.equal(explainRegex(`(?:a{0,${'9'.repeat(400)}})+`, '').json.warnings.length, 1);
    assert.equal(explainRegex('(?:a+){1,99999999999}', '').json.warnings.length, 1);
  });

  it('words a lone escaped syntax character like a merged run', () => {
    assert.equal(explainRegex('\\$', '').text, 'Flags: none\n\\$  The character "$"\n');
    assert.ok(explainRegex('[\\$]', '').text.includes('\\$  The character "$"'));
    assert.ok(explainRegex('\\.+', 'u').text.includes('The character ".", one or more times'));
  });

  it('warns about nested unbounded quantifiers', () => {
    assert.deepEqual(explainRegex('((a+)+)$', '').json.warnings, [
      'Nested unbounded quantifier at index 5 may backtrack heavily on input that does not match.',
    ]);

    assert.deepEqual(explainRegex('(a+)?', '').json.warnings, []);
    assert.deepEqual(explainRegex('(a+){2,5}', '').json.warnings, []);
    assert.equal(explainRegex('(a+)+', '').summary, 'Explained 2 nodes · 1 warning.');
    assert.equal(explainRegex('(?:a|b*){2,}', '').json.warnings.length, 1);

    assert.ok(
      explainRegex('((a+)+)$', '').text.endsWith(
        '\nWarning: Nested unbounded quantifier at index 5 may backtrack heavily on input that does not match.\n',
      ),
    );

    assert.ok(!explainRegex('(a+)?', '').text.includes('Warning'));
  });

  it('labels legacy octal escapes only', () => {
    assert.equal(
      explainRegex('\\1', '').text,
      'Flags: none\n\\1  The character U+0001 (legacy octal escape)\n',
    );

    assert.ok(
      explainRegex('\\18', '').text.includes('\\1  The character U+0001 (legacy octal escape)'),
    );

    assert.ok(!explainRegex('\\0', '').text.includes('legacy'));
    assert.ok(!explainRegex('\\8', '').text.includes('legacy'));
  });

  it('prints the full opener of an escaped group name', () => {
    assert.ok(explainRegex('(?<\\u0061>x)', '').text.includes('(?<\\u0061>  Named capture group'));
  });

  it('describes an empty pattern', () => {
    const result = explainRegex('', 'g');

    assert.equal(
      result.text,
      'Flags: g (global)\n(empty)  Matches an empty string at every position\n',
    );

    assert.deepEqual(result.json.nodes, []);
  });

  it('never shows engine messages', () => {
    assert.equal(
      messageOf('[^\\q{ab}]', 'v'),
      'Negated character class may contain strings at index 0.',
    );

    assert.equal(messageOf('a{', 'u'), 'Incomplete quantifier at index 1.');
    assert.equal(messageOf('a', 'uv'), FLAGS_MESSAGE);
    assert.equal(messageOf('a', 'gg'), FLAGS_MESSAGE);
    assert.equal(messageOf('a', 'x'), FLAGS_MESSAGE);
    assert.equal(messageOf('/a/gg', ''), FLAGS_MESSAGE);
    assert.ok(!messageOf('(', '').includes('Invalid regular expression'));
  });

  it('blames the runtime when only its engine rejects the pattern', () => {
    vi.stubGlobal('RegExp', function RejectingRegExp(): never {
      throw new SyntaxError('Invalid regular expression');
    });

    try {
      assert.equal(
        messageOf('a', ''),
        "This runtime's regex engine rejects the pattern; it may use syntax newer than this runtime.",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('names its output limit', () => {
    const wrap = (inner: string): string => `${'('.repeat(64)}${inner}${')'.repeat(64)}`;

    assert.equal(messageOf(wrap('\\W'.repeat(4_900)), ''), LIMIT_MESSAGE);
    assert.ok(explainRegex(wrap('\\W'.repeat(3_000)), '').text.length <= 500_000);
  });

  it('handles prototype names', () => {
    assert.ok(
      explainRegex('(?<__proto__>a)', '').text.includes(
        'Named capture group "__proto__" (group 1)',
      ),
    );
  });
});
