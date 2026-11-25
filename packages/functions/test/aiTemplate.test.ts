import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import type { JsonValue } from '../src/format';
import { parseAiJson, parseAiText, renderTemplate, type TemplateResult } from '../src/ai';

type Options = Parameters<typeof renderTemplate>[2];
type StandaloneCase = {
  data: JsonValue;
  expected: string;
  file: string;
  name: string;
  template: string;
};

const standalone: StandaloneCase[] = JSON.parse(
  readFileSync(new URL('./fixtures/mustacheStandalone.json', import.meta.url), 'utf8'),
);
const base: Options = { escape: 'none', missing: 'error' };
const render = (template: string, variables: JsonValue = {}, options: Partial<Options> = {}) =>
  renderTemplate(template, variables, { ...base, ...options }).output;
const fails = (action: () => unknown, message: string) =>
  assert.throws(action, (error) => error instanceof FunctionError && error.message === message);
const failsWith = (action: () => unknown, fragment: string) =>
  assert.throws(
    action,
    (error) => error instanceof FunctionError && error.message.includes(fragment),
  );
const nest = (depth: number) => `${'{{#a}}'.repeat(depth)}x${'{{/a}}'.repeat(depth)}`;
const limits = { characters: 1_000_000, depth: 64 };

describe('prompt template renderer', () => {
  it('renders every Mustache standalone-line case', () => {
    assert.equal(standalone.length, 20);

    for (const { data, expected, file, name, template } of standalone)
      assert.equal(render(template, data), expected, `${file}: ${name}`);
  });

  it('resolves names, dotted names and the current item', () => {
    const data = { a: { b: { c: 'deep' } }, items: ['x', 'y'], name: 'Ada' };

    assert.equal(render('Hi {{name}}, {{ a.b.c }}!', data), 'Hi Ada, deep!');
    assert.equal(render('{{#items}}[{{.}}]{{/items}}', data), '[x][y]');
    assert.equal(render('{{#a}}{{#b}}{{c}} {{name}}{{/b}}{{/a}}', data), 'deep Ada');
    fails(() => render('{{#a}}{{b.name}}{{/a}}', data), 'Variable "b.name" is missing (line 1).');
  });

  it('repeats arrays, pushes truthy objects and skips falsy values', () => {
    const data = {
      empty: [],
      no: false,
      none: null,
      user: { name: 'Lin' },
      users: [{ name: 'A' }, { name: 'B' }],
      zero: 0,
    };

    assert.equal(render('{{#users}}{{name}},{{/users}}', data), 'A,B,');
    assert.equal(render('{{#user}}{{name}}{{/user}}', data), 'Lin');
    assert.equal(render('{{#empty}}x{{/empty}}{{#no}}x{{/no}}{{#none}}x{{/none}}', data), '');
    assert.equal(render('{{#zero}}x{{/zero}}{{#absent}}x{{/absent}}', data), '');
    assert.equal(render('{{^empty}}e{{/empty}}{{^no}}n{{/no}}{{^user}}u{{/user}}', data), 'en');
    assert.equal(render('{{^absent}}a{{/absent}}', data), 'a');
  });

  it('prints values and escapes only double-brace tags', () => {
    const data = {
      flag: true,
      html: '<a href="x">&</a>',
      list: [1, 'b'],
      n: 1.5,
      nil: null,
      obj: { a: 1 },
    };

    assert.equal(
      render('{{n}}|{{flag}}|{{nil}}|{{obj}}|{{list}}', data),
      '1.5|true||{"a":1}|[1,"b"]',
    );

    assert.equal(render('{{html}}', data), data.html);

    assert.equal(
      render('{{html}}|{{{html}}}|{{& html}}', data, { escape: 'html' }),
      '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;|<a href="x">&</a>|<a href="x">&</a>',
    );

    assert.equal(render('{{obj}}', data, { escape: 'html' }), '{&quot;a&quot;:1}');
    assert.equal(render('a{{! note }}b'), 'ab');
  });

  it('treats prototype keys as ordinary names', () => {
    fails(() => render('{{__proto__}}'), 'Variable "__proto__" is missing (line 1).');
    fails(() => render('{{constructor}}'), 'Variable "constructor" is missing (line 1).');
    assert.equal(render('{{__proto__}}', JSON.parse('{"__proto__":"own"}')), 'own');
  });

  it('handles missing variables per mode and counts the render', () => {
    const template = 'Hi\n\n{{customer.name}} {{{x}}} {{customer.name}} {{y}}';

    fails(() => render(template), 'Variable "customer.name" is missing (line 3).');
    assert.equal(render(template, { y: 1 }, { missing: 'empty' }), 'Hi\n\n   1');

    const kept: TemplateResult = renderTemplate(template, { y: 1 }, { ...base, missing: 'keep' });

    assert.deepEqual(kept, {
      iterations: 0,
      kept: ['customer.name', 'x'],
      output: 'Hi\n\n{{customer.name}} {{{x}}} {{customer.name}} 1',
      sections: 0,
      variables: 3,
    });

    const counted = renderTemplate('{{#a}}{{.}}{{/a}}{{^b}}!{{/b}}', { a: [1, 2, 3] }, base);

    assert.deepEqual(counted, {
      iterations: 4,
      kept: [],
      output: '123!',
      sections: 2,
      variables: 1,
    });
  });

  it('reports structure and unsupported tags', () => {
    fails(() => render('a\nb\nc\n{{#items}}x'), 'Section "items" opened on line 4 is not closed.');

    fails(
      () => render('\n{{#a}}\n\n\n{{/b}}'),
      'Section "a" opened on line 2 is closed by "b" on line 5.',
    );

    fails(() => render('\n\n\n\n{{/b}}'), 'Closing tag "b" on line 5 has no open section.');
    fails(() => render('\n\n{{> header}}'), 'Partials ({{> name}}) are not supported (line 3).');

    fails(
      () => render('\n\n{{=<% %>=}}'),
      'Delimiter changes ({{= =}}) are not supported (line 3).',
    );
  });

  it('rejects an unclosed tag', () => {
    fails(() => render('Hello {{name'), 'Tag opened on line 1 is not closed.');
    fails(() => render('x\n{{{name}}'), 'Tag opened on line 2 is not closed.');
    fails(() => render('{{! open comment'), 'Tag opened on line 1 is not closed.');
  });

  it('rejects empty tags', () => {
    for (const tag of ['{{}}', '{{ }}', '{{#}}', '{{/}}', '{{^}}', '{{&}}', '{{{}}}'])
      fails(() => render(`\n${tag}`), 'Empty tag on line 2.');

    assert.equal(render('a{{!}}b'), 'ab');
  });

  it('limits the template size and section depth', () => {
    assert.equal(render('a'.repeat(200_000)).length, 200_000);
    failsWith(() => render('a'.repeat(200_001)), '200,000 characters');
    assert.equal(render(nest(32), { a: true }), 'x');
    failsWith(() => render(nest(33), { a: true }), '32 levels');
  });

  it('limits iterations and output size', () => {
    const items = (count: number) => ({ a: Array.from({ length: count }, () => 0) });

    assert.equal(renderTemplate('{{#a}}{{/a}}', items(100_000), base).iterations, 100_000);
    failsWith(() => render('{{#a}}{{/a}}', items(100_001)), '100,000 section iterations');

    const s = 'x'.repeat(2_000_000);

    assert.equal(render('{{s}}', { s }).length, 2_000_000);
    failsWith(() => render('{{s}}!', { s }), '2,000,000 characters');
  });

  it('charges every node evaluation to a step budget', () => {
    const tags = (count: number) => '{{x}}'.repeat(count);
    const items = { a: Array.from({ length: 99_999 }, () => 0) };
    const exact = `${tags(49)}{{#a}}${tags(50)}{{/a}}`;
    const message = 'Rendering must take at most 5,000,000 steps.';

    // 49 root tags + 1 section + 99,999 items x 50 tags = 5,000,000 steps.
    assert.equal(render(exact, items, { missing: 'empty' }), '');
    fails(() => render(`{{x}}${exact}`, items, { missing: 'empty' }), message);

    const started = Date.now();

    // 30,000 empty tags x 100,000 items must stop at the budget instead of running 3e9 lookups.
    fails(
      () => render(`{{#a}}${tags(30_000)}{{/a}}`, { a: [...items.a, 0] }, { missing: 'empty' }),
      message,
    );

    assert.ok(Date.now() - started < 5_000);
  });
});

describe('AI JSON input', () => {
  it('parses JSON and keeps prototype keys as own data', () => {
    assert.deepEqual(parseAiJson('{"a":[1,{"b":null}]}', 'Variables', limits), {
      a: [1, { b: null }],
    });

    assert.equal(
      Object.hasOwn(parseAiJson('{"__proto__":1}', 'Variables', limits) as object, '__proto__'),
      true,
    );
  });

  it('reports positioned syntax errors, else names the input', () => {
    fails(
      () => parseAiJson('{"a":}', 'Variables', limits),
      'Variables: Invalid JSON at line 1, column 6 (offset 5): Expected an object, array, string, number, true, false or null.',
    );

    fails(() => parseAiJson('', 'Variables', limits), 'Variables is not valid JSON.');

    failsWith(
      () => parseAiJson('{"id":1234567890123456789}', 'Variables', limits),
      'Variables: Quote integers',
    );

    failsWith(() => parseAiJson('{"id":1e400}', 'Variables', limits), 'beyond the range');
    failsWith(() => parseAiText('{"id":1e400}', 'Variables', limits), 'beyond the range');

    assert.equal(
      renderTemplate(
        '{{id}}{{#id}}+{{/id}}{{id.text}}',
        parseAiText('{"id":12345678901234567890}', 'Variables', limits),
        { escape: 'none', missing: 'empty' },
      ).output,
      '12345678901234567890+',
    );
  });

  it('limits characters, depth and values', () => {
    const text = (length: number) => `"${'a'.repeat(length - 2)}"`;
    const deep = (depth: number) => `${'['.repeat(depth)}${']'.repeat(depth)}`;

    assert.equal((parseAiJson(text(1_000_000), 'Variables', limits) as string).length, 999_998);
    failsWith(() => parseAiJson(text(1_000_001), 'Variables', limits), '1,000,000 characters');
    assert.ok(parseAiJson(deep(64), 'Variables', limits));

    fails(
      () => parseAiJson(deep(65), 'Variables', limits),
      'Variables is nested deeper than 64 levels.',
    );

    assert.ok(parseAiJson('[1,2]', 'Schema', { ...limits, nodes: 3 }));
    failsWith(() => parseAiJson('[1,2,3]', 'Schema', { ...limits, nodes: 3 }), 'at most 3 values');
  });
});
