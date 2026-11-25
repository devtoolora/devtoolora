import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { loremIpsumTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Lorem Ipsum tool', () => {
  it('provides complete samples, exact artifacts and a safe paragraph preview', async () => {
    assert.equal(contentOf(loremIpsumTool).documentation?.length, 2);

    for (const sample of loremIpsumTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 5);
      const result = await loremIpsumTool.run({ fields: sample.fields ?? {}, text: 'ignored' });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );

      assert.ok(!result.text.includes('repeatable bundled content'));
      if (sample.fields?.output === 'preview') {
        assert.equal(result.htmlPreview?.label, 'Lorem Ipsum preview');
        assert.equal(result.htmlPreview?.nodes.map((node) => node.text).join('\n\n'), result.text);
        assert.ok(result.htmlPreview?.nodes.every((node) => node.tag === 'p'));
      } else assert.equal(result.htmlPreview, undefined);
    }

    const html = await loremIpsumTool.run({
      fields: { output: 'html', sentences: '2', sentencesPerParagraph: '1', unit: 'paragraphs' },
      text: '',
    });

    assert.equal(html.artifact?.fileName, 'lorem-ipsum.html');
    assert.equal(html.text.match(/<p>/g)?.length, 2);
    assert.ok(!html.text.includes('<html'));
    const markdown = await loremIpsumTool.run({
      fields: { output: 'markdown', sentences: '6' },
      text: '',
    });
    const plain = await loremIpsumTool.run({
      fields: { output: 'text', sentences: '6' },
      text: '',
    });

    assert.equal(markdown.text, plain.text);
    assert.equal(markdown.artifact?.fileName, 'lorem-ipsum.md');
    assert.equal(plain.artifact?.fileName, 'lorem-ipsum.txt');
  });

  it('validates options and amounts and counts sentences by default', async () => {
    const sentences = await loremIpsumTool.run({ fields: { sentences: '3' }, text: '' });

    assert.equal(sentences.text.match(/\./g)?.length, 3);
    assert.ok(loremIpsumTool.autoRun);
    assert.ok(loremIpsumTool.resultActions?.includes('save'));
    const invalid: Record<string, string>[] = [
      { sentences: '' },
      { sentences: '1.5' },
      { sentences: '1e2' },
      { sentences: '-1' },
      { sentences: '101' },
      { sentences: '5001', unit: 'words' },
      { sentences: '51', unit: 'paragraphs' },
      { sentencesPerParagraph: '11' },
      { sentencesPerParagraph: '' },
      { startWithLorem: 'yes' },
      { unit: 'characters' },
      { output: 'script' },
    ];

    for (const fields of invalid)
      await assert.rejects(async () => loremIpsumTool.run({ fields, text: '' }));
    const hiddenOption = await loremIpsumTool.run({
      fields: { sentences: '5', sentencesPerParagraph: 'invalid', unit: 'words' },
      text: '',
    });

    assert.equal(hiddenOption.text, 'Lorem ipsum dolor sit amet,');
  });
});
