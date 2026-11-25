import type { ToolDefinition } from '@devtoolora/core';
import { aiLimits, formatJsonlReport, validateJsonlDataset } from '@devtoolora/functions/ai';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolErrorAsync } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { fileBytesFromField } from '../../../adapters/files';

const formats = ['auto', 'openai-chat', 'openai-preference', 'bedrock-claude'] as const;

const formatLabels: { [value in (typeof formats)[number]]: string } = {
  auto: 'Auto-detect',
  'bedrock-claude': 'Amazon Bedrock (Claude)',
  'openai-chat': 'OpenAI chat',
  'openai-preference': 'OpenAI preference',
};

const lines = (...examples: unknown[]): string =>
  examples.map((example) => JSON.stringify(example)).join('\n');
const user = (content: string) => ({ content, role: 'user' });
const assistant = (content: string) => ({ content, role: 'assistant' });

const support = lines(
  {
    messages: [
      { content: 'You are a concise support agent.', role: 'system' },
      user('How do I reset my password?'),
      assistant('Open Settings, choose Security and select Reset password.'),
    ],
  },
  { messages: [user('Can I change my username?'), assistant('Yes, once every 30 days.')] },
  {
    messages: [
      user('Where is my invoice?'),
      assistant('Invoices are under Billing.'),
      user('And older ones?'),
      { content: 'Choose a year in the Billing history list.', role: 'assistant', weight: 1 },
    ],
  },
);

const toolCalls = lines({
  messages: [
    user('What is the weather in Prague?'),
    {
      role: 'assistant',
      tool_calls: [
        {
          function: { arguments: '{"city":"Prague"}', name: 'get_weather' },
          id: 'call_1',
          type: 'function',
        },
      ],
    },
    { content: '{"temperature":18,"sky":"clear"}', role: 'tool', tool_call_id: 'call_1' },
    assistant('It is 18 °C and clear in Prague.'),
  ],
  parallel_tool_calls: false,
  tools: [{ function: { name: 'get_weather', parameters: { type: 'object' } }, type: 'function' }],
});

const preference = lines(
  {
    input: { messages: [user('Summarize: the meeting moved to Friday at 10.')] },
    non_preferred_output: [assistant('There is a meeting.')],
    preferred_output: [assistant('The meeting is now on Friday at 10:00.')],
  },
  {
    input: { messages: [user('Translate "thank you" to Czech.')] },
    non_preferred_output: [assistant('Thanks.')],
    preferred_output: [assistant('Děkuji.')],
  },
);

const bedrock = lines(
  {
    messages: [user('Name a prime number.'), assistant('7')],
    system: 'Answer with one word.',
  },
  {
    messages: [
      user('Capital of France?'),
      assistant('Paris'),
      user('Of Italy?'),
      assistant('Rome'),
    ],
    system: 'Answer with one word.',
  },
);

const mistakes = [
  JSON.stringify({ messages: [user('Hi'), assistant('Hello!')] }),
  JSON.stringify({ messages: [user('Only a question')] }),
  '{"messages": [{"role": "user", "content": "Hi"}',
  '',
  JSON.stringify({ messages: [{ content: 'Hi', role: 'bot' }, assistant('')] }),
].join('\n');

const duplicates = lines(
  { messages: [user('Hi'), assistant('Hello!')] },
  {
    messages: [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ],
  },
  { id: 42, messages: [user('Bye'), assistant('Goodbye!')] },
);

const sample = (label: string, text: string, format = 'auto') => ({
  fields: { format },
  label,
  text,
});

export const jsonlDatasetValidatorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'AI & Prompts',
  description:
    'Check a JSONL fine-tuning dataset for OpenAI chat, OpenAI preference or Amazon Bedrock (Claude): line errors, roles, tool calls, duplicates and token statistics.',
  fields: [
    {
      accept: '.jsonl,.json,.txt',
      id: 'file',
      label: 'JSONL file (replaces the text)',
      maxBytes: aiLimits.jsonl.fileBytes,
      type: 'file',
    },
    {
      defaultValue: 'auto',
      id: 'format',
      label: 'Format',
      options: formats.map((value) => ({ label: formatLabels[value], value })),
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'jsonl-dataset-validator',
  inputKind: 'optionalText',
  keywords: [
    'jsonl',
    'fine-tuning',
    'dataset',
    'training data',
    'openai',
    'bedrock',
    'dpo',
    'validate',
  ],
  name: 'JSONL Dataset Validator',
  outputKind: 'text',
  relatedToolIds: ['json-lines-inspector', 'token-estimator', 'json-schema-validator'],
  resultActions: ['copy', 'save'],
  run: ({ fields, text }) =>
    withToolErrorAsync(async () => {
      const format = choiceField(fields.format, 'auto', formats, 'Choose a listed format.');
      const input = fields.file?.trim()
        ? fileBytesFromField(fields.file, 'JSONL file').bytes
        : text;
      const validation = await validateJsonlDataset(input, format);
      const { report, summary } = formatJsonlReport(validation);

      return {
        artifact: {
          base64: encodeBase64Text(report),
          fileName: 'dataset-report.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        artifacts: [
          {
            base64: encodeBase64Text(JSON.stringify(validation, null, 2)),
            fileName: 'dataset-report.json',
            mimeType: 'application/json;charset=utf-8',
          },
        ],
        language: 'plaintext',
        summary,
        text: report,
      };
    }),
  runRequires: [{ anyOf: ['$text', 'file'] }],
  samples: [
    sample('Valid chat dataset', support),
    sample('Tool calls', toolCalls),
    sample('Preference pairs', preference),
    sample('Amazon Bedrock (Claude)', bedrock),
    sample('Common mistakes', mistakes, 'openai-chat'),
    sample('Duplicates and extra keys', duplicates),
  ],
  sensitiveInput: true,
  supportsSelection: true,
};
