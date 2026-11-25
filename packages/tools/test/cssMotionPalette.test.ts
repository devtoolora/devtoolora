import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cssDesignTools } from '../src/catalog/cssDesign';
import { contentOf } from './toolContent';

describe('motion and palette adapters', () => {
  it('has complete examples, guides and matching downloadable artifacts', async () => {
    for (const id of ['css-keyframes-generator', 'color-palette']) {
      const tool = cssDesignTools.find((candidate) => candidate.id === id)!;

      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.ok((tool.samples?.length ?? 0) >= 7);

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).sort(),
          tool.fields?.map((field) => field.id).sort(),
        );

        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );

        assert.equal(result.artifacts?.length, 1);
      }
    }
  });

  it('rejects active invalid values instead of clamping or falling back', async () => {
    const animation = cssDesignTools.find((tool) => tool.id === 'css-keyframes-generator')!;

    for (const fields of [
      { name: '' },
      { distance: '201' },
      { duration: '100.5' },
      { delay: '' },
      { preset: 'bad' },
    ] as Array<Record<string, string>>)
      await assert.rejects(async () => animation.run({ fields, text: '' }));
    const palette = cssDesignTools.find((tool) => tool.id === 'color-palette')!;

    await assert.rejects(async () => palette.run({ fields: {}, text: '' }));
    await assert.rejects(async () => palette.run({ fields: { scheme: 'bad' }, text: '#fff' }));
    const result = await palette.run({ fields: {}, text: '#2563eb' });

    assert.equal(JSON.parse(result.text).palette.base.shades[500], '#2563eb');

    assert.match(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
      /--base-500: #2563eb;/,
    );
  });
});
