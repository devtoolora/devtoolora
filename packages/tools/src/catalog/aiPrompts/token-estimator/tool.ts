import type { ToolDefinition, ToolResult } from '@devtoolora/core';
import { analyzeTokens, type TokenEstimate } from '@devtoolora/functions/ai';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const NOTE = 'Heuristic estimate, not a tokenizer; real counts vary by model.';
const format = new Intl.NumberFormat('en-US');

function report({ contextFit, counts, estimate, high, low, margin }: TokenEstimate): string {
  return [
    `≈ ${format.format(estimate)} tokens (range ${format.format(low)}-${format.format(high)}, ±${Math.round(margin * 100)}%)`,
    NOTE,
    '',
    `UTF-16 units: ${format.format(counts.utf16Units)}`,
    `Code points: ${format.format(counts.codePoints)}`,
    `UTF-8 bytes: ${format.format(counts.utf8Bytes)}`,
    `Words: ${format.format(counts.words)}`,
    `Lines: ${format.format(counts.lines)}`,
    '',
    'Context fit (high estimate):',
    ...contextFit.map(
      ({ percent, tokens }) => `${format.format(tokens)} tokens: ${percent.toFixed(1)}%`,
    ),
  ].join('\n');
}

function estimateResult(text: string): ToolResult {
  const analysis = analyzeTokens(text);
  const { contextFit, counts, estimate, high, low, margin } = analysis;
  const json = JSON.stringify({ estimate, low, high, margin, counts, contextFit }, null, 2);
  const output = report(analysis);

  return {
    artifact: {
      base64: encodeBase64Text(output),
      fileName: 'token-estimate.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    artifacts: [
      {
        base64: encodeBase64Text(json),
        fileName: 'token-estimate.json',
        mimeType: 'application/json',
      },
    ],
    noWrap: true,
    summary: `≈ ${format.format(estimate)} tokens · ${format.format(counts.utf16Units)} UTF-16 units`,
    text: output,
  };
}

const sample = (label: string, text: string) => ({ label, text });

export const tokenEstimatorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'AI & Prompts',
  description:
    'Estimate how many LLM tokens a prompt uses, with a range, text counts and how much of common context windows it fills. A heuristic, not a tokenizer.',
  freshResults: true,
  id: 'token-estimator',
  inputKind: 'text',
  keywords: ['token', 'tokens', 'llm', 'prompt', 'context window', 'gpt', 'claude', 'estimate'],
  name: 'Token Estimator',
  outputKind: 'text',
  relatedToolIds: ['text-statistics', 'word-frequency'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) => withToolError(() => estimateResult(text)),
  samples: [
    sample('English sentence', 'Hello world'),
    sample('Japanese text', '日本語のテキスト'),
    sample('JSON snippet', '{"a":1}'),
    sample('Emoji', 'Great job \u{1f44d}\u{1f389}'),
    sample(
      'Multi-line prompt',
      'You are a helpful assistant.\n\nSummarize the text below.\n\nText: ...',
    ),
    sample('Code', 'function add(a, b) {\n  return a + b;\n}'),
  ],
  supportsSelection: true,
};

export const tokenCounterTool: ToolDefinition = {
  ...tokenEstimatorTool,
  aliasOf: 'token-estimator',
  description:
    'Count LLM tokens in a prompt with a range and context window fit. A heuristic estimate.',
  id: 'token-counter',
  name: 'Token Counter',
};
