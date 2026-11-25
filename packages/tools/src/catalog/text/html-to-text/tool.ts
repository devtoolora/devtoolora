import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { htmlToText } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const linkModes = ['text', 'inline'] as const;

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

export const htmlToTextTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Turn HTML into readable plain text locally: paragraphs, lists and tables keep their shape, while scripts, styles and tags disappear.',
  fields: [
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
  id: 'html-to-text',
  inputKind: 'text',
  keywords: ['html', 'plain text', 'strip tags', 'remove html', 'html to text', 'extract text'],
  name: 'HTML to Plain Text',
  outputKind: 'text',
  relatedToolIds: ['html-format', 'html-entities', 'markdown-to-html'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const result = htmlToText(text, {
        links: choiceField(fields.links, 'text', linkModes, 'Choose Text only or Text and URL.'),
      });
      const lines = result.text.split('\n').length - 1;

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: 'text.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: `${plural(lines, 'line')} · ${plural(result.links, 'link')}.`,
        text: result.text,
      };
    }),
  samples: [
    {
      fields: {},
      label: 'Article',
      text: '<h1>Release notes</h1>\n<p>Version <b>2.0</b> is out.</p>\n<p>Read the <a href="https://example.com/changelog">changelog</a> for details.</p>',
    },
    {
      fields: { links: 'inline' },
      label: 'Links with URLs',
      text: '<p>See the <a href="https://example.com/docs">docs</a> or jump to the <a href="#faq">FAQ</a>.</p>',
    },
    {
      fields: {},
      label: 'Nested lists',
      text: '<ul><li>Fruit<ul><li>Apple</li><li>Pear</li></ul></li><li>Bread</li></ul>\n<ol start="3"><li>Third</li><li>Fourth</li></ol>',
    },
    {
      fields: {},
      label: 'Table',
      text: '<table>\n  <tr><th>Name</th><th>Role</th></tr>\n  <tr><td>Ada</td><td>Engineer</td></tr>\n</table>',
    },
    {
      fields: {},
      label: 'Full page',
      text: '<!DOCTYPE html><html><head><title>Demo</title><style>p { color: red; }</style></head><body><script>track();</script><p>Only this text stays.</p></body></html>',
    },
    {
      fields: {},
      label: 'Preformatted code',
      text: '<p>Run:</p><pre>\nnpm install\nnpm run build &amp;&amp; npm test</pre>',
    },
  ],
  supportsSelection: true,
};
