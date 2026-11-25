import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { propertiesConverterTool } from '../src/catalog/formatters/properties-converter/tool';
import { contentOf } from './toolContent';

describe('properties converter tool', () => {
  it('converts properties to nested JSON with a summary', async () => {
    const result = await propertiesConverterTool.run({
      fields: {},
      text: 'db.host=x\ndb.port=5432\nname=demo',
    });

    assert.deepEqual(JSON.parse(result.text ?? ''), {
      db: { host: 'x', port: '5432' },
      name: 'demo',
    });

    assert.equal(result.summary, 'Converted to JSON · 3 keys.');
    assert.equal(contentOf(propertiesConverterTool).faq?.length, 5);
  });

  it('keeps dotted keys flat when nesting is off', async () => {
    const result = await propertiesConverterTool.run({
      fields: { nested: 'false' },
      text: 'a.b=1',
    });

    assert.deepEqual(JSON.parse(result.text ?? ''), { 'a.b': '1' });
  });

  it('converts properties to YAML', async () => {
    const result = await propertiesConverterTool.run({
      fields: { mode: 'properties-to-yaml' },
      text: 'a.b=1\nc=x',
    });

    assert.equal(result.text, 'a:\n  b: "1"\nc: x\n');
    assert.equal(result.summary, 'Converted to YAML · 2 keys.');
  });

  it('converts JSON and YAML to properties', async () => {
    const fromJson = await propertiesConverterTool.run({
      fields: { asciiOnly: 'true', mode: 'json-to-properties' },
      text: '{"a":{"b":1},"c":"é"}',
    });

    assert.equal(fromJson.text, 'a.b=1\nc=\\u00E9\n');
    assert.equal(fromJson.summary, 'Converted to properties · 2 keys.');

    const fromYaml = await propertiesConverterTool.run({
      fields: { mode: 'yaml-to-properties' },
      text: 'a:\n  b: true\n',
    });

    assert.equal(fromYaml.text, 'a.b=true\n');
    assert.equal(fromYaml.summary, 'Converted to properties · 1 key.');
  });

  it('reports errors and has enough samples', () => {
    assert.throws(() => propertiesConverterTool.run({ fields: {}, text: 'a=\\uZZZZ' }), {
      message: /line 1/,
    });

    assert.throws(() => propertiesConverterTool.run({ fields: { mode: 'x' }, text: 'a=1' }), {
      message: /Choose/,
    });

    assert.ok((propertiesConverterTool.samples?.length ?? 0) >= 6);
  });
});
