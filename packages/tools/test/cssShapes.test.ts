import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cssDesignTools } from '../src/catalog/cssDesign';
import { contentOf } from './toolContent';

describe('CSS shape tools', () => {
  it('provides complete samples, two guides and exact CSS/audit exports', async () => {
    for (const id of [
      'css-border-radius-generator',
      'css-triangle-generator',
      'css-clip-path-generator',
    ]) {
      const tool = cssDesignTools.find((candidate) => candidate.id === id)!;

      assert.equal(contentOf(tool).documentation?.length, 2);
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
        assert.equal(audit.fields.previewImage, undefined);
      }
    }
  });

  it('rejects empty active values, unknown directions and malformed polygon data', async () => {
    const radius = cssDesignTools.find((tool) => tool.id === 'css-border-radius-generator')!;

    for (const value of ['', '1.5', '201'])
      await assert.rejects(async () => radius.run({ fields: { topLeft: value }, text: '' }));

    assert.match(
      (
        await radius.run({
          fields: {
            bottomLeft: '4',
            bottomRight: '3',
            linked: 'true',
            topLeft: '1',
            topRight: '2',
          },
          text: '',
        })
      ).text,
      /1px 2px 3px 4px/,
    );

    const triangle = cssDesignTools.find((tool) => tool.id === 'css-triangle-generator')!;

    await assert.rejects(async () => triangle.run({ fields: { color: '' }, text: '' }));
    await assert.rejects(async () => triangle.run({ fields: { direction: 'bad' }, text: '' }));
    const clip = cssDesignTools.find((tool) => tool.id === 'css-clip-path-generator')!;

    await assert.rejects(async () => clip.run({ fields: { points: '[]' }, text: '' }));
    assert.ok((await clip.run({ fields: {}, text: '' })).artifact);
  });
});
