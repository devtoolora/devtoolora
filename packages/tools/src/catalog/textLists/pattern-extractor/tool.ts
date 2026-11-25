import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  extractPatterns,
  type ExtractOptions,
  type ExtractPattern,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const patterns: readonly ExtractPattern[] = [
  'custom',
  'email',
  'hashtag',
  'ipv4',
  'ipv6',
  'number',
  'url',
];

const defaults: Record<string, string> = {
  custom: '',
  dedupe: 'true',
  ignoreCase: 'false',
  pattern: 'email',
  sort: 'false',
};

function readOptions(fields: Record<string, string>): ExtractOptions {
  const pattern = choiceField(
    fields.pattern,
    'email',
    patterns,
    'Choose Email, URL, IPv4, IPv6, Number, Hashtag or Custom pattern.',
  );
  const isCustom = pattern === 'custom';

  return {
    custom: isCustom ? (fields.custom ?? '') : undefined,
    dedupe: booleanField(fields.dedupe, true),
    ignoreCase: isCustom && booleanField(fields.ignoreCase, false),
    pattern,
    sort: booleanField(fields.sort, false),
  };
}

function runPatternExtractor(fields: Record<string, string>, text: string): ToolResult {
  const result = withToolError(() => extractPatterns(text, readOptions(fields)));
  const output = result.matches.join('\n');

  return {
    artifact: {
      base64: encodeBase64Text(output),
      fileName: 'matches.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    language: 'plaintext',
    summary: `${result.total} matches · ${result.unique} unique`,
    text: output,
  };
}

export const patternExtractorTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Extract emails, URLs, IP addresses, numbers, hashtags or a custom regex capture group from text, one match per line.',
  fields: [
    {
      defaultValue: 'email',
      id: 'pattern',
      label: 'Pattern',
      options: [
        { label: 'Email addresses', value: 'email' },
        { label: 'URLs', value: 'url' },
        { label: 'IPv4 addresses', value: 'ipv4' },
        { label: 'IPv6 addresses', value: 'ipv6' },
        { label: 'Numbers', value: 'number' },
        { label: 'Hashtags', value: 'hashtag' },
        { label: 'Custom regex', value: 'custom' },
      ],
      type: 'select',
    },
    {
      defaultValue: '',
      help: 'JavaScript pattern source, 1 to 256 characters. The first capture group is extracted when present.',
      id: 'custom',
      label: 'Custom pattern',
      placeholder: '(\\d+)px',
      type: 'text',
      visibleWhen: { field: 'pattern', is: ['custom'] },
    },
    {
      defaultValue: 'false',
      id: 'ignoreCase',
      label: 'Ignore case',
      type: 'checkbox',
      visibleWhen: { field: 'pattern', is: ['custom'] },
    },
    { defaultValue: 'true', id: 'dedupe', label: 'Remove duplicates', type: 'checkbox' },
    { defaultValue: 'false', id: 'sort', label: 'Sort matches', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'pattern-extractor',
  inputKind: 'text',
  isolatedWorker: true,
  keywords: ['extract', 'regex', 'email', 'url', 'ip', 'hashtag', 'number', 'match', 'grep'],
  name: 'Pattern Extractor',
  outputKind: 'text',
  relatedToolIds: ['regex-test', 'find-replace', 'deduplicate-lines', 'url-parse'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runPatternExtractor(fields, text),
  samples: [
    {
      fields: { ...defaults },
      label: 'Emails from a signature block',
      text: 'Jane Doe <jane.doe@example.com>\nSupport: help@example.org, jane.doe@example.com',
    },
    {
      fields: { ...defaults, pattern: 'url' },
      label: 'URLs from Markdown',
      text: 'See [docs](https://example.com/docs) and <http://example.org/a?b=1>.',
    },
    {
      fields: { ...defaults, pattern: 'ipv4' },
      label: 'IPv4 from a log',
      text: '10.0.0.1 GET /\n192.168.1.10 POST /login\n999.1.1.1 invalid\n10.0.0.1 GET /about',
    },
    {
      fields: { ...defaults, pattern: 'ipv6' },
      label: 'IPv6 addresses',
      text: 'host a: 2001:db8::1\nhost b: fe80::1\nloopback: ::1\nnot an address: 12:30:45',
    },
    {
      fields: { ...defaults, custom: '(\\d+)px', pattern: 'custom' },
      label: 'Numbers with units (custom group)',
      text: 'width: 120px; height: 48px; margin: 8px;',
    },
    {
      fields: { ...defaults, pattern: 'hashtag', sort: 'true' },
      label: 'Hashtags',
      text: 'Shipping #devtools today, thanks #OpenSource and #devtools fans!',
    },
  ],
  supportsSelection: true,
};
