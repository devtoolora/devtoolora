import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  dataTools,
  browserFormatterTools as formatterTools,
  measurementTools,
  documentPdfTools,
} from '@devtoolora/tools';
import { ToolError } from '@devtoolora/core';
import { contentOf } from './toolContent';
import { result, run } from './tools.helpers';

describe('lossless JSON workspace', () => {
  it('converts real TOML with rich guides, complete samples, exact integers and artifacts', async () => {
    const tool = formatterTools.find((entry) => entry.id === 'json-to-toml');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);

    assert.equal(
      formatterTools.find((entry) => entry.id === 'toml-to-json')?.aliasOf,
      'json-to-toml',
    );

    assert.deepEqual(
      [...new Set(tool.samples?.map((sample) => sample.fields?.mode))],
      ['encode', 'decode'],
    );

    for (const sample of tool.samples ?? []) {
      const toToml = sample.fields?.mode === 'encode';

      assert.deepEqual(
        Object.keys(sample.fields ?? {}).sort(),
        toToml ? ['layout', 'mode'] : ['indentation', 'integers', 'mode'],
      );

      const output = await result('json-to-toml', sample.text, sample.fields);

      assert.equal(output.artifact?.fileName, toToml ? 'converted.toml' : 'converted.json');

      assert.equal(
        Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
        output.text,
      );
    }

    assert.match(await run('toml-to-json', 'id=9007199254740993'), /"id": 9007199254740993/);

    assert.match(
      await run('toml-to-json', 'id=9007199254740993', { integers: 'strings' }),
      /"id": "9007199254740993"/,
    );

    await assert.rejects(result('json-to-toml', '{"value":null}'), /no null value/);

    await assert.rejects(
      result('json-to-toml', '{}', { layout: 'unknown' }),
      /Choose Table sections/,
    );

    await assert.rejects(
      result('toml-to-json', '', { integers: 'unsafe' }),
      /Choose exact JSON numbers/,
    );
  });

  it('tabulates exact records with complete samples, safe Markdown and full artifacts', async () => {
    const tool = formatterTools.find((entry) => entry.id === 'json-table');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}), ['output']);
      const output = await result(tool.id, sample.text, sample.fields);

      assert.equal(output.artifact?.fileName, 'json-table.md');

      assert.equal(
        Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
        output.text,
      );
    }

    const table = await result(tool.id, '[{"id":9007199254740993},{"other":null}]');

    assert.deepEqual(table.jsonTable?.rows, [
      ['9007199254740993', null],
      [null, 'null'],
    ]);

    assert.equal((await result(tool.id, '[{}]', { output: 'markdown' })).jsonTable, undefined);

    await assert.rejects(
      result(tool.id, '[]', { output: 'csv' }),
      /Choose Table preview or Markdown/,
    );

    await assert.rejects(result(tool.id, '[{"id":1,"id":2}]'), /duplicate key/);
  });

  it('extracts exact JSON values and reports using complete samples and safe selectors', async () => {
    const tool = formatterTools.find((entry) => entry.id === 'json-query');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), ['path', 'report', 'syntax']);
      const output = await result(tool.id, sample.text, sample.fields);

      assert.equal(
        Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
        output.text,
      );
    }

    assert.equal(
      await run(tool.id, '{"id":9007199254740993}', { path: '/id', syntax: 'pointer' }),
      '9007199254740993',
    );

    const report = await result(tool.id, 'null', { path: '', report: 'json', syntax: 'pointer' });

    assert.deepEqual(JSON.parse(report.text), { pointer: '', type: 'null', valueJson: 'null' });
    assert.deepEqual(report.resultActions, ['copy', 'scratch', 'save']);
    await assert.rejects(() => run(tool.id, '{}', { path: '$.constructor' }), ToolError);
    await assert.rejects(() => run(tool.id, '{}', { syntax: 'bad' }), ToolError);
    await assert.rejects(() => run(tool.id, '{}', { report: 'bad' }), ToolError);
  });

  it('documents and exports precise JSON diffs with complete sample settings', async () => {
    const tool = formatterTools.find((entry) => entry.id === 'json-diff');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), [
        'left',
        'numbers',
        'report',
        'right',
      ]);

      const output = await result(tool.id, '', sample.fields);

      assert.equal(
        Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
        output.text,
      );
    }

    const report = await result(tool.id, '', {
      left: '9007199254740992',
      report: 'json',
      right: '9007199254740993',
    });

    assert.equal(JSON.parse(report.text).changes[0].after, '9007199254740993');
    assert.equal(report.jsonDiff, undefined);
    assert.ok((await result(tool.id, '', { left: '[1]', right: '[2]' })).jsonDiff);
    await assert.rejects(() => run(tool.id, '', { left: '{"a":1,"a":2}', right: '{}' }), ToolError);

    await assert.rejects(
      () => run(tool.id, '', { left: '{}', numbers: 'bad', right: '{}' }),
      ToolError,
    );

    await assert.rejects(
      () => run(tool.id, '', { left: '{}', report: 'bad', right: '{}' }),
      ToolError,
    );
  });

  it('exports a full typed JSON tree with precise tokens, complete guides and a real text artifact', async () => {
    const tool = formatterTools.find((entry) => entry.id === 'json-tree');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);

    for (const sample of tool.samples ?? []) {
      const output = await result(tool.id, sample.text);

      assert.ok(output.jsonTree?.nodes.length);

      assert.equal(
        Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
        output.text,
      );

      assert.equal(output.artifact?.fileName, 'json-tree.txt');
    }

    const output = await result(tool.id, '{"id":9007199254740993,"id":1.00}');

    assert.deepEqual(
      output.jsonTree?.nodes.map((node) => node.token),
      ['{}', '9007199254740993', '1.00'],
    );

    assert.match(output.summary ?? '', /1 duplicate keys/);
    assert.deepEqual(tool.resultActions, ['copy', 'scratch', 'save']);
    await assert.rejects(() => run(tool.id, '[1,]'), ToolError);
  });

  it('unifies alias IDs, complete samples, lossless artifacts and explicit validation reports', async () => {
    for (const id of ['json-format', 'json-minify', 'json-validate']) {
      const tool = formatterTools.find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(tool.aliasOf, id === 'json-format' ? undefined : 'json-format');
      assert.equal(contentOf(tool).documentation?.length, 2);

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), [
          'indentation',
          'lineEnding',
          'mode',
        ]);

        const exported = await result(id, sample.text, sample.fields);

        assert.equal(
          Buffer.from(exported.artifact?.base64 ?? '', 'base64').toString('utf8'),
          exported.text,
        );
      }

      const invalidFields: Array<Record<string, string>> = [
        { mode: 'bad' },
        { indentation: '8' },
        { lineEnding: 'bad' },
      ];

      for (const fields of invalidFields)
        await assert.rejects(() => run(id, '{}', fields), ToolError);
    }

    assert.equal(
      await run('json-minify', '{ "a":9007199254740993,"a":1.00 }'),
      '{"a":9007199254740993,"a":1.00}',
    );

    assert.match(await run('json-validate', 'null'), /Valid JSON\nType: null/);
    const validation = await result('json-format', '{"a":1,"a":2}', { mode: 'validate' });

    assert.match(validation.text, /Duplicate keys: 1/);
    assert.deepEqual(validation.resultActions, ['copy', 'scratch', 'save']);
    assert.equal(validation.artifact?.fileName, 'json-validation.txt');
    await assert.rejects(() => run('json-format', '{\n"a":1,\n}'), /line 3, column 1/);
  });
});

describe('fake data generator', () => {
  it('documents complete samples, keeps the seeded user fixture and exports identical datasets in all three formats', async () => {
    const tool = dataTools.find((entry) => entry.id === 'fake-data-generator');
    const alias = dataTools.find((entry) => entry.id === 'seeded-fake-data');

    assert.ok(tool && alias);
    assert.equal(alias.aliasOf, 'fake-data-generator');
    assert.equal(tool.category, 'Data');
    assert.equal(contentOf(tool).documentation?.length, 3);
    assert.equal(tool.samples?.length, 6);
    assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
    assert.ok((contentOf(tool).examples?.length ?? 0) >= 6);
    assert.ok((contentOf(tool).notes?.length ?? 0) >= 7);
    assert.ok(tool.autoRun && tool.freshResults);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), [
        'count',
        'format',
        'seed',
        'view',
      ]);

      const exported = await result(tool.id, sample.text ?? '', sample.fields);

      assert.equal(
        Buffer.from(exported.artifact?.base64 ?? '', 'base64').toString('utf8'),
        exported.text,
      );

      assert.equal(Boolean(exported.jsonTable), sample.fields?.view === 'table');
    }

    const fields = { count: '5', seed: '42' };
    const json = JSON.parse(await run(tool.id, '', { ...fields, format: 'json' }));

    assert.deepEqual(json.map((user: { email: string }) => user.email).slice(0, 1), [
      'linus.lovelace.1@example.test',
    ]);

    assert.equal(
      await run('seeded-fake-data', '', { ...fields, format: 'json' }),
      JSON.stringify(json, null, 2),
    );

    const lines = await result(tool.id, '', { ...fields, format: 'ndjson' });

    assert.deepEqual(
      lines.text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
      json,
    );

    assert.equal(lines.artifact?.fileName, 'seeded-users.ndjson');
    const csv = await result(tool.id, '', { ...fields, format: 'csv' });

    assert.equal(
      csv.text,
      `id,name,email,active\r\n${json.map((user: { active: boolean; email: string; id: number; name: string }) => `${user.id},${user.name},${user.email},${user.active}`).join('\r\n')}\r\n`,
    );

    assert.equal(csv.artifact?.fileName, 'seeded-users.csv');
    const custom = await result(tool.id, 'id: sequence\nemail: email', {
      ...fields,
      format: 'csv',
      view: 'table',
    });

    assert.equal(custom.artifact?.fileName, 'fake-data.csv');
    assert.deepEqual(custom.jsonTable?.columns, ['id', 'email']);

    assert.deepEqual(custom.jsonTable?.rows[0], [
      '1',
      JSON.stringify(custom.text.split('\r\n')[1]!.split(',')[1]),
    ]);

    assert.match(custom.summary ?? '', /^5 records · 2 fields · seed 42\.$/);

    for (const invalid of [
      '',
      '-1',
      '1.5',
      'NaN',
      'Infinity',
      '0x10',
      '1e2',
      '999999999999999999',
    ]) {
      await assert.rejects(() => run(tool.id, '', { seed: invalid }), ToolError);
      await assert.rejects(() => run(tool.id, '', { count: invalid }), ToolError);
    }

    await assert.rejects(() => run(tool.id, '', { seed: '4294967296' }), ToolError);
    for (const count of ['0', '1001'])
      await assert.rejects(
        () => run(tool.id, '', { count }),
        /Count must be an integer from 1 through 1000/,
      );
    await assert.rejects(() => run(tool.id, '', { format: 'xml' }), ToolError);
    await assert.rejects(() => run(tool.id, '', { view: 'chart' }), ToolError);
    await assert.rejects(() => run(tool.id, 'bad: money'), /Line 1: unknown type "money"/);
  });
});

describe('measurement tools', () => {
  it('keeps stable IDs, complete guides and samples, and exact artifacts', async () => {
    assert.equal(
      dataTools.some((tool) => tool.id === 'unit-converter'),
      false,
    );

    for (const id of ['unit-converter', 'temperature-converter']) {
      const tool = measurementTools.find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(tool.category, 'Measurement');
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 7);

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).sort(),
          (tool.fields ?? []).map((field) => field.id).sort(),
        );

        const output = await result(id, '', sample.fields);

        assert.equal(
          Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
          output.text,
        );
      }

      for (const value of ['', '1,5', '0x10', '1e400'])
        await assert.rejects(() => run(id, '', { value }), ToolError);
      for (const decimals of ['-1', '1.5', '13', '', 'Infinity'])
        await assert.rejects(() => run(id, '', { decimals, value: '1' }), ToolError);
      await assert.rejects(() => run(id, '', { report: 'html', value: '1' }), ToolError);
    }

    assert.equal(
      await run('unit-converter', '', { from: 'B', to: 'kB', value: '1024' }),
      '1.024 kB',
    );

    await assert.rejects(
      () => run('unit-converter', '', { from: 'B', to: 'm', value: '1' }),
      ToolError,
    );

    await assert.rejects(
      () => run('temperature-converter', '', { unit: 'bad', value: '1' }),
      ToolError,
    );

    await assert.rejects(
      () => run('temperature-converter', '', { unit: 'k', value: '-1' }),
      ToolError,
    );

    assert.equal(
      await run('temperature-converter', '', { report: 'value', unit: 'c', value: '-40' }),
      '-40 °C\n-40 °F\n233.15 K',
    );

    const report = JSON.parse(
      await run('unit-converter', '', {
        decimals: '0',
        from: 'km',
        report: 'json',
        to: 'mi',
        value: '1',
      }),
    );

    assert.equal(report.formatted, '1 mi');
    assert.equal(report.value, 1000 / 1609.344);
  });
});

describe('Markdown PDF tool', () => {
  it('provides complete guides and samples, validated layouts and real PDF artifacts', async () => {
    const tool = documentPdfTools.find((entry) => entry.id === 'markdown-to-pdf');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);
    assert.ok((contentOf(tool).notes?.length ?? 0) >= 7);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), ['fontSize', 'pageSize', 'title']);
      const output = await result(tool.id, sample.text, sample.fields);

      assert.equal(output.artifact?.fileName, 'document.pdf');
      assert.equal(output.artifact?.mimeType, 'application/pdf');
      const pdf = await PDFDocument.load(Buffer.from(output.artifact?.base64 ?? '', 'base64'));

      assert.equal(pdf.getTitle(), sample.fields?.title);
      assert.ok(pdf.getPageCount() >= 1);
      assert.equal(pdf.getPage(0).getWidth(), sample.fields?.pageSize === 'a4' ? 595.28 : 612);
    }

    for (const fontSize of ['', '8', '17', '1.5', '0x10'])
      await assert.rejects(() => run(tool.id, 'Text', { fontSize }), ToolError);
    await assert.rejects(() => run(tool.id, 'Text', { pageSize: 'bad' }), ToolError);
    await assert.rejects(() => run(tool.id, '🙂'), ToolError);
    assert.ok((await result(tool.id, '# Old fields remain valid', { title: 'Legacy' })).artifact);
  });
});
