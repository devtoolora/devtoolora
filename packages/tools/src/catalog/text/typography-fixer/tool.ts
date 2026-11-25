import { ToolDefinition } from '@devtoolora/core';
import { fixTypography } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const directions = ['smart', 'ascii'] as const;

export const typographyFixerTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Convert straight quotes, dashes and three dots to typographic characters, or back to plain ASCII.',
  fields: [
    {
      defaultValue: 'smart',
      id: 'direction',
      label: 'Direction',
      options: [
        { label: 'ASCII \u2192 typographic', value: 'smart' },
        { label: 'Typographic \u2192 ASCII', value: 'ascii' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      id: 'skipCode',
      label: 'Skip Markdown code',
      type: 'checkbox',
    },
  ],
  freshResults: true,
  id: 'typography-fixer',
  inputKind: 'text',
  keywords: ['smart quotes', 'curly quotes', 'typography', 'en dash', 'em dash', 'ellipsis'],
  name: 'Typography Fixer',
  outputKind: 'text',
  relatedToolIds: ['whitespace-cleaner', 'find-replace', 'markdown-helper'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const result = fixTypography(text, {
        direction: choiceField(fields.direction, 'smart', directions, 'Choose a direction.'),
        skipCode: booleanField(fields.skipCode, true),
      });

      return {
        summary: `${result.replacements} ${result.replacements === 1 ? 'replacement' : 'replacements'}`,
        text: result.text,
      };
    }),
  samples: [
    { fields: {}, label: 'Quotes and dashes', text: "\"Hello,\" she said -- 'it's done...'" },
    { fields: {}, label: 'Em dash', text: 'Wait---what happened?' },
    { fields: {}, label: 'Apostrophes', text: "It's the '90s, isn't it?" },
    { fields: {}, label: 'Code is kept', text: 'Run `echo "hi"` and say "done".' },
    {
      fields: { skipCode: 'false' },
      label: 'Code converted too',
      text: 'Run `echo "hi"` and say "done".',
    },
    {
      fields: { direction: 'ascii' },
      label: 'Back to ASCII',
      text: '\u201CHello\u201D \u2013 it\u2019s done\u2026',
    },
  ],
  supportsSelection: true,
};
