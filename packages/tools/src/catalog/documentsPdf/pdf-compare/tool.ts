import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { fileBytesFromField, filesFromField } from '../../../adapters/files';
import { withToolErrorAsync } from '../../../adapters/errors';
import { booleanField } from '../../../adapters/fields';
import {
  comparePdfs,
  formatPageSelection,
  pdfBaseName,
  type PdfFile,
} from '@devtoolora/functions/pdf';
import { formatTextDiff } from '@devtoolora/functions/text';
import { browserSafeCapabilities, encodeText, pdfMaxBytes } from '../shared';
import { compare } from './sample';

function pdfFile(value: string | undefined, name: string | undefined, label: string): PdfFile {
  if (value?.startsWith('data:'))
    return { bytes: fileBytesFromField(value, label).bytes, name: name || label };

  const [file] = filesFromField(value, label);

  if (!file) throw new ToolError(`${label} is required.`);

  return { bytes: file.bytes, name: file.name };
}

export function summaryText(
  counts: Record<'added' | 'changed' | 'matched' | 'removed', number>,
  before: number[],
  after: number[],
): string {
  const [from, to] = [formatPageSelection(before), formatPageSelection(after)];

  if (!counts.added && !counts.changed && !counts.removed)
    return `No text differences in pages ${from === to ? from : `${from} vs ${to}`}.`;

  return `${counts.changed} changed · ${counts.added} added · ${counts.removed} removed · ${counts.matched} matched · pages ${from} vs ${to}.`;
}

function readableReport(
  comparison: Parameters<typeof formatTextDiff>[0],
  counts: Record<'added' | 'changed' | 'matched' | 'removed', number>,
): string {
  // Row-based counts (a changed line is one row) so the report agrees with the summary.
  return formatTextDiff(comparison, {
    endings: false,
    title: 'PDF Compare report',
  }).replace(
    /^Added: .*$/m,
    `Changed: ${counts.changed}; added: ${counts.added}; removed: ${counts.removed}; matched: ${counts.matched}`,
  );
}

async function run(fields: Record<string, string>): Promise<ToolResult> {
  const output = fields.output ?? 'split';

  if (output !== 'split' && output !== 'unified' && output !== 'json' && output !== 'text')
    throw new ToolError('Choose Side by side, Unified view, JSON report or Readable report.');

  const before = pdfFile(fields.beforePdf, fields.beforePdfName || 'before.pdf', 'Before PDF');
  const after = pdfFile(fields.afterPdf, fields.afterPdfName || 'after.pdf', 'After PDF');
  const comparison = await withToolErrorAsync(() =>
    comparePdfs(before, after, {
      ignoreCase: booleanField(fields.ignoreCase, false),
      ignoreWhitespace: booleanField(fields.ignoreWhitespace, true),
      pages: fields.pages ?? '',
    }),
  );
  const count = (kind: string): number => comparison.rows.filter((row) => row.kind === kind).length;
  const counts = {
    added: count('added'),
    changed: comparison.changed,
    matched: count('unchanged'),
    removed: count('removed'),
  };
  const report = JSON.stringify(
    {
      ...comparison,
      added: counts.added,
      removed: counts.removed,
      unchanged: counts.matched,
      after: { name: comparison.after.name, pageStarts: comparison.after.pageStarts },
      before: { name: comparison.before.name, pageStarts: comparison.before.pageStarts },
    },
    null,
    2,
  );
  const readable = readableReport(comparison, counts);
  const baseName = `${pdfBaseName(before.name)}-vs-${pdfBaseName(after.name)}`;
  const jsonArtifact = {
    base64: encodeText(report),
    fileName: `${baseName}.json`,
    mimeType: 'application/json;charset=utf-8',
  };
  const textArtifact = {
    base64: encodeText(readable),
    fileName: `${baseName}.txt`,
    mimeType: 'text/plain;charset=utf-8',
  };

  return {
    artifact: output === 'text' ? textArtifact : jsonArtifact,
    artifacts: [output === 'text' ? jsonArtifact : textArtifact],
    language: output === 'text' ? 'text' : 'json',
    summary: summaryText(counts, comparison.before.pages, comparison.after.pages),
    text: output === 'text' ? readable : report,
    textDiff:
      output === 'split' || output === 'unified'
        ? { layout: output, rows: comparison.rows, showLineEndings: false }
        : undefined,
  };
}

export const pdfCompareTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'Compare the text of two PDFs line by line, with changed, added and removed lines and the page each starts on, locally.',
  fields: [
    {
      accept: 'application/pdf',
      id: 'beforePdf',
      label: 'Before PDF',
      maxBytes: pdfMaxBytes,
      required: true,
      type: 'file',
    },
    {
      accept: 'application/pdf',
      id: 'afterPdf',
      label: 'After PDF',
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
    {
      defaultValue: 'split',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Side by side', value: 'split' },
        { label: 'Unified view', value: 'unified' },
        { label: 'JSON report', value: 'json' },
        { label: 'Readable report', value: 'text' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: 'Trim leading/trailing spaces and tabs and collapse interior runs for comparison only.',
      id: 'ignoreWhitespace',
      label: 'Ignore spaces and tabs',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Compare using full Unicode case mapping, so Straße matches STRASSE; no locale-specific or accent folding.',
      id: 'ignoreCase',
      label: 'Ignore letter case',
      type: 'checkbox',
    },
  ],
  freshResults: true,
  id: 'pdf-compare',
  inputKind: 'none',
  keywords: [
    'compare pdf',
    'pdf diff',
    'pdf difference',
    'compare two pdfs',
    'pdf changes',
    'pdf text diff',
  ],
  name: 'PDF Compare',
  outputKind: 'json',
  relatedToolIds: ['text-diff', 'pdf-text-extractor', 'pdf-toolkit'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => run(fields),
  samples: [
    { fields: { ...compare }, label: 'Side by side' },
    { fields: { ...compare, output: 'unified' }, label: 'Unified view' },
    { fields: { ...compare, output: 'json' }, label: 'JSON report' },
    { fields: { ...compare, output: 'text' }, label: 'Readable report' },
    { fields: { ...compare, ignoreCase: 'true' }, label: 'Ignore letter case' },
    { fields: { ...compare, pages: '1' }, label: 'First page only' },
  ],
  supportsSelection: false,
};

export const pdfDiffTool: ToolDefinition = {
  ...pdfCompareTool,
  aliasOf: 'pdf-compare',
  id: 'pdf-diff',
  name: 'PDF Diff',
  samples: pdfCompareTool.samples?.slice(0, 2),
};
