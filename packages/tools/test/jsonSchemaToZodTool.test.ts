import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { jsonSchemaToZodTool } from '../src/catalog/schemaTypes/json-schema-to-zod/tool';

describe('json-schema-to-zod tool', () => {
  it('declares its identity, fields and samples', () => {
    assert.equal(jsonSchemaToZodTool.id, 'json-schema-to-zod');
    assert.equal(jsonSchemaToZodTool.name, 'JSON Schema to Zod');
    assert.equal(jsonSchemaToZodTool.category, 'Schema & Types');
    assert.equal(jsonSchemaToZodTool.inputKind, 'text');
    assert.equal(jsonSchemaToZodTool.outputKind, 'text');

    assert.deepEqual(
      jsonSchemaToZodTool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['rootName', 'Root'],
        ['version', '4'],
        ['exportType', 'true'],
      ],
    );

    assert.deepEqual(jsonSchemaToZodTool.relatedToolIds, [
      'json-to-zod',
      'json-schema-to-typescript',
      'json-schema-validator',
    ]);

    assert.equal(jsonSchemaToZodTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    for (const sample of jsonSchemaToZodTool.samples ?? []) {
      const result = await jsonSchemaToZodTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text?.startsWith("import { z } from 'zod';"), sample.label);
      assert.equal(result.language, 'typescript');
    }
  });

  it('summarizes schemas, version and ignored keywords', async () => {
    const run = (text: string, fields: Record<string, string> = {}) =>
      jsonSchemaToZodTool.run({ fields, text });
    const one = await run('{"if":{},"type":"string"}', { version: '3' });
    const two = await run('{"$defs":{"A":true}}');

    assert.equal(one.summary, '1 schema · Zod 3 · 1 ignored keyword');
    assert.equal(two.summary, '2 schemas · Zod 4');
  });

  it('avoids exporting types that shadow TypeScript globals', async () => {
    const result = await jsonSchemaToZodTool.run({
      fields: {},
      text: '{"title":"Date","type":"object","properties":{"a":{"$ref":"#/$defs/Array"}},"$defs":{"Array":{"type":"string"}}}',
    });

    assert.match(result.text ?? '', /export const ArrayTypeSchema = z\.string\(\);/);
    assert.match(result.text ?? '', /export type ArrayType = z\.infer<typeof ArrayTypeSchema>;/);

    assert.match(
      result.text ?? '',
      /export const DateTypeSchema = z\.object\(\{\n  a: ArrayTypeSchema\.optional\(\),/,
    );

    assert.match(result.text ?? '', /export type DateType = z\.infer<typeof DateTypeSchema>;/);
    assert.doesNotMatch(result.text ?? '', /export type (Date|Array) /);
  });

  it('reports invalid schemas as tool errors', () => {
    assert.throws(
      () => jsonSchemaToZodTool.run({ fields: {}, text: '{"$ref":"#/$defs/missing"}' }),
      (error) =>
        error instanceof ToolError && error.message === '$ref "#/$defs/missing" does not resolve.',
    );
  });
});
