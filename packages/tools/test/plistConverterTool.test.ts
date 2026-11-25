import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { plistConverterTool } from '../src/catalog/formatters/plist-converter/tool';
import { contentOf } from './toolContent';

describe('plist converter tool', () => {
  it('converts a plist to JSON', async () => {
    const result = await plistConverterTool.run({
      fields: {},
      text: '<plist version="1.0"><dict><key>a</key><integer>1</integer></dict></plist>',
    });

    assert.equal(result.text, '{\n  "a": 1\n}');
    assert.equal(result.summary, 'Converted plist to JSON.');
    assert.equal(contentOf(plistConverterTool).faq?.length, 5);
  });

  it('converts JSON to a plist', async () => {
    const result = await plistConverterTool.run({
      fields: { mode: 'json-to-plist' },
      text: '{"a":[1.5]}',
    });

    assert.match(result.text ?? '', /<key>a<\/key>\n {2}<array>\n {4}<real>1\.5<\/real>/);
    assert.equal(result.summary, 'Converted JSON to plist.');
  });

  it('reports errors and has enough samples', () => {
    assert.throws(() => plistConverterTool.run({ fields: {}, text: 'bplist00' }), {
      message: /Binary plists are not supported/,
    });

    assert.throws(() => plistConverterTool.run({ fields: { mode: 'x' }, text: '{}' }), {
      message: /Choose/,
    });

    assert.ok((plistConverterTool.samples?.length ?? 0) >= 6);
  });

  it('converts every sample', async () => {
    for (const sample of plistConverterTool.samples ?? [])
      assert.ok(
        (await plistConverterTool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' }))
          .text,
      );
  });
});
