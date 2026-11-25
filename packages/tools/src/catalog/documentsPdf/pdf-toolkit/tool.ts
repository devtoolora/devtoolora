import { ToolDefinition } from '@devtoolora/core';
import { browserSafeCapabilities, pdfMaxBytes, reportPdf } from '../shared';
import { pdfPages } from './operations';

const selectionHelp = 'Pages from 1: 2, 4-6, 8-, last, odd or even.';
const modeIs = (...modes: string[]) => ({ field: 'mode', is: modes });

const appendixPdf =
  'data:application/pdf;base64,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';

const files = (...entries: Array<[string, string]>) =>
  JSON.stringify(entries.map(([name, data]) => ({ data, name })));

const pagesDefaults = {
  angle: '90',
  mode: 'merge',
  order: '',
  pages: '',
  rotatePages: 'all',
  splitEvery: '2',
  splitMode: 'each',
  splitRanges: '',
};

export const pdfPagesTool: ToolDefinition = {
  id: 'pdf-toolkit',
  preview: 'pdf-pages',
  name: 'PDF Pages',
  category: 'Documents & PDF',
  description:
    'Merge, split, reorder, rotate, delete or extract PDF pages with thumbnails, or check page count, size and version, locally.',
  samples: [
    {
      fields: {
        ...pagesDefaults,
        pdfs: files(['quarterly-report.pdf', reportPdf], ['appendix.pdf', appendixPdf]),
      },
      label: 'Merge a report and its appendix',
    },
    {
      fields: {
        ...pagesDefaults,
        mode: 'info',
        pdfs: files(['quarterly-report.pdf', reportPdf], ['appendix.pdf', appendixPdf]),
      },
      label: 'Page count, size and details',
    },
    {
      fields: {
        ...pagesDefaults,
        mode: 'delete',
        pages: '2-3',
        pdfs: files(['quarterly-report.pdf', reportPdf]),
      },
      label: 'Delete pages 2-3',
    },
    {
      fields: {
        ...pagesDefaults,
        mode: 'extract',
        pages: '1, last',
        pdfs: files(['quarterly-report.pdf', reportPdf]),
      },
      label: 'Extract the first and last page',
    },
    {
      fields: {
        ...pagesDefaults,
        mode: 'reorder',
        order: '4, 1-3',
        pdfs: files(['quarterly-report.pdf', reportPdf]),
      },
      label: 'Move the last page to the front',
    },
    {
      fields: {
        ...pagesDefaults,
        mode: 'split',
        pdfs: files(['quarterly-report.pdf', reportPdf]),
        splitMode: 'every',
      },
      label: 'Split into 2-page files',
    },
    {
      fields: {
        ...pagesDefaults,
        mode: 'rotate',
        pdfs: files(['quarterly-report.pdf', reportPdf]),
        rotatePages: 'even',
      },
      label: 'Rotate even pages 90° right',
    },
  ],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  fields: [
    {
      accept: 'application/pdf',
      help: 'Merge uses every file in this order; the other operations use the first file.',
      id: 'pdfs',
      label: 'PDF files',
      maxBytes: pdfMaxBytes,
      multiple: true,
      required: true,
      type: 'file',
    },
    {
      defaultValue: 'merge',
      id: 'mode',
      label: 'Operation',
      options: [
        { label: 'Merge files', value: 'merge' },
        { label: 'Split into files', value: 'split' },
        { label: 'Reorder pages', value: 'reorder' },
        { label: 'Rotate pages', value: 'rotate' },
        { label: 'Delete pages', value: 'delete' },
        { label: 'Extract pages', value: 'extract' },
        { label: 'Page count and details', value: 'info' },
        { label: 'Re-save compactly', value: 'optimize' },
      ],
      type: 'select',
    },
    {
      help: selectionHelp,
      id: 'pages',
      label: 'Pages',
      placeholder: '2-3, 5, 8-',
      required: true,
      type: 'text',
      visibleWhen: modeIs('delete', 'extract'),
    },
    {
      help: 'The order you type is the new order, such as 4, 1-3; pages you leave out are dropped.',
      id: 'order',
      label: 'New page order',
      placeholder: '4, 1-3',
      required: true,
      type: 'text',
      visibleWhen: modeIs('reorder'),
    },
    {
      defaultValue: 'all',
      help: selectionHelp,
      id: 'rotatePages',
      label: 'Pages to rotate',
      placeholder: 'all, even, 1-3',
      required: true,
      type: 'text',
      visibleWhen: modeIs('rotate'),
    },
    {
      defaultValue: '90',
      id: 'angle',
      label: 'Rotation',
      options: [
        { label: '90° right', value: '90' },
        { label: '180°', value: '180' },
        { label: '90° left', value: '270' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: modeIs('rotate'),
    },
    {
      defaultValue: 'each',
      id: 'splitMode',
      label: 'Split into',
      options: [
        { label: 'Each page', value: 'each' },
        { label: 'Every N pages', value: 'every' },
        { label: 'Custom ranges', value: 'ranges' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: modeIs('split'),
    },
    {
      defaultValue: '2',
      help: 'Whole number from 1.',
      id: 'splitEvery',
      label: 'Pages per file',
      type: 'number',
      visibleWhen: [modeIs('split'), { field: 'splitMode', is: ['every'] }],
    },
    {
      help: 'One output file per comma-separated range.',
      id: 'splitRanges',
      label: 'Ranges',
      placeholder: '1-3, 4-6, 7-',
      required: true,
      type: 'text',
      visibleWhen: [modeIs('split'), { field: 'splitMode', is: ['ranges'] }],
    },
  ],
  keywords: [
    'merge pdf',
    'combine pdf',
    'split pdf',
    'reorder pdf pages',
    'rotate pdf',
    'delete pdf pages',
    'remove pages',
    'extract pdf pages',
    'pdf page count',
    'organize pdf',
  ],
  relatedToolIds: ['pdf-page-numbers', 'pdf-metadata-editor', 'markdown-to-pdf', 'image-tools'],
  resultActions: ['save'],
  run: ({ fields }) => pdfPages(fields),
};

const pagesAlias = (id: string, name: string, mode: string): ToolDefinition => ({
  ...pdfPagesTool,
  aliasOf: 'pdf-toolkit',
  fields: pdfPagesTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: mode } : field,
  ),
  id,
  name,
  run: ({ fields }) => pdfPages({ ...fields, mode: fields.mode || mode }),
});

export const pdfPageCounterTool = pagesAlias('pdf-page-counter', 'PDF Page Counter', 'info');
export const pdfDeletePagesTool = pagesAlias('pdf-delete-pages', 'Delete PDF Pages', 'delete');
export const pdfExtractPagesTool = pagesAlias('pdf-extract-pages', 'Extract PDF Pages', 'extract');
