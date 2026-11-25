import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  compileJsonSchema,
  renderSchemaTypeScript,
  renderSchemaZod,
  typeScriptReservedNames,
} from '../src/schema';

const schema =
  '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"User","type":"object","required":["id","email"],"properties":{"id":{"type":"integer"},"email":{"type":"string","format":"email"},"role":{"enum":["admin","editor"]},"tags":{"type":"array","items":{"type":"string"}},"address":{"$ref":"#/$defs/Address"}},"additionalProperties":false,"$defs":{"Address":{"type":"object","description":"Postal address","properties":{"city":{"type":"string"},"zip":{"type":["string","null"]}},"required":["city"]}}}';

function render(text: string, name: string, options = {}): string {
  return renderSchemaTypeScript(compileJsonSchema(text, name), options);
}

describe('JSON Schema compiler and TypeScript renderer', () => {
  it('renders declarations, descriptions and optional properties', () => {
    const compiled = compileJsonSchema(schema, 'Root');

    assert.deepEqual(
      compiled.declarations.map((d) => d.name),
      ['User', 'Address'],
    );

    assert.deepEqual(compiled.ignored, []);

    assert.equal(
      renderSchemaTypeScript(compiled, {}),
      [
        'export interface User {',
        '  id: number;',
        '  email: string;',
        "  role?: 'admin' | 'editor';",
        '  tags?: string[];',
        '  address?: Address;',
        '}',
        '',
        '/** Postal address */',
        'export interface Address {',
        '  city: string;',
        '  zip?: string | null;',
        '}',
      ].join('\n'),
    );
  });

  it('renders enums, tuples, records, compositions and nullable', () => {
    assert.equal(
      render('{"type":"string","enum":["a","b"]}', 'Mode', {
        declaration: 'type',
        exported: false,
      }),
      "type Mode = 'a' | 'b';",
    );

    assert.equal(
      render(
        '{"type":"array","prefixItems":[{"type":"string"},{"type":"number"}],"items":false}',
        'Pair',
      ),
      'export type Pair = [string, number];',
    );

    assert.equal(
      render(
        '{"type":"object","properties":{"a":{"type":"string"}},"additionalProperties":{"type":"number"}}',
        'Bag',
        { readonly: true },
      ),
      'export type Bag = {\n  readonly a?: string;\n} & Record<string, number>;',
    );

    assert.equal(
      render(
        '{"allOf":[{"$ref":"#/definitions/A"},{"type":"object","properties":{"b":{"const":1}},"required":["b"]}],"definitions":{"A":{"type":"object","properties":{"a":{"type":"boolean"}}}}}',
        'AB',
      ),
      'export type AB = A & {\n  b: 1;\n};\n\nexport interface A {\n  a?: boolean;\n}',
    );

    assert.equal(
      render('{"oneOf":[{"type":"string"},{"type":"null"}],"nullable":true}', 'S'),
      'export type S = string | null;',
    );

    assert.equal(render('true', 'Any'), 'export type Any = unknown;');

    assert.equal(
      render(
        '{"$defs":{"Node":{"type":"object","properties":{"next":{"$ref":"#/$defs/Node"}}}},"$ref":"#/$defs/Node"}',
        'List',
      ),
      'export type List = Node;\n\nexport interface Node {\n  next?: Node;\n}',
    );

    assert.equal(
      render(
        '{"type":"object","properties":{"a/b":{"type":"string"},"constructor":{"type":"number"}}}',
        'Q',
      ),
      "export interface Q {\n  'a/b'?: string;\n  constructor?: number;\n}",
    );
  });

  it('lists ignored keywords', () => {
    const ignored = compileJsonSchema(
      '{"type":"object","properties":{"x":{"type":"string","patternProperties":{}}},"if":{}}',
      'R',
    );

    assert.deepEqual(ignored.ignored, ['if at #', 'patternProperties at #/properties/x']);

    assert.match(
      renderSchemaTypeScript(ignored, {}),
      /\n\n\/\/ ignored: if at #\n\/\/ ignored: patternProperties at #\/properties\/x$/,
    );
  });

  it('rejects bad refs and input', () => {
    assert.throws(
      () => compileJsonSchema('{"$ref":"https://example.com/x.json"}', 'R'),
      /Remote \$ref "https:\/\/example.com\/x.json" is not supported; inline the schema\./,
    );

    assert.throws(
      () => compileJsonSchema('{"$ref":"#/$defs/missing"}', 'R'),
      /\$ref "#\/\$defs\/missing" does not resolve\./,
    );

    assert.throws(() => compileJsonSchema('hello', 'R'), {
      message: /^Invalid JSON Schema at line 1, column 1 \(offset 0\): /,
    });

    assert.throws(() => compileJsonSchema('['.repeat(200), 'R'), {
      message: 'JSON Schema exceeds 64 nesting levels.',
    });

    assert.throws(() => compileJsonSchema('{"type":"string","type":"number"}', 'R'), {
      message: /^JSON Schema: Duplicate key "type" at line 1/,
    });

    assert.throws(
      () => compileJsonSchema('5', 'R'),
      /JSON Schema must be an object or a boolean\./,
    );
  });

  it('handles hostile and unusual schemas without throwing', () => {
    assert.equal(
      compileJsonSchema(
        '{"$defs":{"__proto__":{"type":"string"}},"$ref":"#/$defs/__proto__"}',
        'Root',
      ).declarations[1]?.name,
      'Proto',
    );

    assert.equal(render('{"type":"array","items":[]}', 'T'), 'export type T = [];');

    assert.equal(
      render('{"type":"object","required":["ghost"],"properties":{"a":{"type":"string"}}}', 'G'),
      'export interface G {\n  a?: string;\n}\n\n// ignored: required "ghost" at #',
    );

    assert.equal(
      render(
        '{"$defs":{"A":{"$ref":"#/$defs/B"},"B":{"$ref":"#/$defs/A"}},"$ref":"#/$defs/A"}',
        'C',
      ),
      'export type C = A;\n\nexport type A = B;\n\nexport type B = A;',
    );

    assert.equal(
      render('{"description":"a */ b\\nc","type":"string"}', 'D'),
      '/** a * / b c */\nexport type D = string;',
    );
  });

  it('rejects schemas over the parser node and nesting limits', () => {
    const many = JSON.stringify({
      properties: Object.fromEntries(Array.from({ length: 5_001 }, (_, i) => [`p${i}`, true])),
    });

    assert.throws(() => compileJsonSchema(many, 'R'), /5,000 values\/properties/);

    let deep = '{"type":"string"}';

    for (let i = 0; i < 70; i += 1) deep = `{"items":${deep}}`;

    assert.throws(() => compileJsonSchema(deep, 'R'), /64 nesting levels/);
  });
});

describe('open tuples, Zod 3 formats', () => {
  const open = '{"type":"array","prefixItems":[{"type":"string"}]}';
  const legacy = '{"type":"array","items":[{"type":"string"}]}';
  const zod = (text: string, options = {}): string =>
    renderSchemaZod(compileJsonSchema(text, 'T'), options);

  it('treats a tuple without a tail as open', () => {
    assert.match(render(open, 'T'), /\[string, \.\.\.unknown\[\]\]/);
    assert.match(render(legacy, 'T'), /\[string, \.\.\.unknown\[\]\]/);
    assert.match(zod(open), /z\.tuple\(\[z\.string\(\)\]\)\.rest\(z\.unknown\(\)\)/);
    assert.match(zod(legacy), /\.rest\(z\.unknown\(\)\)/);

    assert.doesNotMatch(
      zod('{"type":"array","items":[{"type":"string"}],"additionalItems":false}'),
      /rest/,
    );
  });

  it('maps date and time in Zod 3', () => {
    const out = zod(
      '{"type":"object","properties":{"d":{"type":"string","format":"date"},"t":{"type":"string","format":"time"}}}',
      { version: 3 },
    );

    assert.match(out, /d: z\.string\(\)\.date\(\)/);
    assert.match(out, /t: z\.string\(\)\.regex\(\/\^\(\?:\[01\]/);
  });
});

describe('Zod renderer', () => {
  const zod = (text: string, name: string, options = {}): string =>
    renderSchemaZod(compileJsonSchema(text, name), options);

  it('renders declarations in dependency order', () => {
    assert.equal(
      zod(schema, 'Root'),
      [
        "import { z } from 'zod';",
        '',
        'export const AddressSchema = z.object({',
        '  city: z.string(),',
        '  zip: z.string().nullable().optional(),',
        "}).describe('Postal address');",
        '',
        'export type Address = z.infer<typeof AddressSchema>;',
        '',
        'export const UserSchema = z.strictObject({',
        '  id: z.number().int(),',
        '  email: z.email(),',
        "  role: z.enum(['admin', 'editor']).optional(),",
        '  tags: z.array(z.string()).optional(),',
        '  address: AddressSchema.optional(),',
        '});',
        '',
        'export type User = z.infer<typeof UserSchema>;',
      ].join('\n'),
    );

    const v3 = zod(schema, 'Root', { exportType: false, version: 3 });

    assert.match(v3, /email: z\.string\(\)\.email\(\),/);
    assert.match(v3, /z\.object\(\{\n  id: z\.number\(\)\.int\(\),[\s\S]*\}\)\.strict\(\);/);
    assert.doesNotMatch(v3, /z\.infer/);
  });

  it('renders constraints, literals, tuples and composition', () => {
    assert.equal(
      zod(
        '{"type":"string","minLength":2,"maxLength":5,"pattern":"^[a-z]+$","format":"uuid"}',
        'Id',
        {
          exportType: false,
        },
      ),
      "import { z } from 'zod';\n\nexport const IdSchema = z.uuid().min(2).max(5).regex(/^[a-z]+$/u);",
    );

    assert.equal(
      zod('{"type":"number","minimum":0,"exclusiveMaximum":10,"multipleOf":0.5}', 'N', {
        exportType: false,
      }),
      "import { z } from 'zod';\n\nexport const NSchema = z.number().min(0).lt(10).multipleOf(0.5);",
    );

    assert.match(
      zod(
        '{"type":"array","prefixItems":[{"type":"string"}],"items":{"type":"number"},"minItems":1}',
        'T',
      ),
      /z\.tuple\(\[z\.string\(\)\]\)\.rest\(z\.number\(\)\)/,
    );

    assert.match(
      zod('{"enum":[1,"a",null]}', 'E'),
      /z\.union\(\[z\.literal\(1\), z\.literal\('a'\), z\.null\(\)\]\)/,
    );

    assert.match(
      zod(
        '{"allOf":[{"type":"object","properties":{"a":{"type":"string"}}},{"type":"object","properties":{"b":{"type":"string"}}}]}',
        'AB',
      ),
      /z\.object\(\{\n  a: z\.string\(\)\.optional\(\),\n\}\)\.and\(z\.object\(\{\n  b: z\.string\(\)\.optional\(\),\n\}\)\)/,
    );

    assert.match(
      zod(
        '{"type":"object","properties":{"a":{"type":"string"}},"additionalProperties":{"type":"number"}}',
        'Bag',
      ),
      /\}\)\.catchall\(z\.number\(\)\)/,
    );

    assert.match(zod('true', 'Any'), /z\.unknown\(\)/);
    assert.match(zod('false', 'Never'), /z\.never\(\)/);

    assert.match(
      zod('{"type":"string","format":"ipv4"}', 'Ip', { version: 3 }),
      /z\.string\(\)\.ip\(\{ version: 'v4' \}\)/,
    );
  });

  it('escapes text, rejects cycles and ignores invalid patterns', () => {
    assert.throws(
      () =>
        zod(
          '{"$defs":{"Node":{"type":"object","properties":{"next":{"$ref":"#/$defs/Node"}}}},"$ref":"#/$defs/Node"}',
          'List',
        ),
      { message: 'Recursive schemas are not supported in Zod output.' },
    );

    const escaped = zod(
      '{"description":"it\'s a\\\\b","type":"object","properties":{"a-b":{"type":"string","pattern":"a/b"}}}',
      'E',
    );

    assert.match(escaped, /\.describe\('it\\'s a\\\\b'\)/);
    assert.match(escaped, /'a-b': z\.string\(\)\.regex\(\/a\\\/b\/u\)\.optional\(\)/);

    const bad = zod('{"type":"string","pattern":"("}', 'P');

    assert.match(bad, /export const PSchema = z\.string\(\);/);
    assert.match(bad, /\/\/ ignored: pattern at #/);
  });

  it('quotes prototype keys, orders diamonds and formats per version', () => {
    const proto =
      '{"type":"object","properties":{"__proto__":{"type":"string"},"constructor":{"type":"number"}}}';
    const zodOut = zod(proto, 'P');

    assert.match(zodOut, /\['__proto__'\]: z\.string\(\)\.optional\(\),/);
    assert.match(zodOut, /constructor: z\.number\(\)\.optional\(\),/);
    assert.match(render(proto, 'P'), /__proto__\?: string;/);

    const diamond = zod(
      '{"type":"object","properties":{"b":{"$ref":"#/$defs/B"},"c":{"$ref":"#/$defs/C"}},"$defs":{"B":{"type":"object","properties":{"c":{"$ref":"#/$defs/C"}}},"C":{"type":"string"}}}',
      'A',
    );

    assert.deepEqual(
      [...diamond.matchAll(/export const (\w+)Schema/g)].map((match) => match[1]),
      ['C', 'B', 'A'],
    );

    assert.throws(
      () => zod('{"$defs":{"A":{"items":{"$ref":"#/$defs/A"}}},"$ref":"#/$defs/A"}', 'R'),
      { message: 'Recursive schemas are not supported in Zod output.' },
    );

    const dateTime = '{"type":"string","format":"date-time"}';

    assert.match(
      zod(dateTime, 'D', { version: 3 }),
      /z\.string\(\)\.datetime\(\{ offset: true \}\)/,
    );

    assert.match(zod(dateTime, 'D'), /z\.iso\.datetime\(\{ offset: true \}\)/);

    const pattern = zod('{"type":"string","pattern":"a\\nb"}', 'N');

    assert.match(pattern, /\.regex\(\/a\\nb\/u\)/);
    assert.doesNotMatch(pattern, /regex\(\/a\n/);
  });
});

describe('nested titles, ignored siblings and reserved names', () => {
  const zod = (text: string): string => renderSchemaZod(compileJsonSchema(text, 'Root'), {});
  const zodNames = (text: string): Array<string | undefined> =>
    [...zod(text).matchAll(/export const (\w+)Schema/g)].map((match) => match[1]);

  it('turns a titled nested object into its own declaration', () => {
    const titled =
      '{"title":"User","type":"object","properties":{"address":{"title":"Postal address","description":"Where mail goes","type":"object","properties":{"city":{"type":"string"}}},"tags":{"type":"array","items":{"title":"Tag","properties":{"name":{"type":"string"}}}},"label":{"title":"Label","type":"string"}},"$defs":{"Tag":{"type":"string"}}}';

    assert.equal(
      render(titled, 'Root'),
      [
        'export interface User {',
        '  address?: PostalAddress;',
        '  tags?: Tag2[];',
        '  label?: string;',
        '}',
        '',
        'export type Tag = string;',
        '',
        '/** Where mail goes */',
        'export interface PostalAddress {',
        '  city?: string;',
        '}',
        '',
        'export interface Tag2 {',
        '  name?: string;',
        '}',
      ].join('\n'),
    );

    assert.deepEqual(zodNames(titled), ['Tag', 'PostalAddress', 'Tag2', 'User']);
  });

  it('keeps a titled nullable object an interface and puts null at the use site', () => {
    const text =
      '{"type":"object","properties":{"a":{"title":"A","description":"An A","type":["object","null"],"properties":{"x":{"type":"string"}}},"b":{"title":"B","nullable":true,"properties":{"y":{"type":"number"}}}}}';

    assert.equal(
      render(text, 'R'),
      [
        'export interface R {',
        '  a?: A | null;',
        '  b?: B | null;',
        '}',
        '',
        '/** An A */',
        'export interface A {',
        '  x?: string;',
        '}',
        '',
        'export interface B {',
        '  y?: number;',
        '}',
      ].join('\n'),
    );

    assert.match(
      zod(text),
      /  a: ASchema\.nullable\(\)\.optional\(\),\n  b: BSchema\.nullable\(\)\.optional\(\),/,
    );
  });

  it('lists dropped keywords and validating $ref siblings', () => {
    const compiled = compileJsonSchema(
      '{"type":"array","items":{"type":"string"},"unevaluatedItems":false,"minContains":1,"maxContains":2,"dependencies":{},"$defs":{"A":{"type":"string"}},"prefixItems":[{"$ref":"#/$defs/A","description":"doc","title":"T","type":"string","minLength":2,"x-vendor":1,"$comment":"c"}]}',
      'R',
    );

    assert.deepEqual(compiled.ignored, [
      'dependencies at #',
      'maxContains at #',
      'minContains at #',
      'unevaluatedItems at #',
      'minLength at #/prefixItems/0',
      'type at #/prefixItems/0',
    ]);

    assert.equal(
      render('{"type":"object","properties":{"a":{"$ref":"#","description":"doc"}}}', 'R'),
      'export interface R {\n  /** doc */\n  a?: R;\n}',
    );
  });

  it('labels the additionalItems pointer and counts omitted entries', () => {
    assert.deepEqual(
      compileJsonSchema(
        '{"type":"array","items":[{"type":"string"}],"additionalItems":{"type":"string","if":{}}}',
        'R',
      ).ignored,
      ['if at #/additionalItems'],
    );

    const many = JSON.stringify({
      properties: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`p${i}`, { if: {} }])),
    });
    const compiled = compileJsonSchema(many, 'R');

    assert.equal(compiled.ignored.length, 50);
    assert.equal(compiled.omitted, 10);
    assert.match(renderSchemaTypeScript(compiled, {}), /\n\/\/ ignored: 10 more omitted$/);
    assert.match(renderSchemaZod(compiled, {}), /\n\/\/ ignored: 10 more omitted$/);
  });

  it('renames declarations that shadow TypeScript globals only when asked', () => {
    const text =
      '{"title":"Record","type":"object","properties":{"a":{"$ref":"#/$defs/Date"}},"$defs":{"Date":{"type":"string"},"DateType":{"type":"number"}}}';

    assert.equal(
      renderSchemaTypeScript(compileJsonSchema(text, 'R', typeScriptReservedNames), {}),
      'export interface RecordType {\n  a?: DateType;\n}\n\nexport type DateType = string;\n\nexport type DateType2 = number;',
    );

    assert.deepEqual(zodNames(text), ['Date', 'Record', 'DateType']);
  });

  const zodCode = (schema: unknown, version: 3 | 4 = 4): string =>
    renderSchemaZod(compileJsonSchema(JSON.stringify(schema), 'R'), { exportType: false, version });

  it('maps date-time and time to Zod checks that accept a UTC offset', () => {
    assert.match(
      zodCode({ format: 'date-time', type: 'string' }),
      /z\.iso\.datetime\(\{ offset: true \}\)/,
    );

    assert.match(
      zodCode({ format: 'date-time', type: 'string' }, 3),
      /z\.string\(\)\.datetime\(\{ offset: true \}\)/,
    );

    for (const version of [3, 4] as const) {
      const source = /\.regex\(\/(.+)\/\)/.exec(
        zodCode({ format: 'time', type: 'string' }, version),
      )?.[1];
      const time = new RegExp(source ?? '$^');

      for (const valid of ['10:00:00Z', '10:00:00+01:00', '23:59:60.5z']) assert.match(valid, time);
      for (const invalid of ['10:00:00', '24:00:00Z', '10:00Z', '10:00:00+1:00'])
        assert.doesNotMatch(invalid, time);
    }
  });

  it('writes patterns with the Unicode flag when they compile with it', () => {
    assert.match(zodCode({ pattern: '\\p{L}+', type: 'string' }), /\.regex\(\/\\p\{L\}\+\/u\)/);

    assert.match(
      zodCode({ pattern: '^[\\w-.]+$', type: 'string' }),
      /\.regex\(\/\^\[\\w-\.\]\+\$\/\)/,
    );
  });

  it('spells array and object constants as exact shapes', () => {
    assert.match(zodCode({ const: [1, 2] }), /z\.tuple\(\[z\.literal\(1\), z\.literal\(2\)\]\)/);

    assert.match(
      zodCode({ const: { a: [1] } }),
      /z\.strictObject\(\{\n {2}a: z\.tuple\(\[z\.literal\(1\)\]\),\n\}\)/,
    );

    assert.match(
      zodCode({ const: { a: 1 } }, 3),
      /z\.object\(\{\n {2}a: z\.literal\(1\),\n\}\)\.strict\(\)/,
    );

    assert.match(
      zodCode({ enum: [[1], null] }),
      /z\.union\(\[z\.tuple\(\[z\.literal\(1\)\]\), z\.null\(\)\]\)/,
    );
  });

  it('lists every constraint the output cannot express', () => {
    const cases: Array<[unknown, RegExp]> = [
      [{ required: ['a'], type: 'object' }, /\/\/ ignored: required "a" at #/],
      [{ properties: { b: {} }, required: ['a', 'b'] }, /\/\/ ignored: required "a" at #/],
      [{ type: 'array', uniqueItems: true }, /\/\/ ignored: uniqueItems at #/],
      [{ minProperties: 1, type: 'object' }, /\/\/ ignored: minProperties at #/],
      [{ maxProperties: 1, type: 'object' }, /\/\/ ignored: maxProperties at #/],
      [{ minimum: 1 }, /\/\/ ignored: minimum at #/],
      [{ minLength: 2 }, /\/\/ ignored: minLength at #/],
      [{ required: ['a'] }, /\/\/ ignored: required at #/],
      [
        { allOf: [{ minimum: 1 }, { maximum: 2 }] },
        /ignored: maximum at #\/allOf\/1\n.*minimum at #\/allOf\/0|ignored: minimum at #\/allOf\/0/,
      ],
      [{ oneOf: [{ required: ['a'] }], type: 'object' }, /\/\/ ignored: required at #\/oneOf\/0/],
    ];

    for (const [schema, listed] of cases) {
      assert.match(zodCode(schema), listed);

      assert.match(
        renderSchemaTypeScript(compileJsonSchema(JSON.stringify(schema), 'R'), {}),
        listed,
      );
    }

    assert.doesNotMatch(zodCode({ properties: { a: {} }, required: ['a'] }), /ignored/);
    assert.doesNotMatch(zodCode({ description: 'x', title: 'y' }), /ignored/);
  });

  it('rejects a schema that defines no type', () => {
    assert.throws(() => compileJsonSchema('{"type":"foo"}', 'R'), /Unknown type "foo" at #\./);

    assert.throws(
      () => compileJsonSchema('{"properties":{"a":{"type":"foo"}}}', 'R'),
      /Unknown type "foo" at #\/properties\/a\./,
    );

    assert.throws(() => compileJsonSchema('{"$ref":"#"}', 'R'), /\$ref to itself/);
  });

  it('resolves a percent-encoded $ref', () => {
    const schema = { $defs: { 'a b': { type: 'string' } }, $ref: '#/$defs/a%20b' };

    assert.match(zodCode(schema), /= z\.string\(\);/);
    assert.throws(() => compileJsonSchema('{"$ref":"#/$defs/%zz"}', 'R'), /does not resolve/);
  });
});
