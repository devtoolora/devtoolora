import type { ToolDefinition, ToolField } from '@devtoolora/core';
import {
  buildToolSchemas,
  estimateTokens,
  type ToolSchemaOptions,
  type ToolSchemaResult,
} from '@devtoolora/functions/ai';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const providers = ['all', 'openai', 'anthropic', 'gemini'] as const;
const providerLabels: Record<(typeof providers)[number], string> = {
  all: 'All',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  openai: 'OpenAI',
};
const format = new Intl.NumberFormat('en-US');

const fields: ToolField[] = [
  { defaultValue: 'get_weather', id: 'name', label: 'Function name', type: 'text' },
  {
    defaultValue: 'Get the current weather for a city.',
    id: 'description',
    label: 'Description',
    required: true,
    rows: 2,
    type: 'textarea',
  },
  {
    defaultValue: 'all',
    id: 'provider',
    label: 'Provider',
    options: providers.map((value) => ({ label: providerLabels[value], value })),
    presentation: 'segmented',
    type: 'select',
  },
  {
    defaultValue: 'true',
    id: 'strict',
    label: 'OpenAI strict mode',
    type: 'checkbox',
    visibleWhen: { field: 'provider', is: ['all', 'openai'] },
  },
];

function summarize(
  options: ToolSchemaOptions,
  { dropped, warnings }: Pick<ToolSchemaResult, 'dropped' | 'warnings'>,
  text: string,
): string {
  const openai = options.strict ? 'OpenAI (strict)' : 'OpenAI';
  const target =
    options.provider === 'all'
      ? `${openai}, Anthropic and Gemini tool definitions`
      : `${options.provider === 'openai' ? openai : providerLabels[options.provider]} tool definition`;
  const summary = `${target} for ${options.name} · ≈ ${format.format(estimateTokens(text))} tokens.`;

  return [
    summary,
    ...(dropped.length > 0 ? [`Dropped in OpenAI strict mode: ${dropped.join(', ')}.`] : []),
    ...warnings,
  ].join(' ');
}

const sample = (label: string, value: unknown, values: Record<string, string>) => ({
  fields: values,
  label,
  text: JSON.stringify(value, null, 2),
});

export const functionSchemaBuilderTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'AI & Prompts',
  description:
    'Turn example call arguments into function-calling tool definitions for OpenAI, Anthropic and Gemini, with OpenAI strict mode.',
  fields,
  freshResults: true,
  id: 'function-schema-builder',
  inputKind: 'text',
  inputPresentation: {
    label: 'Example arguments (JSON)',
    placeholder: '{ "city": "Prague", "units": "metric" }',
  },
  keywords: [
    'function calling',
    'tool use',
    'tool schema',
    'json schema',
    'openai',
    'anthropic',
    'gemini',
    'llm',
  ],
  name: 'Function-Calling Schema Builder',
  outputKind: 'text',
  relatedToolIds: ['json-schema-generator', 'json-schema-validator', 'token-estimator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields: values, text }) =>
    withToolError(() => {
      const options: ToolSchemaOptions = {
        description: values.description ?? '',
        name: values.name ?? 'get_weather',
        provider: choiceField(
          values.provider,
          'all',
          providers,
          'Choose all, openai, anthropic or gemini.',
        ),
        strict: booleanField(values.strict, true),
      };
      const result = buildToolSchemas(text, options);
      const json = JSON.stringify(result.output, null, 2);

      return {
        artifact: {
          base64: encodeBase64Text(json),
          fileName: `${options.name}.tools.json`,
          mimeType: 'application/json;charset=utf-8',
        },
        language: 'json',
        summary: summarize(options, result, JSON.stringify(result.output)),
        text: json,
      };
    }),
  samples: [
    sample(
      'Weather lookup',
      { city: 'Prague', units: 'metric' },
      { description: 'Get the current weather for a city.', name: 'get_weather' },
    ),
    sample(
      'Optional fields from several examples',
      [
        { limit: 5, query: 'wireless headphones' },
        { category: 'audio', query: 'usb microphone' },
        { query: 'standing desk' },
      ],
      { description: 'Search the product catalog.', name: 'search_products' },
    ),
    sample(
      'Nested objects and arrays',
      {
        attendees: [{ email: 'ada@example.com', optional: false }],
        start: '2026-11-03T10:00:00Z',
        title: 'Planning',
      },
      { description: 'Create a calendar event.', name: 'create_event' },
    ),
    sample(
      'OpenAI without strict mode',
      [{ order_id: 'A-1001' }, { order_id: 'A-1002', reason: 'damaged' }],
      {
        description: 'Start a refund for an order.',
        name: 'refund_order',
        provider: 'openai',
        strict: 'false',
      },
    ),
    sample(
      'Anthropic tool',
      { body: 'The report is ready.', subject: 'Weekly report', to: ['team@example.com'] },
      { description: 'Send an email.', name: 'send_email', provider: 'anthropic' },
    ),
    sample(
      'Gemini with a nullable field',
      [
        { city: 'Oslo', zip: '0150' },
        { city: 'Prague', zip: null },
      ],
      { description: 'Look up a postal address.', name: 'find_address', provider: 'gemini' },
    ),
  ],
  supportsSelection: true,
};
