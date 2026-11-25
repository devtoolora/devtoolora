import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  browserFormatterTools as formatterTools,
  browserSchemaTypeTools as schemaTypeTools,
} from '@devtoolora/tools';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { ToolError } from '@devtoolora/core';
import { contentOf } from './toolContent';
import { result, run } from './tools.helpers';

describe('formatters', () => {
  it('provides SQL dialect options, complete documentation and runnable protected-text samples', async () => {
    const tool = listBrowserWorkerTools().find((entry) => entry.id === 'sql-format');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);
    assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
    assert.ok((contentOf(tool).examples?.length ?? 0) >= 3);
    assert.ok((contentOf(tool).notes?.length ?? 0) >= 3);

    assert.deepEqual(
      tool.fields?.map((field) => field.id),
      ['dialect', 'indentation', 'keywordCase'],
    );

    assert.ok(tool.resultActions?.includes('save'));

    for (const sample of tool.samples ?? []) {
      const formatted = await result(tool.id, sample.text, sample.fields);

      assert.equal(formatted.language, 'sql');
      assert.equal(formatted.artifact?.fileName, 'formatted.sql');

      assert.equal(
        Buffer.from(formatted.artifact?.base64 ?? '', 'base64').toString('utf8'),
        formatted.text,
      );

      assert.ok(formatted.text.includes('\n'));
      assert.match(formatted.summary ?? '', /not executed or validated/);
    }

    const formatted = await run(tool.id, "select 'from,  where' as note from users;", {
      dialect: 'postgresql',
      indentation: '4',
      keywordCase: 'lower',
    });

    assert.equal(formatted, "select\n    'from,  where' as note\nfrom\n    users;");
    const invalidOptions: Array<Record<string, string>> = [
      { dialect: 'unsupported' },
      { indentation: '3' },
      { keywordCase: 'title' },
    ];

    for (const fields of invalidOptions) {
      await assert.rejects(() => run(tool.id, 'select id from users;', fields), /Choose/);
    }

    await assert.rejects(() => run(tool.id, "select 'unterminated"), /Could not format SQL/);
  });

  it('formats, minifies, validates, and renders JSON trees', async () => {
    assert.equal(
      await run('json-format', '{"name":"Ada","items":[1,2]}'),
      '{\n  "name": "Ada",\n  "items": [\n    1,\n    2\n  ]\n}',
    );

    assert.equal(await run('json-minify', '{ "ok": true }'), '{"ok":true}');
    assert.match(await run('json-validate', '[1,2]'), /Valid JSON/);
    assert.match(await run('json-tree', '{"a":{"b":1}}'), /"b" \("\/a\/b"\): number: 1/);

    assert.match(
      await run('json-diff', '', { left: '{"a":1}', right: '{"a":2,"b":3}' }),
      /Changed "\/a"/,
    );

    assert.match(
      await run('sql-format', 'select id,name from users where active = 1 order by name'),
      /SELECT/,
    );
  });

  it('converts between JSON and YAML', async () => {
    assert.match(await run('json-to-yaml', '{"name":"Ada","items":[1,2]}'), /name: Ada/);

    assert.equal(
      await run('yaml-to-json', 'name: Ada\nage: 37'),
      '{\n  "name": "Ada",\n  "age": 37\n}',
    );
  });

  it('documents both YAML directions with runnable samples and exact UTF-8 save artifacts', async () => {
    const tool = formatterTools.find((entry) => entry.id === 'json-to-yaml');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);
    assert.match(contentOf(tool).documentation?.[0]?.title ?? '', /^What is/);
    assert.match(contentOf(tool).documentation?.[1]?.title ?? '', /^When to/);
    assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
    assert.ok((contentOf(tool).examples?.length ?? 0) >= 6);
    assert.ok((contentOf(tool).notes?.length ?? 0) >= 4);
    assert.deepEqual(tool.resultActions, ['copy', 'replace', 'insert', 'scratch', 'save']);

    assert.deepEqual(tool.textConversion, {
      decodedLabel: 'JSON',
      encodedLabel: 'YAML',
      runLabels: { decode: 'Convert to JSON', encode: 'Convert to YAML' },
    });

    const alias = formatterTools.find((entry) => entry.id === 'yaml-to-json');

    assert.equal(alias?.aliasOf, 'json-to-yaml');
    assert.equal(alias?.fields?.find((field) => field.id === 'mode')?.defaultValue, 'decode');

    assert.deepEqual(
      [...new Set(tool.samples?.map((sample) => sample.fields?.mode))],
      ['encode', 'decode'],
    );

    for (const sample of tool.samples ?? []) {
      assert.ok(sample.text);
      const toYaml = sample.fields?.mode === 'encode';
      const converted = await result('json-to-yaml', sample.text, sample.fields ?? {});

      assert.ok(converted.text);
      assert.equal(converted.language, toYaml ? 'yaml' : 'json');
      assert.equal(converted.artifact?.fileName, toYaml ? 'converted.yaml' : 'converted.json');

      assert.equal(
        converted.artifact?.mimeType,
        toYaml ? 'application/yaml;charset=utf-8' : 'application/json;charset=utf-8',
      );

      assert.equal(
        Buffer.from(converted.artifact?.base64 ?? '', 'base64').toString('utf8'),
        converted.text,
      );

      if (toYaml) {
        assert.deepEqual(
          JSON.parse(await run('yaml-to-json', converted.text)),
          JSON.parse(sample.text),
        );
      } else {
        const yaml = await run('json-to-yaml', converted.text);

        assert.deepEqual(JSON.parse(await run('yaml-to-json', yaml)), JSON.parse(converted.text));
      }
    }

    await assert.rejects(
      () => run('json-to-yaml', 'a: 1', { mode: 'sideways' }),
      /Choose JSON → YAML or YAML → JSON/,
    );
  });

  it('rejects invalid and lossy YAML conversions through the public tool contract', async () => {
    await assert.rejects(() => run('json-to-yaml', '{"missing":}'), /Invalid JSON/);

    assert.equal(
      await run('json-to-yaml', '{"id":9007199254740993,"price":1.00}'),
      'id: 9007199254740993\nprice: 1.00\n',
    );

    assert.equal(await run('json-to-yaml', '{"role":"user","role":"admin"}'), 'role: admin\n');

    for (const source of [
      'a: 1\na: 2',
      'value: [unterminated',
      'a: 1\n---\nb: 2',
      'value: !!timestamp 2026-10-10',
    ]) {
      await assert.rejects(() => run('yaml-to-json', source), /YAML|keys/);
    }

    await assert.rejects(() => run('yaml-to-json', 'id: 9007199254740993'), /Quote integers/);
    await assert.rejects(() => run('yaml-to-json', 'value: .inf'), /Infinity or NaN/);
    const converted = await run(
      'yaml-to-json',
      'users:\n  - name: Ada\n    roles: [admin]\n  - name: Grace\n    roles: []',
    );

    assert.deepEqual(JSON.parse(converted), {
      users: [
        { name: 'Ada', roles: ['admin'] },
        { name: 'Grace', roles: [] },
      ],
    });
  });

  it('formats XML without changing leaf text', async () => {
    assert.equal(
      await run('xml-format', '<root><child>ok</child></root>'),
      '<root>\n  <child>ok</child>\n</root>',
    );
  });

  it('documents each XML tool with runnable samples and exact UTF-8 save artifacts', async () => {
    for (const id of ['xml-format', 'json-to-xml']) {
      const tool = formatterTools.find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.match(contentOf(tool).documentation?.[0]?.title ?? '', /^What is/);
      assert.match(contentOf(tool).documentation?.[1]?.title ?? '', /^When to/);
      assert.match(contentOf(tool).help ?? '', /\n\n/);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 4);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 4);
      assert.deepEqual(tool.resultActions, ['copy', 'replace', 'insert', 'scratch', 'save']);

      for (const sample of tool.samples ?? []) {
        assert.ok(sample.text);
        const toJson = sample.fields?.mode === 'decode';
        const converted = await result(id, sample.text, sample.fields ?? {});

        assert.ok(converted.text);
        assert.equal(converted.language, toJson ? 'json' : 'xml');

        assert.equal(
          converted.artifact?.fileName,
          id === 'xml-format' ? 'formatted.xml' : toJson ? 'converted.json' : 'converted.xml',
        );

        assert.equal(
          Buffer.from(converted.artifact?.base64 ?? '', 'base64').toString('utf8'),
          converted.text,
        );

        if (toJson) {
          const xml = await run('json-to-xml', converted.text, { layout: 'compact' });

          assert.deepEqual(
            JSON.parse(await run('xml-to-json', xml, sample.fields ?? {})),
            JSON.parse(converted.text),
          );
        } else {
          assert.ok(JSON.parse(await run('xml-to-json', converted.text)));
        }
      }
    }
  });

  it('preserves XML repeats, attributes and mixed content through the public tool contract', async () => {
    const source = '<users><user id="001">Ada</user><user id="002">Grace</user></users>';

    assert.deepEqual(JSON.parse(await run('xml-to-json', source)), {
      users: {
        user: [
          { '@attributes': { id: '001' }, '#text': 'Ada' },
          { '@attributes': { id: '002' }, '#text': 'Grace' },
        ],
      },
    });

    const mixed = '<p>Hello <strong>world</strong>!</p>';

    assert.equal(await run('xml-format', mixed), mixed);

    assert.equal(
      await run('json-to-xml', await run('xml-to-json', mixed), { layout: 'compact' }),
      mixed,
    );

    const ordered = await run('xml-to-json', '<root><a>first</a><b>middle</b><a>last</a></root>', {
      mapping: 'ordered',
    });

    assert.equal(
      await run('json-to-xml', ordered, { layout: 'compact' }),
      '<root><a>first</a><b>middle</b><a>last</a></root>',
    );

    assert.equal(
      await run('xml-format', '<root><child/></root>', { indentation: '4' }),
      '<root>\n    <child/>\n</root>',
    );

    assert.match(
      await run('json-to-xml', '[{"name":"Ada"},{"name":"Grace"}]', {
        layout: 'pretty',
        root: 'users',
      }),
      /^<users>\n  <item>/,
    );

    await assert.rejects(() => run('xml-to-json', '<root/>', { mapping: 'guess' }), /Choose/);
    await assert.rejects(() => run('json-to-xml', '{}', { layout: 'guess' }), /Choose/);
    await assert.rejects(() => run('xml-format', '<root/>', { indentation: '3' }), /Choose/);
    await assert.rejects(() => run('xml-to-json', '<root><item/></wrong>'), /Invalid XML/);
    await assert.rejects(() => run('json-to-xml', '{"invalid name":1}'), /valid XML/);
    await assert.rejects(() => run('xml-format', '<!DOCTYPE root><root/>'), /DOCTYPE/);
  });

  it('documents CSV conversions and profiling with working samples and exact UTF-8 save artifacts', async () => {
    for (const id of ['json-to-csv', 'csv-profiler']) {
      const tool = [...formatterTools, ...schemaTypeTools].find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.match(contentOf(tool).documentation?.[0]?.title ?? '', /^What is/);
      assert.match(contentOf(tool).documentation?.[1]?.title ?? '', /^When to/);
      assert.match(contentOf(tool).help ?? '', /\n\n/);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 4);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 4);
      assert.deepEqual(tool.resultActions, ['copy', 'replace', 'insert', 'scratch', 'save']);

      for (const sample of tool.samples ?? []) {
        assert.ok(sample.text);
        const converted = await result(id, sample.text, sample.fields ?? {});

        assert.ok(converted.text);
        const toCsv = id === 'json-to-csv' && sample.fields?.mode === 'encode';
        const isTsv = toCsv && sample.fields?.delimiter === 'tab';
        const fileName = toCsv
          ? isTsv
            ? 'converted.tsv'
            : 'converted.csv'
          : id === 'json-to-csv'
            ? 'converted.json'
            : 'csv-profile.md';

        assert.equal(converted.artifact?.fileName, fileName);

        assert.equal(
          Buffer.from(converted.artifact?.base64 ?? '', 'base64').toString('utf8'),
          converted.text,
        );

        if (toCsv) {
          assert.equal(
            converted.artifact?.mimeType,
            isTsv
              ? 'text/tab-separated-values;charset=utf-8'
              : 'text/csv;charset=utf-8;header=present',
          );

          assert.equal(
            JSON.parse(
              await run('csv-to-json', converted.text, {
                delimiter: sample.fields?.delimiter ?? 'comma',
              }),
            ).length,
            JSON.parse(sample.text).length,
          );
        } else {
          assert.equal(
            converted.artifact?.mimeType,
            id === 'json-to-csv' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8',
          );
        }
      }
    }
  });

  it('keeps CSV contracts consistent for protected text, empty records, options and malformed input', async () => {
    const records = [
      { 'last,name': 'Příliš žluťoučký kůň 🐎.', note: 'He said "yes".\nSecond line.' },
      { 'last,name': '', note: '' },
    ];
    const csv = await run('json-to-csv', JSON.stringify(records));

    assert.deepEqual(JSON.parse(await run('csv-to-json', csv)), records);
    assert.match(await run('csv-profiler', csv), /Rows: 2\nColumns: 2/);
    assert.match(await run('csv-profiler', csv), /## last,name\nType: string\nMissing: 1/);

    for (const delimiter of ['comma', 'semicolon', 'tab']) {
      const converted = await run('json-to-csv', JSON.stringify(records), {
        delimiter,
        lineEnding: 'crlf',
      });

      assert.deepEqual(JSON.parse(await run('csv-to-json', converted, { delimiter })), records);
      assert.match(await run('csv-profiler', converted, { delimiter }), /Rows: 2/);
    }

    assert.deepEqual(JSON.parse(await run('csv-to-json', 'a,b\n,\n00123,9007199254740993')), [
      { a: '', b: '' },
      { a: '00123', b: '9007199254740993' },
    ]);

    assert.match(
      await run('csv-profiler', 'total\n9007199254740993\n9007199254740995'),
      /Min: 9007199254740993\nMax: 9007199254740995/,
    );

    for (const id of ['csv-to-json', 'csv-profiler']) {
      for (const source of [
        'a,a\n1,2',
        'a,b\n1',
        'a,b\n1,2,3',
        'a,b\n"unterminated,2',
        'a,b\n"ok"oops,2',
      ])
        await assert.rejects(() => run(id, source), ToolError);
      await assert.rejects(() => run(id, 'a\n1', { delimiter: 'guess' }), /Choose/);
      await assert.rejects(() => run(id, 'a\n1', { skipEmptyLines: 'yes' }), /true or false/);
    }

    await assert.rejects(() => run('json-to-csv', '[{"a":1}]', { lineEnding: 'guess' }), /Choose/);

    await assert.rejects(
      () => run('json-to-csv', '[{"a":1}]', { escapeFormulas: 'yes' }),
      /true or false/,
    );

    assert.equal(
      await run('json-to-csv', '[{"id":9007199254740993,"price":1.00}]'),
      'id,price\n9007199254740993,1.00',
    );

    assert.equal(await run('json-to-csv', '[{"id":1,"id":2}]'), 'id\n2');
    const empty = await result('json-to-csv', '[]');

    assert.equal(empty.text, '');

    assert.equal(
      empty.summary,
      'Converted an empty JSON array to an empty CSV file · no header row or records.',
    );

    assert.equal(
      JSON.parse(
        await run(
          'csv-to-json',
          await run('json-to-csv', '[{"note":"=1+1","amount":-5}]', { escapeFormulas: 'true' }),
        ),
      )[0].note,
      "'=1+1",
    );

    assert.equal(
      JSON.parse(await run('csv-to-json', 'note\nfirst\n\nlast', { skipEmptyLines: 'false' }))
        .length,
      3,
    );
  });

  it('converts JSON, XML, CSV, and TOML parity formats', async () => {
    assert.match(await run('json-to-xml', '{"person":{"name":"Ada"}}'), /<person>/);

    assert.equal(
      JSON.parse(await run('xml-to-json', '<person><name>Ada</name></person>')).person.name,
      'Ada',
    );

    assert.match(
      await run('json-to-csv', '[{"name":"Ada","role":"admin"}]'),
      /name,role\nAda,admin/,
    );

    assert.equal(JSON.parse(await run('csv-to-json', 'name,role\nAda,admin'))[0].role, 'admin');
    assert.match(await run('json-to-toml', '{"name":"demo","port":3000}'), /port = 3000/);
    assert.equal(JSON.parse(await run('toml-to-json', 'name = "demo"\nport = 3000')).port, 3000);
  });
});
