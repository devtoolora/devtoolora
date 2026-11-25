import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cssDesignTools } from '../src/catalog/cssDesign';
import { contentOf } from './toolContent';

describe('CSS layout tools', () => {
  it('documents the three visual tools and fully resets every sample', async () => {
    for (const id of ['css-grid-generator', 'css-flexbox-generator', 'css-box-shadow-generator']) {
      const tool = cssDesignTools.find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
      assert.ok((tool.samples?.length ?? 0) >= 6);
      assert.deepEqual(tool.resultActions, ['copy', 'scratch', 'save']);

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).sort(),
          tool.fields?.map((field) => field.id).sort(),
        );

        const result = await tool.run({ fields: sample.fields ?? {}, text: '' });

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );

        const audit = JSON.parse(
          Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
        );

        assert.equal(audit.css, result.text);
        assert.deepEqual(audit.fields, sample.fields);
      }
    }
  });

  it('rejects invalid active settings without clamping, fallback or partial export', async () => {
    const grid = cssDesignTools.find((tool) => tool.id === 'css-grid-generator')!;
    const invalidFields: Record<string, string>[] = [
      { columns: '' },
      { columns: '1.5' },
      { columns: '13' },
      { columns: '0x10' },
      { autoFlow: 'nonsense' },
    ];

    for (const fields of invalidFields)
      await assert.rejects(async () => grid.run({ fields, text: '' }));
    const flex = cssDesignTools.find((tool) => tool.id === 'css-flexbox-generator')!;

    assert.match(
      (
        await flex.run({
          fields: { direction: 'column-reverse', grow: '0.5', shrink: '0.25' },
          text: '',
        })
      ).text,
      /flex: 0.5 0.25 120px/,
    );

    const shadow = cssDesignTools.find((tool) => tool.id === 'css-box-shadow-generator')!;

    for (const layers of [
      '[]',
      '[null]',
      '[{"x":0,"y":0,"blur":0,"spread":0,"color":"#12345","inset":false}]',
      '[{"x":0,"y":0,"blur":-1,"spread":0,"color":"#000","inset":false}]',
    ])
      await assert.rejects(async () => shadow.run({ fields: { layers }, text: '' }));
    assert.ok((await shadow.run({ fields: {}, text: '' })).artifact);
  });
});
