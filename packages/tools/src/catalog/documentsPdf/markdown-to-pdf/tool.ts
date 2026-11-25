import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const markdownToPdfTool: ToolDefinition = {
  id: 'markdown-to-pdf',
  keywords: ['markdown', 'pdf', 'md to pdf', 'export', 'document'],
  name: 'Markdown to PDF',
  category: 'Documents & PDF',
  description:
    'Create a readable local PDF from a basic Markdown subset, with Latin diacritics, measured wrapping and page numbers.',
  samples: [
    {
      fields: { fontSize: '11', pageSize: 'letter', title: 'Release Notes' },
      label: 'Product release notes',
      text: '# Release v2.0\n\n## Highlights\n- Offline local processing\n- Cross-platform tools\n\n> Review before publishing.',
    },
    {
      fields: { fontSize: '12', pageSize: 'a4', title: 'Český přehled' },
      label: 'Czech diacritics',
      text: '# Český přehled\n\nPříliš žluťoučký kůň úpěl ďábelské ódy.\n\n## Úkoly\n- Ověřit příklady\n- Uložit výsledek\n\n> Všechno probíhá lokálně.',
    },
    {
      fields: { fontSize: '10', pageSize: 'a4', title: 'Code and checklist' },
      label: 'Fenced code and checklist',
      text: '# Checklist\n\n1. Read input\n2. Check output\n\n```js\nconst message = "Hello";\n    return message;\n```',
    },
    {
      fields: { fontSize: '11', pageSize: 'letter', title: 'Measured wrapping' },
      label: 'Long words and wide letters',
      text:
        '# Measured wrapping\n\n' +
        'Wide WWW letters and narrow iii letters need different widths. '.repeat(12) +
        '\n\n' +
        'long-token-'.repeat(24),
    },
    {
      fields: { fontSize: '13', pageSize: 'letter', title: 'Team meeting' },
      label: 'Meeting notes with nested lists',
      text: '# Team meeting · 2026-10-16\n\n## Attendees\n- Product\n- Engineering\n  - Web\n  - Desktop\n\n## Decisions\n1. Ship the offline mode\n2. Review the fonts next week\n\n> Action items are due on Friday.',
    },
    {
      fields: { fontSize: '11', pageSize: 'a4', title: 'Onboarding handbook' },
      label: 'Two-page handbook with page numbers',
      text:
        '# Onboarding handbook\n\n' +
        ['Accounts', 'Laptop setup', 'Code review', 'Releases', 'Support rotation', 'Time off']
          .map(
            (topic, index) =>
              `## ${index + 1}. ${topic}\n\n${'Read this section before your first week. Each step lists who to ask and where the shared notes live, so you can work through it at your own pace. '.repeat(4)}\n\n- Ask your buddy for access\n- Write down open questions\n`,
          )
          .join('\n'),
    },
  ],
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  resultActions: ['save'],
  fields: [
    {
      defaultValue: 'Document',
      help: 'PDF metadata; use # in Markdown for a visible title.',
      id: 'title',
      label: 'Document title',
      type: 'text',
    },
    {
      defaultValue: 'letter',
      id: 'pageSize',
      label: 'Page size',
      options: [
        { label: 'Letter', value: 'letter' },
        { label: 'A4', value: 'a4' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '11',
      help: 'Integer 9–16 points.',
      id: 'fontSize',
      label: 'Body font size',
      type: 'number',
    },
  ],
  relatedToolIds: ['pdf-page-numbers', 'pdf-toolkit', 'pdf-metadata-editor'],
  run: ({ text, fields }) => markdownToPdf(text, fields),
};

async function markdownToPdf(text: string, fields: Record<string, string>): Promise<ToolResult> {
  const pageSize = fields.pageSize ?? 'letter';

  if (pageSize !== 'a4' && pageSize !== 'letter')
    throw new ToolError('Choose A4 or Letter page size.');

  const size = fields.fontSize ?? '11';

  if (!/^\d{1,2}$/.test(size))
    throw new ToolError('Body font size must be an integer from 9 through 16.');

  return pdfResult(
    await withToolErrorAsync(() =>
      pdfFunctions.markdownToPdf(text, fields.title, { fontSize: Number(size), pageSize }),
    ),
    'document.pdf',
    `PDF generated · ${pageSize === 'a4' ? 'A4' : 'Letter'} · bundled Latin fonts · inspect the downloaded layout.`,
  );
}

function pdfResult(bytes: Uint8Array, fileName: string, summary: string): ToolResult {
  return {
    text: summary,
    summary,
    artifact: { base64: base64Encode(bytes), mimeType: 'application/pdf', fileName },
  };
}
