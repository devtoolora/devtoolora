import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { lineEndingConverterTool } from '../src/catalog/textLists';
import { contentOf } from './toolContent';

describe('line ending converter tool', () => {
  it('declares its fields', () => {
    assert.equal(lineEndingConverterTool.fields?.map((field) => field.id).join(','), 'ending,bom');
    assert.equal(lineEndingConverterTool.inputKind, 'optionalText');
  });

  it('exports the exact bytes of the mixed-endings sample', async () => {
    const sample = lineEndingConverterTool.samples?.find(
      (item) => item.label === 'Mixed endings to LF',
    );

    assert.ok(sample?.text);
    assert.ok(sample.text.includes('\r\n') && sample.text.includes('\r'));

    const result = await lineEndingConverterTool.run({
      fields: sample.fields ?? {},
      text: sample.text,
    });

    assert.equal(Buffer.from(result.artifact?.base64 ?? '', 'base64').toString(), 'a\nb\nc\n');
    assert.equal(result.artifact?.fileName, 'converted.txt');
    assert.match(result.summary ?? '', /mixed endings/);
  });

  it('converts and reports unchanged input', async () => {
    assert.equal(
      (await lineEndingConverterTool.run({ fields: { ending: 'crlf' }, text: 'a\nb' })).text,
      'a\r\nb',
    );

    const same = await lineEndingConverterTool.run({
      fields: { ending: 'keep' },
      text: 'a\nb',
    });

    assert.match(same.summary ?? '', /uniform endings · BOM absent · Unchanged$/);
  });

  it('reports the BOM state of the input', async () => {
    const added = await lineEndingConverterTool.run({
      fields: { bom: 'add', ending: 'keep' },
      text: 'a',
    });

    assert.ok(added.text.startsWith('\uFEFF'));
    assert.match(added.summary ?? '', /BOM absent/);

    const removed = await lineEndingConverterTool.run({
      fields: { bom: 'remove', ending: 'keep' },
      text: '\uFEFFa',
    });

    assert.equal(removed.text, 'a');
    assert.match(removed.summary ?? '', /BOM present/);
  });

  it('rejects invalid choices and oversized input', async () => {
    await assert.rejects(
      async () => lineEndingConverterTool.run({ fields: { ending: 'x' }, text: 'a' }),
      /Choose/,
    );

    await assert.rejects(
      async () => lineEndingConverterTool.run({ fields: {}, text: 'a'.repeat(1_000_001) }),
      /1,000,000/,
    );
  });

  it('documents textarea normalization', () => {
    assert.ok(
      contentOf(lineEndingConverterTool).notes?.some((note) => /textareas normalize/.test(note)),
    );
  });
});
