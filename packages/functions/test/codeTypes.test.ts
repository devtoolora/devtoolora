import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateCodeTypes, parseTypeSample } from '../src/schema';
import type { CodeTypeLanguage } from '../src/schema';

const sample = parseTypeSample(
  '{"id":1,"name":"Ada","tags":["a"],"profile":{"active":true},"score":9.5,"nick":null,"a/b":2}',
);

describe('generateCodeTypes', () => {
  it('renders Go and Python exactly', () => {
    assert.equal(
      generateCodeTypes(sample, 'User', { language: 'go' }).text,
      [
        'type User struct {',
        '\tId int64 `json:"id"`',
        '\tName string `json:"name"`',
        '\tTags []string `json:"tags"`',
        '\tProfile UserProfile `json:"profile"`',
        '\tScore float64 `json:"score"`',
        '\tNick any `json:"nick"`',
        '\tAB int64 `json:"a/b"`',
        '}',
        '',
        'type UserProfile struct {',
        '\tActive bool `json:"active"`',
        '}',
      ].join('\n'),
    );

    assert.equal(
      generateCodeTypes(sample, 'User', { language: 'python' }).text,
      [
        'from dataclasses import dataclass',
        'from typing import Any',
        '',
        '',
        '@dataclass',
        'class UserProfile:',
        '    active: bool',
        '',
        '',
        '@dataclass',
        'class User:',
        '    id: int',
        '    name: str',
        '    tags: list[str]',
        '    profile: UserProfile',
        '    score: float',
        '    nick: Any',
        '    # json key: "a/b"',
        '    a_b: int',
      ].join('\n'),
    );

    assert.equal(generateCodeTypes(sample, 'User', { language: 'go' }).typeCount, 2);
  });

  it('renders the other languages', () => {
    const rust = generateCodeTypes(sample, 'User', { language: 'rust' }).text;

    assert.match(rust, /^use serde::\{Deserialize, Serialize\};/);
    assert.match(rust, /#\[derive\(Debug, Serialize, Deserialize\)\]\npub struct User \{/);
    assert.match(rust, /    #\[serde\(rename = "a\/b"\)\]\n    pub a_b: i64,/);
    assert.match(rust, /pub nick: serde_json::Value,/);

    const kotlin = generateCodeTypes(sample, 'User', { language: 'kotlin' }).text;

    assert.match(kotlin, /@Serializable\ndata class User\(/);
    assert.match(kotlin, /@SerialName\("a\/b"\) val aB: Long,/);
    assert.match(kotlin, /val nick: Any\?,/);

    const java = generateCodeTypes(sample, 'User', { language: 'java' }).text;

    assert.match(
      java,
      /public record User\(long id, String name, List<String> tags, UserProfile profile, double score, Object nick, @JsonProperty\("a\/b"\) long aB\)/,
    );

    const csharp = generateCodeTypes(sample, 'User', { language: 'csharp' }).text;

    assert.match(csharp, /\[JsonPropertyName\("id"\)\]\n    public long Id \{ get; set; \}/);
    assert.match(csharp, /public object\? Nick \{ get; set; \}/);

    const swift = generateCodeTypes(sample, 'User', { language: 'swift' }).text;

    assert.match(swift, /^\/\/ AnyCodable: /);
    assert.match(swift, /struct User: Codable \{\n    let id: Int/);
    assert.match(swift, /enum CodingKeys: String, CodingKey \{[\s\S]*case aB = "a\/b"/);
  });

  it('handles optional and nullable fields', () => {
    const records = parseTypeSample('[{"id":1,"email":"a@b.c"},{"id":2,"email":null}]');

    assert.match(
      generateCodeTypes(records, 'Rows', { language: 'go' }).text,
      /Email \*string `json:"email,omitempty"`/,
    );

    assert.match(
      generateCodeTypes(records, 'Rows', { language: 'rust' }).text,
      /pub email: Option<String>,/,
    );

    assert.match(
      generateCodeTypes(records, 'Rows', { language: 'kotlin' }).text,
      /val email: String\? = null,/,
    );

    assert.match(
      generateCodeTypes(records, 'Rows', { language: 'java' }).text,
      /Long id, String email/,
    );

    assert.match(
      generateCodeTypes(records, 'Rows', { language: 'python', pythonFlavor: 'pydantic' }).text,
      /email: str \| None = None/,
    );

    assert.match(
      generateCodeTypes(records, 'Rows', { language: 'swift' }).text,
      /let email: String\?/,
    );

    assert.equal(generateCodeTypes(records, 'Rows', { language: 'go' }).typeCount, 1);
  });

  it('escapes keywords and digit-leading names', () => {
    const odd = parseTypeSample('{"type":1,"1st":2,"class":3}');

    assert.match(generateCodeTypes(odd, 'Odd', { language: 'rust' }).text, /pub type_: i64,/);
    assert.match(generateCodeTypes(odd, 'Odd', { language: 'python' }).text, /field_1st: int/);
    assert.match(generateCodeTypes(odd, 'Odd', { language: 'java' }).text, /long class_\)/);
  });

  it('supports all-optional mode and enforces limits', () => {
    assert.match(
      generateCodeTypes(sample, 'User', { language: 'go', optionalProperties: 'all' }).text,
      /Id \*int64 `json:"id,omitempty"`/,
    );

    assert.throws(
      () =>
        generateCodeTypes(parseTypeSample('[' + '{"a":1},'.repeat(70_000) + '{"a":1}]'), 'Big', {
          language: 'go',
        }),
      /200,000/,
    );

    assert.throws(
      () => generateCodeTypes(parseTypeSample('[1,2]'), 'Nums', { language: 'go' }),
      /object/,
    );
  });

  it('rejects output over the character cap', () => {
    const keys = Array.from({ length: 40_000 }, (_, index) => `"k${index}":1`);
    const wide = parseTypeSample(`{${keys.join(',')}}`);

    assert.throws(
      () => generateCodeTypes(wide, 'Wide', { language: 'go' }),
      /Generated code exceeds 1,000,000 characters\./,
    );
  });

  it('maps awkward keys in Go tags, Rust and Swift literals and C# members', () => {
    const tab = String.fromCharCode(9);
    const bell = String.fromCharCode(7);
    const keys = JSON.stringify({ '-': 1, 'a,b': 2, [`x${tab}${bell}y`]: 3, union: 4 });
    const value = parseTypeSample(keys);
    const go = generateCodeTypes(value, 'Odd', { language: 'go' }).text;

    assert.match(go, /\tField int64 `json:"-,"`/);

    assert.match(
      go,
      /\t\/\/ key "a,b" contains a comma; encoding\/json cannot map it\n\tAB int64 `json:"-"`/,
    );

    const rust = generateCodeTypes(value, 'Odd', { language: 'rust' }).text;

    assert.match(rust, /#\[serde\(rename = "x\\t\\u\{0007\}y"\)\]/);
    assert.match(rust, /pub union: i64,/);

    assert.match(
      generateCodeTypes(value, 'Odd', { language: 'swift' }).text,
      /case xY = "x\\t\\u\{0007\}y"/,
    );

    const csharp = generateCodeTypes(parseTypeSample('{"root":1,"rootValue":2}'), 'Root', {
      language: 'csharp',
    }).text;

    assert.match(csharp, /\[JsonPropertyName\("root"\)\]\n    public long RootValue \{/);
    assert.match(csharp, /\[JsonPropertyName\("rootValue"\)\]\n    public long RootValue2 \{/);

    const valueFirst = generateCodeTypes(
      parseTypeSample('{"rootValue":1,"Root":2,"root":3}'),
      'Root',
      { language: 'csharp' },
    ).text;

    assert.match(valueFirst, /\("rootValue"\)\]\n    public long RootValue \{/);
    assert.match(valueFirst, /\("Root"\)\]\n    public long RootValue2 \{/);
    assert.match(valueFirst, /\("root"\)\]\n    public long RootValue3 \{/);
  });

  it('escapes quotes, DEL and control characters in Go tags and Rust literals', () => {
    const del = String.fromCharCode(127);
    const soh = String.fromCharCode(1);
    const value = parseTypeSample(JSON.stringify({ [`q"${del}`]: 1, [`${soh}x`]: 2 }));

    assert.match(
      generateCodeTypes(value, 'K', { language: 'go' }).text,
      new RegExp(`\\tQ int64 \`json:"q\\\\"${del}"\`\n\\tX int64 \`json:"\\\\u0001x"\``),
    );

    const rust = generateCodeTypes(value, 'K', { language: 'rust' }).text;

    assert.match(rust, /rename = "q\\"\\u\{007F\}"/);
    assert.match(rust, /rename = "\\u\{0001\}x"/);

    assert.match(
      generateCodeTypes(parseTypeSample('{"union":1}'), 'U', { language: 'rust' }).text,
      /\n    pub union: i64,\n/,
    );
  });

  it('explains why a root cannot be typed', () => {
    const go = { language: 'go' } as const;

    assert.throws(() => generateCodeTypes(parseTypeSample('{}'), 'R', go), {
      message: 'The root object has no properties to type.',
    });

    assert.throws(() => generateCodeTypes(parseTypeSample('[{"a":1},null]'), 'R', go), {
      message: 'Every item in the root array must be an object.',
    });

    assert.throws(() => generateCodeTypes(parseTypeSample('[1,2]'), 'R', go), {
      message: 'Code types need a JSON object or an array of objects as the root.',
    });
  });

  it('escapes reserved words in every language', () => {
    const value = parseTypeSample('{"default":1,"hashCode":2}');
    const text = (language: CodeTypeLanguage) => generateCodeTypes(value, 'W', { language }).text;

    assert.match(text('rust'), /pub default: i64,/);
    assert.match(text('kotlin'), /val default_: Long,/);
    assert.match(text('java'), /long default_, @JsonProperty\("hashCode"\) long hashCode_\)/);
    assert.match(text('csharp'), /public long Default \{/);
    assert.match(text('swift'), /let default_: Int/);
    assert.match(text('python'), /default: int/);
  });

  it('boxes Java list items, which a generic argument requires', () => {
    assert.match(
      generateCodeTypes(parseTypeSample('{"f":[1.5],"i":[1,2],"b":[true],"n":1}'), 'Root', {
        language: 'java',
      }).text,
      /record Root\(List<Double> f, List<Long> i, List<Boolean> b, long n\)/,
    );
  });

  it('keeps a Python field from shadowing the builtin types', () => {
    const text = generateCodeTypes(parseTypeSample('{"str":"x","list":[1],"name":"y"}'), 'Root', {
      language: 'python',
      optionalProperties: 'all',
    }).text;

    assert.match(text, /# json key: "str"\n {4}str_: str \| None = None/);
    assert.match(text, /# json key: "list"\n {4}list_: list\[int\] \| None = None/);
    assert.match(text, /\n {4}name: str \| None = None/);
  });
});
