import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { iniConverterTool } from '../src/catalog/formatters/ini-converter/tool';
import { contentOf } from './toolContent';

describe('ini converter tool', () => {
  it('converts INI to JSON with a summary', async () => {
    const result = await iniConverterTool.run({
      fields: {},
      text: 'top=1\n[db]\nhost=x\n[db.replica]\nport=5432',
    });

    assert.deepEqual(JSON.parse(result.text ?? ''), {
      db: { host: 'x', replica: { port: '5432' } },
      top: '1',
    });

    assert.equal(result.summary, 'Converted to JSON · 2 sections · 3 keys.');
    assert.equal(contentOf(iniConverterTool).faq?.length, 5);
  });

  it('types values only when asked', async () => {
    const result = await iniConverterTool.run({
      fields: { typed: 'true' },
      text: 'a=0012\nb=12\nc=true\nd=1e5',
    });

    assert.deepEqual(JSON.parse(result.text ?? ''), { a: '0012', b: 12, c: true, d: '1e5' });
  });

  it('converts JSON to INI', async () => {
    const result = await iniConverterTool.run({
      fields: { mode: 'json-to-ini' },
      text: '{"a":1,"s":{"k":"v"}}',
    });

    assert.equal(result.text, 'a=1\n\n[s]\nk=v\n');
    assert.equal(result.summary, 'Converted to INI · 1 section.');
  });

  it('reports errors and has enough samples', () => {
    assert.throws(() => iniConverterTool.run({ fields: {}, text: '[open' }), {
      message: /line 1/,
    });

    assert.throws(() => iniConverterTool.run({ fields: { mode: 'x' }, text: 'a=1' }), {
      message: /Choose/,
    });

    assert.ok((iniConverterTool.samples?.length ?? 0) >= 6);
  });
});
