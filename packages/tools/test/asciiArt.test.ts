import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { asciiTextGeneratorTool, generateAsciiText } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('ASCII banner tool', () => {
  it('exports the exact UTF-8 banner with dimensions and no footer', async () => {
    const result = await asciiTextGeneratorTool.run({
      fields: { font: ' standard ', horizontalLayout: 'full' },
      text: 'Hi',
    });

    assert.equal(result.artifact?.fileName, 'ascii-art.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.equal(result.asciiArt?.rows, result.text.split('\n').length);

    assert.equal(
      result.asciiArt?.columns,
      Math.max(...result.text.split('\n').map((line) => Array.from(line).length)),
    );

    assert.equal(
      await generateAsciiText('Hi'),
      (await asciiTextGeneratorTool.run({ fields: {}, text: 'Hi' })).text,
    );

    await assert.rejects(
      async () =>
        asciiTextGeneratorTool.run({ fields: { horizontalLayout: 'invalid' }, text: 'Hi' }),
      /spacing/,
    );

    await assert.rejects(
      async () => asciiTextGeneratorTool.run({ fields: { normalization: 'silent' }, text: 'Hi' }),
      /Exact text/,
    );
  });

  it('provides complete, working samples, guides and explicit normalization', async () => {
    assert.equal(contentOf(asciiTextGeneratorTool).documentation?.length, 2);
    assert.ok((contentOf(asciiTextGeneratorTool).examples?.length ?? 0) >= 5);

    for (const sample of asciiTextGeneratorTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 4);
      const result = await asciiTextGeneratorTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text.trim());
      assert.ok(result.asciiArt);
    }
  });
});
