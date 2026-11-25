import type { ToolDefinition, ToolField } from '@devtoolora/core';
import {
  aiLimits,
  estimateTokens,
  parseAiText,
  renderTemplate,
  type TemplateOptions,
  type TemplateResult,
} from '@devtoolora/functions/ai';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const missingModes = ['error', 'empty', 'keep'] as const;
const escapeModes = ['none', 'html'] as const;

const labels: { [value in (typeof missingModes | typeof escapeModes)[number]]: string } = {
  empty: 'Empty',
  error: 'Error',
  html: 'HTML',
  keep: 'Keep',
  none: 'None',
};
const format = new Intl.NumberFormat('en-US');
const { variablesChars, variablesDepth } = aiLimits.template;

const fields: ToolField[] = [
  {
    defaultValue: '{}',
    id: 'variables',
    label: 'Variables (JSON)',
    rows: 8,
    type: 'textarea',
  },
  {
    defaultValue: 'error',
    id: 'missing',
    label: 'Missing variables',
    options: missingModes.map((value) => ({ label: labels[value], value })),
    presentation: 'segmented',
    type: 'select',
  },
  {
    defaultValue: 'none',
    id: 'escape',
    label: 'Escape',
    options: escapeModes.map((value) => ({ label: labels[value], value })),
    presentation: 'segmented',
    type: 'select',
  },
];

const count = (value: number, noun: string) =>
  `${format.format(value)} ${value === 1 ? noun : `${noun}s`}`;

function summarize({ iterations, kept, output, sections, variables }: TemplateResult): string {
  const rendered = [
    `Rendered ${count(output.length, 'character')}`,
    count(variables, 'variable'),
    count(sections, 'section'),
    count(iterations, 'iteration'),
    `≈ ${count(estimateTokens(output), 'token')}.`,
  ].join(' · ');

  return kept.length > 0 ? `${rendered} Kept: ${kept.join(', ')}.` : rendered;
}

const sample = (label: string, text: string, values: Record<string, string> = {}) => ({
  fields: values,
  label,
  text,
});

const json = (value: unknown) => JSON.stringify(value, null, 2);

export const promptTemplateRendererTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'AI & Prompts',
  description:
    'Fill a Mustache-style prompt template with JSON variables: names, dotted paths, sections, loops and inverted sections, with missing-variable checks.',
  fields,
  freshResults: true,
  id: 'prompt-template-renderer',
  inputKind: 'text',
  inputPresentation: { label: 'Template', placeholder: 'Summarize {{topic}} for {{audience}}.' },
  keywords: ['prompt', 'template', 'mustache', 'handlebars', 'variables', 'llm', 'render', 'fill'],
  name: 'Prompt Template Renderer',
  outputKind: 'text',
  relatedToolIds: ['token-estimator', 'text-chunker'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields: values, text }) =>
    withToolError(() => {
      const options: TemplateOptions = {
        escape: choiceField(values.escape, 'none', escapeModes, 'Choose none or html escaping.'),
        missing: choiceField(values.missing, 'error', missingModes, 'Choose error, empty or keep.'),
      };
      const variables = parseAiText(values.variables?.trim() || '{}', 'Variables', {
        characters: variablesChars,
        depth: variablesDepth,
      });
      const result = renderTemplate(text, variables, options);

      return {
        artifact: {
          base64: encodeBase64Text(result.output),
          fileName: 'prompt.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        summary: summarize(result),
        text: result.output,
      };
    }),
  samples: [
    sample(
      'Name and dotted path',
      'Write a short welcome email to {{customer.name}} from {{company}}.',
      {
        variables: json({ company: 'Acme', customer: { name: 'Ada' } }),
      },
    ),
    sample(
      'Loop over documents',
      'Answer using these sources:\n{{#docs}}\n- [{{id}}] {{title}}\n{{/docs}}\nQuestion: {{question}}',
      {
        variables: json({
          docs: [
            { id: 1, title: 'Billing FAQ' },
            { id: 2, title: 'Refund policy' },
          ],
          question: 'How do refunds work?',
        }),
      },
    ),
    sample(
      'Optional section with fallback',
      '{{#context}}\nContext: {{.}}\n{{/context}}\n{{^context}}\nNo extra context.\n{{/context}}\nTask: {{task}}',
      { variables: json({ context: '', task: 'Summarize the ticket.' }) },
    ),
    sample(
      'Few-shot examples',
      '{{#examples}}\nQ: {{q}}\nA: {{a}}\n\n{{/examples}}Q: {{input}}\nA:',
      {
        variables: json({
          examples: [
            { a: 'positive', q: 'I love it' },
            { a: 'negative', q: 'Broken on arrival' },
          ],
          input: 'Works as described',
        }),
      },
    ),
    sample('Keep unknown placeholders', 'Hello {{name}}, your order {{order.id}} ships {{date}}.', {
      missing: 'keep',
      variables: json({ name: 'Lin' }),
    }),
    sample('JSON value and HTML escape', 'Tool input: {{{args}}}\nUser said: {{message}}', {
      escape: 'html',
      variables: json({
        args: { city: 'Prague', units: 'metric' },
        message: 'Is it <30 °C> & dry?',
      }),
    }),
  ],
  supportsSelection: true,
};
