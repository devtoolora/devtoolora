import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { processMarkdown } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { checkbox } from '../shared';

export const markdownHelperTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Clean raw HTML and surplus blank lines without rewriting code, and inspect parsed Markdown statistics.',
  fields: [
    {
      defaultValue: 'markdown',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Clean Markdown', value: 'markdown' },
        { label: 'JSON report', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: 'Remove complete raw HTML blocks, including their content, and inline HTML tags/comments. Code and autolinks remain.',
      id: 'stripHtml',
      label: 'Remove raw HTML',
      type: 'checkbox',
    },
    {
      defaultValue: 'true',
      help: 'Reduce excess blank lines outside code, lists, block quotes and retained HTML blocks. Hard-break spaces are not trimmed.',
      id: 'collapseWhitespace',
      label: 'Collapse excess blank lines',
      type: 'checkbox',
    },
  ],
  id: 'markdown-helper',
  inputKind: 'optionalText',
  keywords: ['markdown', 'commonmark', 'cleanup', 'html', 'headings', 'references'],
  name: 'Markdown Helper',
  outputKind: 'markdown',
  relatedToolIds: ['markdown-to-html', 'markdown-to-pdf', 'text-statistics', 'markdown-linter'],
  requiresInput: false,
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = fields.output ?? 'markdown';

      if (output !== 'markdown' && output !== 'report')
        throw new ToolError('Choose Clean Markdown or JSON report.');

      const result = processMarkdown(text, {
        collapseWhitespace: checkbox(fields, 'collapseWhitespace', 'Collapse excess blank lines'),
        stripHtml: checkbox(fields, 'stripHtml', 'Remove raw HTML'),
      });
      const report = output === 'report' ? JSON.stringify(result, null, 2) : result.text;

      return {
        artifact: {
          base64: encodeBase64Text(report),
          fileName: output === 'report' ? 'markdown-report.json' : 'cleaned.md',
          mimeType:
            output === 'report' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8',
        },
        language: output === 'report' ? 'json' : 'markdown',
        summary: `Headings: ${result.headings} · Links: ${result.links} · Images: ${result.images} · Code blocks: ${result.codeBlocks} · Prose words: ${result.words} · Removed HTML tokens/blocks: ${result.removedHtml}${result.text ? '' : ' · empty result'}.`,
        text: report,
      };
    }),
  samples: [
    {
      fields: { collapseWhitespace: 'true', output: 'markdown', stripHtml: 'true' },
      label: 'Markdown with HTML tags',
      text: '# Overview\n\nRead <b>this text</b>, not raw HTML.\n\n\n\n- Item 1\n- Item 2\n',
    },
    {
      fields: { collapseWhitespace: 'true', output: 'markdown', stripHtml: 'true' },
      label: 'Protect HTML code examples',
      text: '# Literal HTML\n\nUse `<span title="a > b">hello</span>`.\n\n```html\n<script>example()</script>\n\n\n<div>Keep blank lines</div>\n```\n',
    },
    {
      fields: { collapseWhitespace: 'true', output: 'report', stripHtml: 'true' },
      label: 'Headings and reference links',
      text: 'Title\n=====\n\n## Next section\n\n[Reference][docs] and <https://example.test>.\n\n![Image](./image.png)\n\n[docs]: https://example.test/docs\n\n```md\n# Not a heading\n[fake](./fake)\n```\n',
    },
    {
      fields: { collapseWhitespace: 'false', output: 'markdown', stripHtml: 'true' },
      label: 'Remove complete HTML blocks',
      text: '# Keep this\n\n<script>\nalert("Never executed");\n</script>\n\n<div>\nThis complete HTML block is removed.\n</div>\n\nOrdinary Markdown remains.\n',
    },
    {
      fields: { collapseWhitespace: 'true', output: 'markdown', stripHtml: 'false' },
      label: 'Retain raw HTML without rendering',
      text: 'Text with <em>HTML</em> retained.\n\n<div>\nRaw block\n\n\n</div>\n',
    },
    {
      fields: { collapseWhitespace: 'false', output: 'markdown', stripHtml: 'false' },
      label: 'Preserve hard breaks and indentation',
      text: '# Lines\n\nFirst line  \nSecond line\n\n    <b>indented code</b>\n\n- Loose item\n\n\n- Another item\n',
    },
    {
      fields: { collapseWhitespace: 'true', output: 'markdown', stripHtml: 'true' },
      label: 'Empty Markdown',
      text: '',
    },
  ],
  supportsSelection: true,
};
