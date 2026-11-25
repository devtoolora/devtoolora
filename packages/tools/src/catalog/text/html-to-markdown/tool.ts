import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { htmlToMarkdown } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

export const htmlToMarkdownTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Convert HTML to GitHub-flavored Markdown locally: headings, emphasis, links, images, lists, code blocks, quotes and tables, with other tags reduced to their text.',
  id: 'html-to-markdown',
  inputKind: 'text',
  keywords: ['html', 'markdown', 'html to markdown', 'convert html', 'gfm', 'turndown'],
  name: 'HTML to Markdown',
  outputKind: 'markdown',
  relatedToolIds: ['html-to-text', 'markdown-to-html', 'html-format'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() => {
      const result = htmlToMarkdown(text);
      const lines = result.markdown.split('\n').length - 1;
      const dropped = result.unsupported
        .map(({ count, name }) => `${name} (${count.toLocaleString('en-US')})`)
        .join(', ');

      return {
        artifact: {
          base64: encodeBase64Text(result.markdown),
          fileName: 'converted.md',
          mimeType: 'text/markdown;charset=utf-8',
        },
        language: 'markdown',
        summary: `${plural(lines, 'line')} of Markdown.${dropped ? ` Dropped tags with text kept: ${dropped}.` : ''}`,
        text: result.markdown,
      };
    }),
  samples: [
    {
      fields: {},
      label: 'Article',
      text: '<h1>Release notes</h1>\n<p>Version <strong>2.0</strong> is <em>out</em>. Read the <a href="https://example.com/changelog" title="Changelog">changelog</a>.</p>',
    },
    {
      fields: {},
      label: 'Nested lists',
      text: '<ul><li>Fruit<ul><li>Apple</li><li>Pear</li></ul></li><li>Bread</li></ul>\n<ol start="3"><li>Third</li><li>Fourth</li></ol>',
    },
    {
      fields: {},
      label: 'Code block',
      text: '<p>Install with <code>npm i</code>:</p>\n<pre><code class="language-sh">npm install\nnpm run build\n</code></pre>',
    },
    {
      fields: {},
      label: 'Table',
      text: '<table>\n  <tr><th>Name</th><th>Role</th></tr>\n  <tr><td>Ada</td><td>Engineer | Lead</td></tr>\n</table>',
    },
    {
      fields: {},
      label: 'Quote and image',
      text: '<blockquote><p>Simple is better.</p><p>Flat is better.</p></blockquote>\n<p><img src="logo.png" alt="Logo"></p>',
    },
    {
      fields: {},
      label: 'Dropped tags',
      text: '<p>Price: 2 * 3 <u>units</u></p><iframe src="https://example.com"></iframe><p>Line one<br>Line two</p>',
    },
  ],
  supportsSelection: true,
};
