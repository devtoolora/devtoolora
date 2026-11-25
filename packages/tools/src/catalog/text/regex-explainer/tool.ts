import type { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { explainRegex } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const sample = (label: string, text: string, flags = '') => ({
  fields: { flags },
  label,
  text,
});

export const regexExplainerTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Break a JavaScript regular expression into an indented tree of plain-English explanations, with a warning for nested unbounded quantifiers.',
  fields: [
    {
      defaultValue: '',
      help: 'Unique flags: d g i m s u v y. u and v cannot be combined. Flags in a pasted /…/flags literal win over this field.',
      id: 'flags',
      label: 'Flags',
      type: 'text',
    },
  ],
  freshResults: true,
  id: 'regex-explainer',
  inputKind: 'optionalText',
  inputPresentation: { label: 'Pattern', placeholder: '/^(?<year>\\d{4})$/u' },
  keywords: [
    'regex explain',
    'explain regex',
    'regular expression',
    'regex breakdown',
    'regex syntax',
    'regexp',
  ],
  name: 'Regex Explainer',
  outputKind: 'text',
  relatedToolIds: ['regex-test', 'find-replace', 'pattern-extractor'],
  requiresInput: false,
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const result = explainRegex(text, fields.flags ?? '');

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: 'regex-explanation.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        artifacts: [
          {
            base64: encodeBase64Text(JSON.stringify(result.json, null, 2)),
            fileName: 'regex-explanation.json',
            mimeType: 'application/json;charset=utf-8',
          },
        ],
        language: 'plaintext',
        noWrap: true,
        summary: result.summary,
        text: result.text,
      };
    }),
  samples: [
    sample('Year and month with named group', '^(?<year>\\d{4})-(\\d{2})$'),
    sample('Email-like pattern, ignore case', '^[\\w.+-]+@[\\w-]+\\.[a-z]{2,}$', 'i'),
    sample('Pasted literal with its own flags', '/\\b\\p{L}+\\b/gu'),
    sample('Lookbehind for a price', '(?<=\\$)\\d+(?:\\.\\d{2})?'),
    sample('Set subtraction in v mode', '[[a-z]--[aeiou]]+', 'v'),
    sample('Nested quantifier warning', '((a+)+)$'),
  ],
  supportsSelection: true,
};
