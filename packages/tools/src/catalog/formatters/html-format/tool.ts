import { ToolDefinition, ToolError } from '@devtoolora/core';
import { formatHtml } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const htmlFormatTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Format or minify HTML locally. Block elements are indented, and pre, textarea, script and style content is kept byte for byte.',
  fields: [
    {
      defaultValue: 'format',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Format', value: 'format' },
        { label: 'Minify', value: 'minify' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '2',
      id: 'indentation',
      label: 'Indentation',
      options: [
        { label: '2 spaces', value: '2' },
        { label: '4 spaces', value: '4' },
        { label: 'Tabs', value: 'tab' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'html-format',
  inputKind: 'text',
  keywords: ['html', 'formatter', 'minifier', 'beautify', 'pretty print', 'indent', 'compress'],
  name: 'HTML Formatter & Minifier',
  outputKind: 'text',
  relatedToolIds: ['xml-format', 'html-entities', 'markdown-to-html'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'format';
      const indentation = fields.indentation ?? '2';

      if (mode !== 'format' && mode !== 'minify') throw new ToolError('Choose Format or Minify.');
      if (indentation !== '2' && indentation !== '4' && indentation !== 'tab')
        throw new ToolError('Choose 2 spaces, 4 spaces or tabs.');

      const result = formatHtml(text, {
        indent: indentation === 'tab' ? 'tab' : (Number(indentation) as 2 | 4),
        mode,
      });
      const closed = `${result.autoClosed} unclosed ${result.autoClosed === 1 ? 'element' : 'elements'} closed`;

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: mode === 'minify' ? 'minified.html' : 'formatted.html',
          mimeType: 'text/html;charset=utf-8',
        },
        language: 'html',
        summary: `HTML ${mode === 'minify' ? 'minified' : 'formatted'} · ${closed}.`,
        text: result.text,
      };
    }),
  samples: [
    {
      fields: { mode: 'format' },
      label: 'Messy page',
      text: '<!DOCTYPE html><html><head><title>Demo</title></head><body><div><p>Hi <b>there</b></p><ul><li>One</li><li>Two</li></ul></div></body></html>',
    },
    {
      fields: { mode: 'format' },
      label: 'Script stays intact',
      text: '<div><script>if (a < b) { x("</div>"); }</script><p>After</p></div>',
    },
    {
      fields: { mode: 'format' },
      label: 'Preformatted text',
      text: '<section><pre>  keep\n    this spacing</pre><p>Normal text</p></section>',
    },
    {
      fields: { mode: 'format' },
      label: 'Unclosed elements',
      text: '<div><p>First<span>open span</div>',
    },
    {
      fields: { mode: 'minify' },
      label: 'Minify a list',
      text: '<ul>\n  <li> a </li>\n  <!-- remove me -->\n  <li>b</li>\n</ul>\n',
    },
    {
      fields: { mode: 'minify' },
      label: 'Conditional comment kept',
      text: '<head>\n  <!--[if IE]><link rel="stylesheet" href="ie.css"><![endif]-->\n  <!-- dropped -->\n</head>\n',
    },
  ],
  supportsSelection: true,
};
