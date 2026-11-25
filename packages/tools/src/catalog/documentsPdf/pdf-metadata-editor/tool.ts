import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { processJsonDocument } from '@devtoolora/functions/format';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import {
  browserSafeCapabilities,
  pdfMaxBytes,
  pdfFiles,
  encodeText,
  bytesText,
  report,
} from '../shared';

const metadataEditing = { field: 'mode', is: ['edit'] };

const metadataDefaults = {
  author: '',
  blank: 'keep',
  creator: '',
  keywords: '',
  mode: 'view',
  producer: '',
  subject: '',
  title: '',
};

export const pdfMetadataTool: ToolDefinition = {
  id: 'pdf-metadata-editor',
  name: 'PDF Metadata Viewer & Editor',
  category: 'Documents & PDF',
  description:
    'View PDF title, author, creator, producer, dates, page size and version, edit any field, or remove all metadata before sharing, locally.',
  samples: [
    { fields: { ...metadataDefaults, ...report }, label: 'View metadata and details' },
    {
      fields: { ...metadataDefaults, ...report, mode: 'edit', title: 'Q3 report 2026' },
      label: 'Change the title only',
    },
    {
      fields: {
        ...metadataDefaults,
        ...report,
        author: 'Ada Lovelace',
        keywords: 'finance, quarterly, 2026',
        mode: 'edit',
        subject: 'Quarterly results',
        title: 'Q3 report 2026',
      },
      label: 'Set title, author, subject and keywords',
    },
    {
      fields: {
        ...metadataDefaults,
        ...report,
        blank: 'clear',
        mode: 'edit',
        title: 'Public summary',
      },
      label: 'Keep only a new title',
    },
    {
      fields: {
        ...metadataDefaults,
        ...report,
        creator: 'Report builder',
        mode: 'edit',
        producer: 'Dev Toolora',
      },
      label: 'Replace Creator and Producer',
    },
    {
      fields: { ...metadataDefaults, ...report, mode: 'remove' },
      label: 'Remove all metadata before sharing',
    },
  ],
  inputKind: 'none',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
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
      defaultValue: 'view',
      id: 'mode',
      label: 'Action',
      options: [
        { label: 'View', value: 'view' },
        { label: 'Edit', value: 'edit' },
        { label: 'Remove all', value: 'remove' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    { id: 'title', label: 'Title', type: 'text', visibleWhen: metadataEditing },
    { id: 'author', label: 'Author', type: 'text', visibleWhen: metadataEditing },
    { id: 'subject', label: 'Subject', type: 'text', visibleWhen: metadataEditing },
    {
      id: 'keywords',
      label: 'Keywords',
      placeholder: 'finance, quarterly, 2026',
      type: 'text',
      visibleWhen: metadataEditing,
    },
    {
      help: 'The application that made the original document.',
      id: 'creator',
      label: 'Creator',
      type: 'text',
      visibleWhen: metadataEditing,
    },
    {
      help: 'The application that wrote the PDF.',
      id: 'producer',
      label: 'Producer',
      type: 'text',
      visibleWhen: metadataEditing,
    },
    {
      defaultValue: 'keep',
      id: 'blank',
      label: 'Blank fields',
      options: [
        { label: 'Keep current value', value: 'keep' },
        { label: 'Clear', value: 'clear' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: metadataEditing,
    },
  ],
  keywords: [
    'pdf metadata',
    'pdf properties',
    'pdf title',
    'pdf author',
    'remove pdf metadata',
    'strip metadata',
    'pdf producer',
    'pdf creation date',
    'xmp',
  ],
  relatedToolIds: ['pdf-toolkit', 'pdf-page-numbers', 'exif-remover'],
  resultActions: ['save'],
  run: ({ fields }) => pdfMetadata(fields),
};

type PdfFile = ReturnType<typeof pdfFiles>[number];

async function pdfMetadata(fields: Record<string, string>): Promise<ToolResult> {
  const [file] = pdfFiles(fields, false);

  if (!file) throw new ToolError('PDF file is required.');

  const mode = fields.mode || 'view';
  const name = pdfFunctions.pdfBaseName(file.name);

  if (mode === 'view') return viewPdfMetadata(file, name);

  return changePdfMetadata(file, name, fields, mode);
}

async function viewPdfMetadata(file: PdfFile, name: string): Promise<ToolResult> {
  const info = await withToolErrorAsync(() => pdfFunctions.inspectPdf(file));
  const text = JSON.stringify(info, null, 2);
  const title = info.metadata?.title ? `“${info.metadata.title}”` : 'no title';

  return {
    artifact: {
      base64: encodeText(text),
      fileName: `${name}-metadata.json`,
      mimeType: 'application/json;charset=utf-8',
    },
    jsonTree: {
      expandedLevels: 2,
      nodes: processJsonDocument(text, { collectTree: true, mode: 'minify' }).nodes,
    },
    language: 'json',
    summary: `${info.metadata ? title : 'metadata unavailable'} · ${info.pageCount} ${info.pageCount === 1 ? 'page' : 'pages'} · PDF ${info.version} · ${info.encrypted ? 'encrypted, so it cannot be edited' : 'not encrypted'}${info.xmpMetadata ? ' · also has XMP metadata' : ''}.`,
    text,
  };
}

async function changePdfMetadata(
  file: PdfFile,
  name: string,
  fields: Record<string, string>,
  mode: string,
): Promise<ToolResult> {
  let result: pdfFunctions.PdfMetadataResult;

  if (mode === 'remove')
    result = await withToolErrorAsync(() => pdfFunctions.removePdfMetadata(file));
  else if (mode === 'edit') {
    if (fields.blank && fields.blank !== 'keep' && fields.blank !== 'clear')
      throw new ToolError('Blank fields must keep their value or be cleared.');

    const edit = {
      author: fields.author,
      creator: fields.creator,
      keywords: fields.keywords,
      producer: fields.producer,
      subject: fields.subject,
      title: fields.title,
    };

    result = await withToolErrorAsync(() =>
      pdfFunctions.editPdfMetadata(file, edit, { clearBlank: fields.blank === 'clear' }),
    );
  } else throw new ToolError('Choose View, Edit or Remove all.');

  const changed = (Object.keys(result.after) as Array<keyof typeof result.after>).filter(
    (key) => result.after[key] !== result.before[key],
  );
  const text = JSON.stringify(
    { after: result.after, before: result.before, changed, notes: result.notes },
    null,
    2,
  );

  return {
    artifact: {
      base64: base64Encode(result.bytes),
      fileName: `${name}-${mode === 'remove' ? 'clean' : 'metadata'}.pdf`,
      mimeType: 'application/pdf',
    },
    jsonTree: {
      expandedLevels: 2,
      nodes: processJsonDocument(text, { collectTree: true, mode: 'minify' }).nodes,
    },
    language: 'json',
    summary: [
      `${changed.length ? `Changed ${changed.join(', ')}` : 'No field values changed'} · ${bytesText(file.bytes.length)} → ${bytesText(result.bytes.length)}.`,
      ...result.notes,
    ].join(' '),
    text,
  };
}
