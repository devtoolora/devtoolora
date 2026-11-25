import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import {
  dotenvConverterTool,
  dotenvExampleTool,
} from '../src/catalog/configSecrets/dotenv-converter/tool';

const env = 'PORT=3000\nDEBUG=false\n';

describe('dotenv converter tool', () => {
  it('declares its identity, fields and six samples', () => {
    assert.equal(dotenvConverterTool.id, 'dotenv-converter');
    assert.equal(dotenvConverterTool.name, '.env ↔ JSON / YAML Converter');
    assert.equal(dotenvConverterTool.category, 'Config & Secrets');
    assert.equal(dotenvConverterTool.inputKind, 'text');
    assert.equal(dotenvConverterTool.outputKind, 'text');
    assert.equal(dotenvConverterTool.sensitiveInput, true);

    assert.deepEqual(
      dotenvConverterTool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['mode', 'env-to-json'],
        ['placeholder', ''],
        ['keepComments', 'true'],
      ],
    );

    assert.deepEqual(dotenvConverterTool.relatedToolIds, [
      'dotenv-formatter',
      'dotenv-validator',
      'json-to-yaml',
      'json-flatten',
    ]);

    assert.equal(dotenvConverterTool.samples?.length, 6);
  });

  it('runs every sample of both tools', async () => {
    for (const tool of [dotenvConverterTool, dotenvExampleTool])
      for (const sample of tool.samples ?? []) {
        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.ok(result.text, sample.label);
      }
  });

  it('converts in every mode with language, file name and summary', async () => {
    const json = await dotenvConverterTool.run({ fields: { mode: 'env-to-json' }, text: env });
    const yaml = await dotenvConverterTool.run({ fields: { mode: 'env-to-yaml' }, text: env });
    const back = await dotenvConverterTool.run({
      fields: { mode: 'json-to-env' },
      text: '{"A":1}',
    });
    const example = await dotenvConverterTool.run({ fields: { mode: 'example' }, text: env });

    assert.equal(json.summary, '2 variables · .env → JSON');
    assert.equal(json.language, 'json');
    assert.equal(json.artifact?.fileName, '.env.json');
    assert.equal(yaml.language, 'yaml');
    assert.equal(yaml.artifact?.fileName, '.env.yaml');
    assert.equal(back.text, 'A=1\n');
    assert.equal(back.summary, '1 variable · JSON → .env');
    assert.equal(back.language, 'plaintext');
    assert.equal(example.text, 'PORT=\nDEBUG=\n');
    assert.equal(example.artifact?.fileName, '.env.example');
  });

  it('reports invalid input as a ToolError', async () => {
    await assert.rejects(
      (async () => dotenvConverterTool.run({ fields: { mode: 'json-to-env' }, text: 'x' }))(),
      (error) => error instanceof ToolError && error.message === 'Input is not valid JSON.',
    );

    await assert.rejects(
      (async () => dotenvConverterTool.run({ fields: { mode: 'nope' }, text: env }))(),
      /Choose a conversion/,
    );
  });

  it('exposes the .env.example alias', () => {
    assert.equal(dotenvExampleTool.id, 'dotenv-example');
    assert.equal(dotenvExampleTool.name, '.env.example Generator');
    assert.equal(dotenvExampleTool.aliasOf, 'dotenv-converter');

    assert.equal(
      dotenvExampleTool.fields?.find((field) => field.id === 'mode')?.defaultValue,
      'example',
    );

    assert.ok(dotenvExampleTool.samples?.every((sample) => sample.fields?.mode === 'example'));
  });
});
