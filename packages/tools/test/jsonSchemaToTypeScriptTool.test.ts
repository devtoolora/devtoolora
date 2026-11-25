import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { jsonSchemaToTypeScriptTool } from '../src/catalog/schemaTypes/json-schema-to-typescript/tool';

describe('json-schema-to-typescript tool', () => {
  it('declares its identity, fields and samples', () => {
    assert.equal(jsonSchemaToTypeScriptTool.id, 'json-schema-to-typescript');
    assert.equal(jsonSchemaToTypeScriptTool.name, 'JSON Schema to TypeScript');
    assert.equal(jsonSchemaToTypeScriptTool.category, 'Schema & Types');
    assert.equal(jsonSchemaToTypeScriptTool.inputKind, 'text');
    assert.equal(jsonSchemaToTypeScriptTool.outputKind, 'text');

    assert.deepEqual(
      jsonSchemaToTypeScriptTool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['rootName', 'Root'],
        ['declaration', 'interface'],
        ['exported', 'true'],
        ['readonly', 'false'],
      ],
    );

    assert.deepEqual(jsonSchemaToTypeScriptTool.relatedToolIds, [
      'json-schema-generator',
      'json-schema-validator',
      'json-to-typescript',
    ]);

    assert.equal(jsonSchemaToTypeScriptTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    for (const sample of jsonSchemaToTypeScriptTool.samples ?? []) {
      const result = await jsonSchemaToTypeScriptTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.equal(result.language, 'typescript');
    }
  });

  it('summarizes declarations and ignored keywords', async () => {
    const run = (text: string, fields: Record<string, string> = {}) =>
      jsonSchemaToTypeScriptTool.run({ fields, text });
    const one = await run('{"type":"string"}');
    const two = await run('{"$defs":{"A":true},"if":{}}', { declaration: 'type' });
    const three = await run('{"if":{},"then":{},"else":{}}');

    assert.equal(one.summary, '1 declaration · interface');
    assert.equal(two.summary, '2 declarations · type · 1 ignored keyword');
    assert.equal(three.summary, '1 declaration · interface · 3 ignored keywords');
    assert.equal(one.text, 'export type Root = string;');

    const many = JSON.stringify({
      properties: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`p${i}`, { if: {} }])),
    });

    assert.equal((await run(many)).summary, '1 declaration · interface · 60 ignored keywords');
  });

  it('avoids shadowing TypeScript globals', async () => {
    const result = await jsonSchemaToTypeScriptTool.run({
      fields: { rootName: 'Record' },
      text: '{"type":"object","properties":{"a":{"type":"string"}}}',
    });

    assert.equal(result.text, 'export interface RecordType {\n  a?: string;\n}');
  });

  it('reports invalid schemas as tool errors', () => {
    assert.throws(
      () => jsonSchemaToTypeScriptTool.run({ fields: {}, text: '{"$ref":"#/$defs/missing"}' }),
      (error) =>
        error instanceof ToolError && error.message === '$ref "#/$defs/missing" does not resolve.',
    );
  });
});
