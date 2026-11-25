import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { base64Encode, utf8Bytes } from '@devtoolora/functions/binary';
import { docxToText, type DocxStats } from '@devtoolora/functions/office';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { fileBytesFromField } from '../../../adapters/files';
import { pdfBaseName } from '@devtoolora/functions/pdf';
import { browserSafeCapabilities } from '../shared';
import { sampleFile } from './sample';

const outputs = ['markdown', 'text'] as const;
const docxMaxBytes = 20 * 1024 * 1024;

type DocxOutput = (typeof outputs)[number];

const docxFields = (defaultOutput: DocxOutput): ToolField[] => [
  {
    accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    id: 'file',
    label: 'Document',
    maxBytes: docxMaxBytes,
    required: true,
    type: 'file',
  },
  {
    defaultValue: defaultOutput,
    id: 'output',
    label: 'Output',
    options: [
      { label: 'Plain text', value: 'text' },
      { label: 'Markdown', value: 'markdown' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
];

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

const skippedNames: Record<string, [string, string]> = {
  comments: ['comment', 'comments'],
  equations: ['equation', 'equations'],
  'footnote references': ['footnote reference', 'footnote references'],
  'headers and footers': ['header or footer', 'headers and footers'],
  images: ['image', 'images'],
  'text boxes': ['text box', 'text boxes'],
};

function summaryOf(stats: DocxStats): string {
  const counts = [
    plural(stats.paragraphs, 'paragraph'),
    plural(stats.headings, 'heading'),
    plural(stats.lists, 'list'),
    plural(stats.tables, 'table'),
  ].join(', ');
  const skipped = Object.entries(stats.skipped).map(([what, count]) => {
    const [one, many] = skippedNames[what] ?? [what, what];

    return `${count} ${count === 1 ? one : many}`;
  });

  return `${counts}${skipped.length ? `; ${skipped.join(', ')} skipped` : ''}.`;
}

function convertDocx(fields: Record<string, string>, defaultOutput: DocxOutput): ToolResult {
  const output = choiceField(
    fields.output,
    defaultOutput,
    outputs,
    'Output must be text or markdown.',
  );
  const file = fileBytesFromField(fields.file, 'Document');
  const { stats, text } = withToolError(() => docxToText(file.bytes, { output }));
  const name = pdfBaseName(fields.fileName ?? '');

  return {
    artifact: {
      base64: base64Encode(utf8Bytes(text)),
      fileName: `${name}.${output === 'markdown' ? 'md' : 'txt'}`,
      mimeType: output === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    },
    language: output === 'markdown' ? 'markdown' : 'plaintext',
    summary: summaryOf(stats),
    text,
  };
}

export const docxToTextTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'Convert a Word .docx document to plain text or Markdown with headings, lists, tables, links and tracked changes, locally.',
  fields: docxFields('text'),
  freshResults: true,
  id: 'docx-to-text',
  inputKind: 'none',
  keywords: [
    'docx to text',
    'docx to markdown',
    'word to markdown',
    'word to text',
    'extract text',
  ],
  name: 'DOCX to Text & Markdown',
  outputKind: 'text',
  relatedToolIds: ['xlsx-to-csv', 'markdown-to-pdf'],
  resultActions: ['copy', 'save'],
  run: ({ fields }) => convertDocx(fields, 'text'),
  samples: [
    { fields: { ...sampleFile, output: 'markdown' }, label: 'Sprint notes as Markdown' },
    { fields: { ...sampleFile, output: 'text' }, label: 'Sprint notes as plain text' },
    { fields: { ...sampleFile }, label: 'Sprint notes with the default output' },
    { fields: { ...sampleFile, output: 'markdown' }, label: 'Headings and links as Markdown' },
    { fields: { ...sampleFile, output: 'text' }, label: 'Table as tab-separated text' },
    { fields: { ...sampleFile, output: 'markdown' }, label: 'Lists and table as Markdown' },
  ],
  supportsSelection: false,
};

export const docxToMarkdownTool: ToolDefinition = {
  ...docxToTextTool,
  aliasOf: 'docx-to-text',
  description:
    'Convert a Word .docx document to Markdown with headings, lists, tables, links and tracked changes, locally.',
  fields: docxFields('markdown'),
  id: 'docx-to-markdown',
  name: 'DOCX to Markdown',
  run: ({ fields }) => convertDocx(fields, 'markdown'),
};
