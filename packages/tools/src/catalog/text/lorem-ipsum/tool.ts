import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { generateLoremIpsum } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const plainText = { extension: 'txt', language: 'plaintext', mimeType: 'text/plain' } as const;
const loremFormats = {
  html: { extension: 'html', language: 'html', mimeType: 'text/html' },
  markdown: { extension: 'md', language: 'markdown', mimeType: 'text/markdown' },
  preview: plainText,
  text: plainText,
} as const;

export const loremIpsumTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Generate a precise amount of placeholder text, preview its paragraphs and export TXT, Markdown or HTML.',
  fields: [
    {
      defaultValue: 'sentences',
      id: 'unit',
      label: 'Generate by',
      options: [
        { label: 'Words', value: 'words' },
        { label: 'Sentences', value: 'sentences' },
        { label: 'Paragraphs', value: 'paragraphs' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '10',
      help: 'Words: 1–5,000. Sentences: 1–100. Paragraphs: 1–50. Whole numbers only.',
      id: 'sentences',
      label: 'Amount',
      type: 'number',
    },
    {
      defaultValue: '5',
      help: '1–10 complete sentences per paragraph. The final paragraph may be shorter in Sentences mode.',
      id: 'sentencesPerParagraph',
      label: 'Sentences per paragraph',
      type: 'number',
      visibleWhen: { field: 'unit', isNot: ['words'] },
    },
    {
      defaultValue: 'true',
      help: 'Start with the classic opening; otherwise start from the second bundled sentence.',
      id: 'startWithLorem',
      label: 'Start with Lorem ipsum',
      type: 'checkbox',
    },
    {
      defaultValue: 'preview',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Preview', value: 'preview' },
        { label: 'Plain text', value: 'text' },
        { label: 'Markdown', value: 'markdown' },
        { label: 'HTML source', value: 'html' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'lorem-ipsum',
  inputKind: 'none',
  keywords: ['lorem', 'ipsum', 'placeholder', 'dummy', 'paragraphs', 'words'],
  name: 'Lorem Ipsum',
  outputKind: 'text',
  relatedToolIds: ['text-statistics', 'wrap-text', 'markdown-to-html'],
  requiresInput: false,
  resultActions: ['copy', 'insert', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const unit = fields.unit ?? 'sentences';

      if (unit !== 'words' && unit !== 'sentences' && unit !== 'paragraphs')
        throw new ToolError('Choose Words, Sentences or Paragraphs.');

      const output = fields.output ?? 'preview';

      if (output !== 'preview' && output !== 'text' && output !== 'markdown' && output !== 'html')
        throw new ToolError('Choose Preview, Plain text, Markdown or HTML source.');

      const start = fields.startWithLorem ?? 'true';

      if (start !== 'true' && start !== 'false')
        throw new ToolError('Start with Lorem ipsum must be true or false.');

      const amount = fields.sentences ?? '10';
      const paragraphSize = fields.sentencesPerParagraph ?? '5';

      if (!/^\d+$/.test(amount.trim())) throw new ToolError('Amount must be a whole number.');
      if (unit !== 'words' && !/^\d+$/.test(paragraphSize.trim()))
        throw new ToolError('Sentences per paragraph must be a whole number.');

      const generated = generateLoremIpsum(Number(amount), {
        sentencesPerParagraph: Number(paragraphSize),
        startWithLorem: start === 'true',
        unit,
      });
      const text =
        output === 'html'
          ? generated.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('\n')
          : generated.text;
      const { extension, language, mimeType } = loremFormats[output];

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName: `lorem-ipsum.${extension}`,
          mimeType: `${mimeType};charset=utf-8`,
        },
        htmlPreview:
          output === 'preview'
            ? {
                label: 'Lorem Ipsum preview',
                nodes: generated.paragraphs.map((paragraph) => ({ tag: 'p', text: paragraph })),
              }
            : undefined,
        language,
        summary: `${generated.words} words · ${generated.sentences} complete sentences · ${generated.paragraphs.length} paragraphs · repeatable bundled content.`,
        text,
      };
    }),
  samples: [
    {
      fields: {
        output: 'preview',
        sentences: '3',
        sentencesPerParagraph: '5',
        startWithLorem: 'true',
        unit: 'sentences',
      },
      label: 'Short (3 sentences)',
    },
    {
      fields: {
        output: 'preview',
        sentences: '10',
        sentencesPerParagraph: '5',
        startWithLorem: 'true',
        unit: 'sentences',
      },
      label: 'Standard (10 sentences)',
    },
    {
      fields: {
        output: 'text',
        sentences: '25',
        sentencesPerParagraph: '5',
        startWithLorem: 'true',
        unit: 'sentences',
      },
      label: 'Long (25 sentences)',
    },
    {
      fields: {
        output: 'preview',
        sentences: '5',
        sentencesPerParagraph: '5',
        startWithLorem: 'true',
        unit: 'words',
      },
      label: 'Five-word card',
    },
    {
      fields: {
        output: 'preview',
        sentences: '3',
        sentencesPerParagraph: '2',
        startWithLorem: 'false',
        unit: 'paragraphs',
      },
      label: 'Three short paragraphs',
    },
    {
      fields: {
        output: 'html',
        sentences: '2',
        sentencesPerParagraph: '3',
        startWithLorem: 'true',
        unit: 'paragraphs',
      },
      label: 'HTML paragraphs',
    },
    {
      fields: {
        output: 'markdown',
        sentences: '2',
        sentencesPerParagraph: '2',
        startWithLorem: 'true',
        unit: 'paragraphs',
      },
      label: 'Markdown paragraphs',
    },
  ],
  supportsSelection: false,
  freshResults: true,
};
