import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '@devtoolora/functions/errors';
import { formatXml, jsonDocumentToXml, xmlToJson } from '@devtoolora/functions/format';
import type { JsonValue } from '@devtoolora/functions/format';

const toXml = (value: JsonValue, root?: string): string =>
  jsonDocumentToXml(JSON.stringify(value), root);

function hasCode(code: string): (error: unknown) => boolean {
  return (error: unknown): boolean => error instanceof FunctionError && error.code === code;
}

describe('XML tools', () => {
  it('indents structural XML with stable options without splitting leaf text', () => {
    const source =
      '<root><item/><item note="a > b">  A &amp; B 🐎.  </item><group><child>value</child></group></root>';
    const formatted = formatXml(source);

    assert.equal(
      formatted,
      '<root>\n  <item/>\n  <item note="a > b">  A &amp; B 🐎.  </item>\n  <group>\n    <child>value</child>\n  </group>\n</root>',
    );

    assert.equal(formatXml(formatted), formatted);
    assert.match(formatXml(source, { indentation: 4 }), /\n    <group>\n        <child>/);
    assert.match(formatXml(source, { indentation: 'tab' }), /\n\t<group>\n\t\t<child>/);
  });

  it('preserves mixed text, CDATA, lexical entities and protected whitespace exactly', () => {
    const protectedNodes = [
      '<p>Hello <strong>world</strong>!</p>',
      '<p>left<b/> <i/>right</p>',
      '<script><![CDATA[a < b && x > y;\r\n  keep this.]]></script>',
      '<code xml:space="preserve">  first\n  <span>second</span>  \n</code>',
      '<leaf> \n\t </leaf>',
      '<leaf>&#32;<a/></leaf>',
      '<leaf>one&#13;two\r\n  three</leaf>',
    ];

    for (const node of protectedNodes) {
      assert.equal(formatXml(node), node);
      assert.ok(formatXml(`<root>${node}<item/></root>`).includes(node));
    }

    const source =
      '<?xml version="1.0" encoding="UTF-8"?><root a=\'a > b\'><!-- < and > --><?status ready?><leaf>&amp;lt; &#x1F40E;</leaf></root>';
    const formatted = formatXml(source);

    for (const literal of [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<root a='a > b'>",
      '<!-- < and > -->',
      '<?status ready?>',
      '<leaf>&amp;lt; &#x1F40E;</leaf>',
    ])
      assert.ok(formatted.includes(literal));
    assert.equal(formatXml(formatted), formatted);
  });

  it('keeps all repeated siblings, attributes, empty elements and string values', () => {
    const source =
      '<users><user id="001"><name>Ada</name><active>true</active><role>admin</role><role>editor</role></user><user id="002"><name>Grace</name><code>00123</code><empty/></user></users>';

    assert.deepEqual(xmlToJson(source), {
      users: {
        user: [
          { '@attributes': { id: '001' }, active: 'true', name: 'Ada', role: ['admin', 'editor'] },
          { '@attributes': { id: '002' }, code: '00123', empty: '', name: 'Grace' },
        ],
      },
    });

    assert.deepEqual(xmlToJson('<root><root><root>deep</root></root></root>'), {
      root: { root: { root: 'deep' } },
    });

    assert.deepEqual(xmlToJson('<root id="1"/>'), {
      root: { '@attributes': { id: '1' }, '#text': '' },
    });
  });

  it('represents mixed content, comments and CDATA as ordered nodes in compact data', () => {
    const source =
      '<p lang="cs">Hello <strong>world</strong>!<![CDATA[a < b]]><!--note--><?status ready?></p>';
    const expected: JsonValue = {
      p: {
        '@attributes': { lang: 'cs' },
        '#content': [
          'Hello ',
          { strong: 'world' },
          '!',
          { '#cdata': 'a < b' },
          { '#comment': 'note' },
          { '#instruction': { content: 'ready', name: 'status' } },
        ],
      },
    };

    assert.deepEqual(xmlToJson(source), expected);
    assert.deepEqual(xmlToJson(toXml(expected)), expected);
  });

  it('round-trips ordered documents including interleaved names, whitespace and prolog nodes', () => {
    const source =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><!--before--><?status ready?><root xmlns:x="urn:test" note="a &gt; b">\n<a>first</a><x:b>middle</x:b><a>last</a>  <![CDATA[č < 🐎]]></root><!--after-->';
    const ordered = xmlToJson(source, { preserveOrder: true });

    assert.deepEqual(xmlToJson(toXml(ordered), { preserveOrder: true }), ordered);
    const interleaved = xmlToJson('<root><a>first</a><b>middle</b><a>last</a></root>', {
      preserveOrder: true,
    });

    assert.deepEqual(interleaved, {
      '#document': [
        {
          root: {
            '#content': [
              { a: { '#content': ['first'] } },
              { b: { '#content': ['middle'] } },
              { a: { '#content': ['last'] } },
            ],
          },
        },
      ],
    });

    assert.equal(toXml(interleaved), '<root><a>first</a><b>middle</b><a>last</a></root>');
  });

  it('writes a single document root for arrays, scalars and multi-key objects', () => {
    assert.equal(
      toXml([{ name: 'Ada' }, { name: 'Grace' }], 'users'),
      '<users><item><name>Ada</name></item><item><name>Grace</name></item></users>',
    );

    assert.equal(toXml({ a: 1, b: true }, 'payload'), '<payload><a>1</a><b>true</b></payload>');

    assert.equal(
      toXml({ users: ['Ada', 'Grace'] }),
      '<users><item>Ada</item><item>Grace</item></users>',
    );

    assert.equal(
      toXml({ root: { user: ['Ada', 'Grace'], values: [[1, 2], [3]] } }),
      '<root><user>Ada</user><user>Grace</user><values><item>1</item><item>2</item></values><values><item>3</item></values></root>',
    );

    for (const value of [null, '', [], {}]) assert.equal(toXml(value), '<root/>');
  });

  it('escapes text and attributes without changing Unicode or normalized character references', () => {
    const value = {
      článek: {
        '@attributes': { note: 'a & < > " \n\t\r', 'xmlns:x': 'urn:test' },
        '#content': ["It's č 🐎 & < >.\r\n", { 'x:child': 'A\tB' }],
      },
    };
    const xml = toXml(value);

    assert.ok(xml.includes('&#10;&#9;&#13;'));
    assert.ok(xml.includes('&amp; &lt; &gt;'));
    assert.deepEqual(xmlToJson(xml), value);

    assert.deepEqual(xmlToJson('<root>&amp;lt; &#x1F40E; &apos; &quot;</root>'), {
      root: '&lt; 🐎 \' "',
    });
  });

  it('keeps prototype-looking element and attribute names as own properties', () => {
    const source =
      '<root __proto__="attr"><__proto__>text</__proto__><constructor>value</constructor></root>';
    const recovered = xmlToJson(source);

    assert.deepEqual(
      recovered,
      JSON.parse(
        '{"root":{"@attributes":{"__proto__":"attr"},"__proto__":"text","constructor":"value"}}',
      ),
    );

    assert.deepEqual(xmlToJson(toXml(recovered)), recovered);
    assert.equal(Object.hasOwn({}, 'polluted'), false);
  });

  it('reports malformed XML with source positions and blocks DTDs and unsupported encodings', () => {
    for (const source of [
      '<root><child></root>',
      '<a/><b/>',
      '<root a="1" a="2"/>',
      '<root>&unknown;</root>',
      '<root>&#0;</root>',
      '<root><![CDATA[unclosed</root>',
      '<root>\u0000</root>',
    ]) {
      for (const run of [formatXml, xmlToJson]) {
        assert.throws(
          () => run(source),
          (error: unknown) =>
            error instanceof FunctionError &&
            error.code === 'INVALID_XML' &&
            /line \d+, column \d+/.test(error.message),
        );
      }
    }

    assert.throws(() => formatXml(' \n '), hasCode('EMPTY_XML'));
    for (const source of [
      '<!DOCTYPE root><root/>',
      '<!DOCTYPE root SYSTEM "file:///etc/passwd"><root/>',
    ])
      assert.throws(() => xmlToJson(source), hasCode('UNSUPPORTED_XML_DTD'));

    assert.throws(
      () => xmlToJson('<?xml version="1.0" encoding="ISO-8859-1"?><root/>'),
      hasCode('UNSUPPORTED_XML_ENCODING'),
    );

    assert.throws(
      () => xmlToJson('<?xml version="1.1"?><root/>'),
      hasCode('UNSUPPORTED_XML_VERSION'),
    );
  });

  it('rejects invalid XML names, unsafe JSON numbers and ambiguous or injected mappings', () => {
    const invalidNames: JsonValue[] = [
      { 'invalid name': 'text' },
      { '1name': 'text' },
      { 'a x="1"': 'text' },
      { root: { '@attributes': { 'invalid name': 'text' } } },
    ];

    for (const value of invalidNames) {
      assert.throws(() => toXml(value), hasCode('INVALID_XML_NAME'));
    }

    const values: JsonValue[] = [
      { root: { '#content': [], child: 'ambiguous' } },
      { root: { '#text': 'ambiguous', child: 'value' } },
      { root: { '@attributes': { invalid: [] } } },
      { '#document': [] },
      { root: { '#content': [{ '#comment': 'first--><evil/><!--last' }] } },
      {
        root: {
          '#content': [{ '#instruction': { content: 'ready?><evil/><?status', name: 'status' } }],
        },
      },
    ];

    for (const value of values)
      assert.throws(
        () => toXml(value),
        (error: unknown) => error instanceof FunctionError,
      );
    const cdata = toXml({ root: { '#content': [{ '#cdata': 'a]]>b' }] } });

    assert.match(cdata, /\]\]\]\]><!\[CDATA\[>/);

    assert.deepEqual(xmlToJson(cdata), {
      root: { '#content': [{ '#cdata': 'a]]' }, { '#cdata': '>b' }] },
    });
  });

  it('converts JSON text with original number spelling and rejects duplicate keys instead of keeping the last one', () => {
    assert.equal(
      jsonDocumentToXml(
        '\ufeff{"r":{"@attributes":{"v":1.50},"price":1.00,"count":1e3,"id":9007199254740993,"zero":-0,"ok":true,"none":null}}',
      ),
      '<r v="1.50"><price>1.00</price><count>1e3</count><id>9007199254740993</id><zero>-0</zero><ok>true</ok><none/></r>',
    );

    assert.equal(
      jsonDocumentToXml('[1.0,"a"]', 'values'),
      '<values><item>1.0</item><item>a</item></values>',
    );

    assert.equal(
      jsonDocumentToXml('{"p":{"#content":["Hello ",{"strong":"world"},"!"]}}'),
      '<p>Hello <strong>world</strong>!</p>',
    );

    assert.equal(jsonDocumentToXml('{"user":{"id":"1","id":"2"}}'), '<user><id>2</id></user>');

    assert.throws(
      () => jsonDocumentToXml('{"p":{"#content":[1]}}'),
      hasCode('INVALID_XML_MAPPING'),
    );

    assert.throws(
      () => jsonDocumentToXml('{"r":{"#text":{"x":1}}}'),
      hasCode('INVALID_XML_MAPPING'),
    );

    assert.throws(() => jsonDocumentToXml('{"1":2}'), hasCode('INVALID_XML_NAME'));
  });

  it('enforces limits without truncation and processes larger repeated records', () => {
    assert.doesNotThrow(() => formatXml(`${'<a>'.repeat(100)}${'</a>'.repeat(100)}`));

    assert.throws(
      () => formatXml(`${'<a>'.repeat(101)}${'</a>'.repeat(101)}`),
      hasCode('XML_LIMIT'),
    );

    assert.throws(() => formatXml(`<a>${'x'.repeat(5_000_000)}</a>`), hasCode('XML_LIMIT'));
    const value = {
      users: {
        user: Array.from({ length: 1000 }, (_, index: number) => ({
          '@attributes': { id: String(index) },
          name: `č 🐎 ${index}`,
        })),
      },
    };
    const xml = toXml(value);

    assert.deepEqual(xmlToJson(xml), value);
    assert.equal(formatXml(formatXml(xml)), formatXml(xml));
  });
});
