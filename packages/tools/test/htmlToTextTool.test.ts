import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { htmlToTextTool } from '../src/catalog/text';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

const decoded = (base64: string | undefined) =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('html to text tool', () => {
  it('declares its fields', () => {
    assert.equal(htmlToTextTool.id, 'html-to-text');
    assert.equal(htmlToTextTool.name, 'HTML to Plain Text');
    assert.equal(htmlToTextTool.category, 'Text');
    assert.equal(htmlToTextTool.inputKind, 'text');
    assert.equal(htmlToTextTool.outputKind, 'text');
    assert.equal(htmlToTextTool.supportsSelection, true);

    assert.deepEqual(htmlToTextTool.resultActions, [
      'replace',
      'insert',
      'copy',
      'scratch',
      'save',
    ]);

    assert.deepEqual(
      fieldsOf(htmlToTextTool)?.map(({ defaultValue, id, label, options, presentation, type }) => ({
        defaultValue,
        id,
        label,
        options,
        presentation,
        type,
      })),
      [
        {
          defaultValue: 'text',
          id: 'links',
          label: 'Links',
          options: [
            { label: 'Text only', value: 'text' },
            { label: 'Text and URL', value: 'inline' },
          ],
          presentation: 'segmented',
          type: 'select',
        },
      ],
    );

    assert.deepEqual(htmlToTextTool.relatedToolIds, [
      'html-format',
      'html-entities',
      'markdown-to-html',
    ]);

    assert.equal(contentOf(htmlToTextTool).faq?.length, 4);
    assert.ok((htmlToTextTool.samples?.length ?? 0) >= 6);
  });

  it('converts HTML and counts lines and links', async () => {
    const result = await htmlToTextTool.run({
      fields: {},
      text: '<p>a</p><p><a href="u">b</a></p>',
    });

    assert.equal(result.text, 'a\n\nb\n');
    assert.equal(result.summary, '3 lines · 1 link.');
    assert.equal(result.language, 'plaintext');
    assert.equal(result.artifact?.fileName, 'text.txt');
    assert.equal(decoded(result.artifact?.base64), result.text);

    const inline = await htmlToTextTool.run({
      fields: { links: 'inline' },
      text: '<a href="https://x.dev">docs</a><a href="https://y.dev">y</a>',
    });

    assert.equal(inline.text, 'docs (https://x.dev)y (https://y.dev)\n');
    assert.equal(inline.summary, '1 line · 2 links.');
  });

  it('rejects unknown options and deep input', () => {
    assert.throws(() => htmlToTextTool.run({ fields: { links: '__proto__' }, text: '<p>a</p>' }), {
      message: 'Choose Text only or Text and URL.',
      name: 'ToolError',
    });

    assert.throws(() => htmlToTextTool.run({ fields: {}, text: '<div>'.repeat(101) }), {
      message: 'HTML conversion supports up to 100 nesting levels.',
    });
  });
});
