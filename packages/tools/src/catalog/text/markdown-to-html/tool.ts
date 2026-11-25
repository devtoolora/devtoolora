import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { renderMarkdownHtml } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

function escapeTitle(title: string): string {
  return title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const markdownToHtmlTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Convert Markdown into real HTML with a local visual preview, explicit syntax options and exact file export.',
  fields: [
    {
      defaultValue: 'preview',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Visual preview', value: 'preview' },
        { label: 'HTML source', value: 'html' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'extended',
      id: 'dialect',
      label: 'Syntax',
      options: [
        { label: 'Extended (tables, strikethrough)', value: 'extended' },
        { label: 'CommonMark', value: 'commonmark' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'false',
      help: 'Turn ordinary newlines inside paragraphs into br elements. Explicit Markdown hard breaks work in either mode.',
      id: 'breaks',
      label: 'Soft newlines as line breaks',
      type: 'checkbox',
    },
    {
      defaultValue: 'fragment',
      id: 'export',
      label: 'HTML export',
      options: [
        { label: 'HTML fragment', value: 'fragment' },
        { label: 'Standalone document', value: 'document' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'Markdown document',
      help: 'Escaped document title; up to 200 UTF-16 units. Only used for standalone export.',
      id: 'title',
      label: 'Document title',
      type: 'text',
      visibleWhen: { field: 'export', is: ['document'] },
    },
  ],
  id: 'markdown-to-html',
  inputKind: 'optionalText',
  keywords: ['markdown', 'html', 'commonmark', 'preview', 'table', 'document'],
  name: 'Markdown to HTML',
  outputKind: 'text',
  relatedToolIds: ['markdown-helper', 'markdown-to-pdf', 'html-entities'],
  requiresInput: false,
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = fields.output ?? 'html';
      const dialect = fields.dialect ?? 'extended';
      const breaks = fields.breaks ?? 'false';
      const format = fields.export ?? 'fragment';

      if (output !== 'html' && output !== 'preview')
        throw new ToolError('Choose Visual preview or HTML source.');
      if (dialect !== 'extended' && dialect !== 'commonmark')
        throw new ToolError('Choose CommonMark or Extended Markdown.');
      if (breaks !== 'true' && breaks !== 'false')
        throw new ToolError('Soft newline handling must be true or false.');
      if (format !== 'fragment' && format !== 'document')
        throw new ToolError('Choose an HTML fragment or standalone document.');

      const title = fields.title ?? 'Markdown document';

      if (format === 'document' && (title.length > 200 || /\u0000|[\uD800-\uDFFF]/u.test(title)))
        throw new ToolError(
          'Document title must be valid Unicode without NUL, up to 200 UTF-16 units.',
        );

      const result = renderMarkdownHtml(text, { breaks: breaks === 'true', dialect });
      const html =
        format === 'document'
          ? `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeTitle(title)}</title>\n</head>\n<body>\n${result.html}</body>\n</html>\n`
          : result.html;

      return {
        artifact: {
          base64: encodeBase64Text(html),
          fileName: 'markdown.html',
          mimeType: 'text/html;charset=utf-8',
        },
        htmlPreview: output === 'preview' ? { nodes: result.nodes } : undefined,
        language: 'html',
        summary: `${result.headings} headings · ${result.links} links · ${result.images} images · ${result.codeBlocks} code blocks · ${dialect} · ${format}.`,
        text: html,
      };
    }),
  samples: [
    {
      fields: {
        breaks: 'false',
        dialect: 'extended',
        export: 'fragment',
        output: 'preview',
        title: 'Markdown document',
      },
      label: 'Document structure',
      text: '# Release notes\n\nA **clear** update with *emphasis* and `inline code`.\n\n## Changes\n\n- Improved tools\n  - Local processing\n- Better examples\n\n> Review the output before publishing.\n\n```js\nconst ready = true;\n```',
    },
    {
      fields: {
        breaks: 'false',
        dialect: 'extended',
        export: 'fragment',
        output: 'preview',
        title: 'Markdown document',
      },
      label: 'Table and strikethrough',
      text: '| Tool | Status |\n| :--- | ---: |\n| Regex | Ready |\n| ~~Old parser~~ | Replaced |',
    },
    {
      fields: {
        breaks: 'false',
        dialect: 'commonmark',
        export: 'fragment',
        output: 'preview',
        title: 'Markdown document',
      },
      label: 'References and image',
      text: 'Read [the guide][guide].\n\n![Diagram](https://example.test/diagram.png "Example")\n\n[guide]: https://example.test/docs',
    },
    {
      fields: {
        breaks: 'true',
        dialect: 'commonmark',
        export: 'fragment',
        output: 'preview',
        title: 'Markdown document',
      },
      label: 'Soft and hard breaks',
      text: 'first line\nsecond line\n\nexplicit hard break  \nnext line',
    },
    {
      fields: {
        breaks: 'false',
        dialect: 'commonmark',
        export: 'document',
        output: 'html',
        title: 'Notes & examples',
      },
      label: 'Standalone HTML document',
      text: 'Document title\n==============\n\n3. Third item\n4. Fourth item\n\n---\n\n[Documentation](https://example.test)',
    },
    {
      fields: {
        breaks: 'false',
        dialect: 'extended',
        export: 'fragment',
        output: 'preview',
        title: 'Markdown document',
      },
      label: 'HTML remains text',
      text: '# Escaped HTML\n\n<script>alert("not executed")</script>\n\n<img src="https://example.test/pixel" onerror="alert(1)">\n\n[Unsafe](javascript:alert(1))\n\n```html\n<div>Code, not markup</div>\n```',
    },
    {
      fields: {
        breaks: 'false',
        dialect: 'extended',
        export: 'fragment',
        output: 'preview',
        title: 'Markdown document',
      },
      label: 'Empty Markdown',
      text: '',
    },
  ],
  supportsSelection: true,
};
