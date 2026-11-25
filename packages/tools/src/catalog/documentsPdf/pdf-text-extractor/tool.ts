import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { extractPdfText, pdfBaseName } from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { booleanField } from '../../../adapters/fields';
import {
  browserSafeCapabilities,
  encodeText,
  pageList,
  pdfFiles,
  pdfMaxBytes,
  reportPdf,
} from '../shared';

const sample = { pdfs: reportPdf };

async function extractText(fields: Record<string, string>): Promise<ToolResult> {
  const [file] = pdfFiles(fields, false);

  if (!file) throw new ToolError('PDF file is required.');

  const pageMarkers = booleanField(fields.pageMarkers, true);
  const result = await withToolErrorAsync(() =>
    extractPdfText(file, { pageMarkers, pages: fields.pages ?? '' }),
  );
  const name = pdfBaseName(file.name);
  const characters = result.pages.reduce((sum, page) => sum + page.text.length, 0);
  const selected = result.pages.map(({ page }) => page);
  const summary = [
    `${characters.toLocaleString('en-US')} ${characters === 1 ? 'character' : 'characters'} from ${pageList(selected, result.pageCount)}.`,
    ...(result.emptyPages
      ? [
          `No text layer on ${result.emptyPages} of ${selected.length} ${selected.length === 1 ? 'page' : 'pages'}; scanned pages need OCR, which this tool does not do.`,
        ]
      : []),
  ].join(' ');

  return {
    artifacts: [
      {
        base64: encodeText(result.text),
        fileName: `${name}.txt`,
        mimeType: 'text/plain;charset=utf-8',
      },
      {
        base64: encodeText(JSON.stringify({ pages: result.pages }, null, 2)),
        fileName: `${name}-text.json`,
        mimeType: 'application/json;charset=utf-8',
      },
    ],
    language: 'plaintext',
    summary,
    text: result.text,
  };
}

export const pdfTextExtractorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'Extract the text layer of a PDF as plain text with optional page markers, for all pages or a selection, locally.',
  fields: [
    {
      accept: 'application/pdf',
      id: 'pdfs',
      label: 'PDF file',
      maxBytes: pdfMaxBytes,
      required: true,
      type: 'file',
    },
    {
      help: 'Leave blank for all pages, or use ranges such as 1-3, 5, 8-, last, odd or even.',
      id: 'pages',
      label: 'Pages',
      placeholder: 'all, 2-, odd',
      type: 'text',
    },
    { defaultValue: 'true', id: 'pageMarkers', label: 'Page markers', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'pdf-text-extractor',
  inputKind: 'none',
  keywords: [
    'pdf to text',
    'extract text from pdf',
    'pdf text',
    'pdf to txt',
    'copy text from pdf',
    'pdf text layer',
  ],
  name: 'PDF Text Extractor',
  outputKind: 'text',
  relatedToolIds: ['pdf-toolkit', 'pdf-metadata-editor', 'docx-to-text'],
  resultActions: ['copy', 'save'],
  run: ({ fields }) => extractText(fields),
  samples: [
    { fields: { ...sample }, label: 'All pages with page markers' },
    { fields: { ...sample, pageMarkers: 'false' }, label: 'Plain text without markers' },
    { fields: { ...sample, pages: '1' }, label: 'First page only' },
    { fields: { ...sample, pages: 'last' }, label: 'Last page' },
    { fields: { ...sample, pages: 'odd' }, label: 'Odd pages' },
    { fields: { ...sample, pageMarkers: 'false', pages: '2-' }, label: 'From page 2 on' },
  ],
  supportsSelection: false,
};
