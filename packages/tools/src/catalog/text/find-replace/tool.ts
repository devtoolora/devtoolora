import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  compareTextLines,
  findReplaceDetailed,
  type FindReplaceOptions,
  type TextDiffResult,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { checkbox } from '../shared';

const defaults: Record<string, string> = {
  caseSensitive: 'false',
  find: '',
  flags: 'u',
  occurrence: 'all',
  preview: 'changes',
  regex: 'false',
  replacement: '',
  replacementMode: 'tokens',
};

export const findReplaceTool: ToolDefinition = {
  capabilities: ['browserWorker', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Replace literal text or JavaScript regex matches with explicit replacement semantics, before/after inspection and isolated execution.',
  fields: [
    {
      defaultValue: '',
      help: 'Literal text by default. Regex mode accepts JavaScript pattern source without surrounding / delimiters; an empty regex is an intentional zero-width pattern.',
      id: 'find',
      label: 'Find',
      rows: 2,
      type: 'textarea',
    },
    {
      defaultValue: '',
      help: 'Empty deletes matches. Literal mode keeps dollar signs and backslashes verbatim. Actual pasted newlines are supported; backslash-n is not automatically unescaped.',
      id: 'replacement',
      label: 'Replacement',
      rows: 2,
      type: 'textarea',
    },
    { defaultValue: 'false', id: 'regex', label: 'Use regular expression', type: 'checkbox' },
    {
      defaultValue: 'false',
      help: 'Off uses JavaScript regex ignore-case matching, not a locale-aware comparison or Unicode normalization.',
      id: 'caseSensitive',
      label: 'Distinguish letter case',
      type: 'checkbox',
    },
    {
      defaultValue: 'all',
      id: 'occurrence',
      label: 'Occurrence',
      options: [
        { label: 'All matches', value: 'all' },
        { label: 'First match', value: 'first' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'u',
      help: 'Optional unique m s u v only: multiline anchors, dot-all and Unicode modes. u/v cannot combine. Do not enter g or i; the other controls manage them.',
      id: 'flags',
      label: 'Extra regex flags',
      type: 'text',
      visibleWhen: { field: 'regex', is: ['true'] },
    },
    {
      defaultValue: 'tokens',
      help: "Tokens support $$, $&, $1–$99, $<name>, $` and $'. Literal text interprets none of them. No replacement functions or evaluated code are accepted.",
      id: 'replacementMode',
      label: 'Replacement interpretation',
      options: [
        { label: 'JavaScript tokens', value: 'tokens' },
        { label: 'Literal text', value: 'literal' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'regex', is: ['true'] },
    },
    {
      defaultValue: 'changes',
      id: 'preview',
      label: 'Preview',
      options: [
        { label: 'Changes', value: 'changes' },
        { label: 'Replaced text', value: 'text' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'find-replace',
  inputKind: 'optionalText',
  keywords: ['find', 'replace', 'regex', 'substitution', 'text', 'captures'],
  name: 'Find & Replace',
  outputKind: 'text',
  relatedToolIds: ['regex-test', 'text-diff', 'prefix-suffix-lines', 'whitespace-cleaner'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runFindReplace(fields, text),
  samples: [
    {
      fields: { ...defaults, find: 'tools', replacement: 'world' },
      label: 'Literal word replacement',
      text: 'Hello tools, TOOLS again.',
    },
    {
      fields: { ...defaults, find: '.', replacement: '$&' },
      label: 'Literal punctuation and dollars',
      text: 'a.b.c',
    },
    {
      fields: { ...defaults, find: 'cat', occurrence: 'first', replacement: 'dog' },
      label: 'Only first occurrence',
      text: 'cat cat CAT',
    },
    {
      fields: { ...defaults, find: '(\\w+), (\\w+)', regex: 'true', replacement: '$2 $1' },
      label: 'Swap regex captures',
      text: 'Lovelace, Ada\nHopper, Grace',
    },
    {
      fields: {
        ...defaults,
        find: '(?<key>\\w+)=(?<value>\\w+)',
        regex: 'true',
        replacement: '$<key>: $<value>',
      },
      label: 'Named capture replacement',
      text: 'PORT=3000\nHOST=localhost',
    },
    {
      fields: {
        ...defaults,
        find: '\\d+',
        regex: 'true',
        replacement: '$1',
        replacementMode: 'literal',
      },
      label: 'Literal replacement in regex mode',
      text: 'id=123',
    },
    {
      fields: { ...defaults, find: '^ERROR:', flags: 'mu', regex: 'true', replacement: 'WARN:' },
      label: 'Multiline log markers',
      text: 'ERROR: one\nINFO: ok\nERROR: two',
    },
    {
      fields: { ...defaults, find: '(?=😀)|$', regex: 'true', replacement: '|' },
      label: 'Unicode zero-width insertion',
      text: '😀😀',
    },
    {
      fields: { ...defaults, find: 'remove', replacement: '' },
      label: 'Delete to empty',
      text: 'remove',
    },
    {
      fields: { ...defaults, find: 'one', replacement: 'ONE' },
      label: 'Keep mixed line endings',
      text: 'one\r\ntwo\rone\n',
    },
    {
      fields: { ...defaults, find: 'x', preview: 'report', replacement: 'y' },
      label: 'Full replacement audit',
      text: 'x x\n',
    },
    { fields: { ...defaults, find: 'x' }, label: 'Empty source is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
  isolatedWorker: true,
};

function parseFindReplaceOptions(fields: Record<string, string>): {
  options: FindReplaceOptions;
  preview: 'changes' | 'report' | 'text';
} {
  const regex = checkbox(fields, 'regex', 'Use regular expression', false);
  const occurrence = fields.occurrence ?? 'all';
  const preview = fields.preview ?? 'changes';
  const replacementMode = regex ? (fields.replacementMode ?? 'tokens') : 'literal';

  if (occurrence !== 'all' && occurrence !== 'first')
    throw new ToolError('Choose All matches or First match.');
  if (preview !== 'changes' && preview !== 'text' && preview !== 'report')
    throw new ToolError('Choose Changes, Replaced text or JSON audit.');
  if (replacementMode !== 'literal' && replacementMode !== 'tokens')
    throw new ToolError('Choose Literal text or JavaScript tokens for replacement.');

  return {
    options: {
      caseSensitive: checkbox(fields, 'caseSensitive', 'Distinguish letter case', false),
      flags: regex ? (fields.flags ?? 'u') : 'u',
      occurrence,
      regex,
      replacementMode,
    },
    preview,
  };
}

function compareOrExplain(
  original: string,
  replaced: string,
): { comparison?: TextDiffResult; comparisonUnavailable?: string } {
  try {
    return { comparison: withToolError(() => compareTextLines(original, replaced)) };
  } catch (error) {
    if (
      !(error instanceof ToolError) ||
      !/comparison budget|Ambiguous diff|limited to 100,000 UTF-16 units|limited to 10,000 physical lines/.test(
        error.message,
      )
    )
      throw error;

    return { comparisonUnavailable: error.message };
  }
}

function runFindReplace(fields: Record<string, string>, text: string): ToolResult {
  const { options, preview } = parseFindReplaceOptions(fields);
  const result = withToolError(() =>
    findReplaceDetailed(text, fields.find ?? '', fields.replacement ?? '', options),
  );
  const { comparison, comparisonUnavailable } = compareOrExplain(text, result.text);
  const report = JSON.stringify(
    {
      comparison,
      comparisonUnavailable,
      find: fields.find ?? '',
      options,
      originalText: text,
      replacement: fields.replacement ?? '',
      result,
    },
    null,
    2,
  );
  const textArtifact = {
    base64: encodeBase64Text(result.text),
    fileName: 'replaced-text.txt',
    mimeType: 'text/plain;charset=utf-8',
  };
  const reportArtifact = {
    base64: encodeBase64Text(report),
    fileName: 'replacement-report.json',
    mimeType: 'application/json;charset=utf-8',
  };

  return {
    artifact: preview === 'report' ? reportArtifact : textArtifact,
    artifacts: [preview === 'report' ? textArtifact : reportArtifact],
    language: preview === 'report' ? 'json' : 'plaintext',
    resultActions: preview === 'report' ? ['copy', 'scratch', 'save'] : undefined,
    summary: `${result.changed ? 'Changed' : 'Unchanged'} · ${result.count} replacement operations · ${options.regex ? 'JavaScript regex' : 'literal text'} · ${options.occurrence} · replacement ${options.replacementMode} · flags ${result.flags}.${comparisonUnavailable ? ' Comparison unavailable; exact result and reason are in the audit.' : ''}`,
    text: preview === 'report' ? report : result.text,
    textDiff:
      preview === 'changes' && comparison ? { layout: 'split', rows: comparison.rows } : undefined,
  };
}
