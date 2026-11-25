import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  compareTextLines,
  layoutText,
  type TextDiffResult,
  type TextLayoutOptions,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const defaults: Record<string, string> = {
  joinWith: 'space',
  longWords: 'keep',
  mode: 'wrap',
  newLine: 'match',
  paragraphs: 'keep',
  preview: 'changes',
  spacing: 'preserve',
  width: '80',
};

function reflowOutcome(unchanged: boolean, mode: string): string {
  if (unchanged) return 'Unchanged';

  return mode === 'wrap' ? 'Wrapped' : 'Unwrapped';
}

export const wrapTextTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Wrap by Unicode graphemes or join physical lines with explicit paragraph, spacing and line-ending rules, then inspect the changes.',
  fields: [
    {
      defaultValue: 'wrap',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Wrap', value: 'wrap' },
        { label: 'Unwrap', value: 'unwrap' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '80',
      help: 'Integer 1–1,000. Counts graphemes, including indentation and each ASCII space/tab as one unit; not screen pixels or terminal columns.',
      id: 'width',
      label: 'Width in graphemes',
      type: 'number',
      visibleWhen: { field: 'mode', isNot: ['unwrap'] },
    },
    {
      defaultValue: 'keep',
      help: 'Keep may exceed width. Break splits only long tokens, on grapheme boundaries, starting them on a new line when needed. Indentation must leave room for content.',
      id: 'longWords',
      label: 'Long tokens',
      options: [
        { label: 'Keep intact', value: 'keep' },
        { label: 'Break by grapheme', value: 'break' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', isNot: ['unwrap'] },
    },
    {
      defaultValue: 'match',
      help: 'Only inserted breaks use this setting. Match uses the current source line’s terminator, or the first source terminator for an unterminated line; otherwise LF.',
      id: 'newLine',
      label: 'Inserted line endings',
      options: [
        { label: 'Match source', value: 'match' },
        { label: 'LF', value: 'lf' },
        { label: 'CRLF', value: 'crlf' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', isNot: ['unwrap'] },
    },
    {
      defaultValue: 'preserve',
      help: 'Preserve keeps interior/trailing ASCII spaces and tabs, except a gap used for a wrap break becomes the new terminator. Collapse makes interior runs one space and trims eligible trailing/join-edge spacing; first-line indentation and kept blank rows remain.',
      id: 'spacing',
      label: 'Spacing',
      options: [
        { label: 'Preserve spacing', value: 'preserve' },
        { label: 'Collapse ASCII spacing', value: 'collapse' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'keep',
      help: 'Keep treats empty/ASCII-space/tab-only rows as paragraph separators and retains them exactly. Join all crosses those boundaries too.',
      id: 'paragraphs',
      label: 'Paragraph boundaries',
      options: [
        { label: 'Keep paragraphs', value: 'keep' },
        { label: 'Join all lines', value: 'join' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['unwrap'] },
    },
    {
      defaultValue: 'space',
      help: 'Replaces each eligible internal terminator with one ASCII space or nothing. Preserve spacing retains adjacent body spaces too; Collapse trims those joining edges.',
      id: 'joinWith',
      label: 'Join with',
      options: [
        { label: 'Space', value: 'space' },
        { label: 'No separator', value: 'none' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['unwrap'] },
    },
    {
      defaultValue: 'changes',
      id: 'preview',
      label: 'Preview',
      options: [
        { label: 'Changes', value: 'changes' },
        { label: 'Result text', value: 'text' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'wrap-text',
  inputKind: 'optionalText',
  keywords: ['wrap', 'unwrap', 'reflow', 'paragraph', 'width', 'grapheme'],
  name: 'Wrap/Unwrap Text',
  outputKind: 'text',
  relatedToolIds: ['text-diff', 'whitespace-cleaner', 'prefix-suffix-lines', 'text-statistics'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runWrapText(fields, text),
  samples: [
    {
      fields: { ...defaults, width: '12' },
      label: 'Wrap plain prose',
      text: 'one two three four five six seven eight',
    },
    {
      fields: { ...defaults, width: '20' },
      label: 'Keep interior spacing',
      text: 'one  two\tthree  \n',
    },
    {
      fields: { ...defaults, spacing: 'collapse', width: '20' },
      label: 'Explicit spacing cleanup',
      text: '  one   two\tthree  \n',
    },
    {
      fields: { ...defaults, width: '10' },
      label: 'Preserve continuation indentation',
      text: '  one two three four\n',
    },
    {
      fields: { ...defaults, longWords: 'break', width: '2' },
      label: 'Grapheme-safe long tokens',
      text: '👨‍👩‍👧‍👦🇨🇿e\u0301👍🏽\n',
    },
    {
      fields: { ...defaults, width: '8' },
      label: 'Keep long URL intact',
      text: 'https://example.test/path',
    },
    {
      fields: { ...defaults, width: '7' },
      label: 'Keep mixed line endings',
      text: 'one two three\r\nfour five\rsix seven\n',
    },
    {
      fields: { ...defaults, mode: 'unwrap' },
      label: 'Join within paragraphs',
      text: 'one\r\ntwo\r\n\r\nthree\nfour\n',
    },
    {
      fields: { ...defaults, mode: 'unwrap', paragraphs: 'join' },
      label: 'Join across blank separators',
      text: 'one\n\ntwo\n',
    },
    {
      fields: { ...defaults, joinWith: 'none', mode: 'unwrap', spacing: 'collapse' },
      label: 'Join fragments without separator',
      text: 'https://example.\n  test/path\n',
    },
    {
      fields: { ...defaults, preview: 'report', width: '10' },
      label: 'Full reflow audit',
      text: 'one two three four\n',
    },
    { fields: { ...defaults }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};

function parseLayoutOptions(fields: Record<string, string>): {
  mode: 'unwrap' | 'wrap';
  options: TextLayoutOptions;
  preview: 'changes' | 'report' | 'text';
} {
  const mode = fields.mode ?? 'wrap';
  const spacing = fields.spacing ?? 'preserve';
  const preview = fields.preview ?? 'changes';

  if (mode !== 'wrap' && mode !== 'unwrap') throw new ToolError('Choose Wrap or Unwrap.');
  if (spacing !== 'preserve' && spacing !== 'collapse')
    throw new ToolError('Choose Preserve spacing or Collapse ASCII spacing.');
  if (preview !== 'changes' && preview !== 'text' && preview !== 'report')
    throw new ToolError('Choose Changes, Result text or JSON audit.');

  const options: TextLayoutOptions = { mode, spacing };

  if (mode === 'wrap') addWrapOptions(options, fields);
  else addUnwrapOptions(options, fields);

  return { mode, options, preview };
}

function addWrapOptions(options: TextLayoutOptions, fields: Record<string, string>): void {
  const width = (fields.width ?? '80').trim();

  if (!/^\d+$/.test(width) || !Number.isSafeInteger(Number(width)))
    throw new ToolError('Wrap width must be a decimal integer from 1 through 1,000 graphemes.');

  const longWords = fields.longWords ?? 'keep';
  const newLine = fields.newLine ?? 'match';

  if (longWords !== 'keep' && longWords !== 'break')
    throw new ToolError('Choose Keep intact or Break by grapheme long tokens.');
  if (newLine !== 'match' && newLine !== 'lf' && newLine !== 'crlf')
    throw new ToolError('Choose Match source, LF or CRLF inserted endings.');

  options.longWords = longWords;
  options.newLine = newLine;
  options.width = Number(width);
}

function addUnwrapOptions(options: TextLayoutOptions, fields: Record<string, string>): void {
  const paragraphs = fields.paragraphs ?? 'keep';
  const joinWith = fields.joinWith ?? 'space';

  if (paragraphs !== 'keep' && paragraphs !== 'join')
    throw new ToolError('Choose Keep paragraphs or Join all lines.');
  if (joinWith !== 'space' && joinWith !== 'none')
    throw new ToolError('Choose Space or No separator when joining.');

  options.joinWith = joinWith;
  options.paragraphs = paragraphs;
}

function compareOrExplain(
  original: string,
  changed: string,
): { comparison?: TextDiffResult; comparisonUnavailable?: string } {
  try {
    return { comparison: withToolError(() => compareTextLines(original, changed)) };
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

function runWrapText(fields: Record<string, string>, text: string): ToolResult {
  const { mode, options, preview } = parseLayoutOptions(fields);
  const result = withToolError(() => layoutText(text, options));
  const { comparison, comparisonUnavailable } = compareOrExplain(text, result.text);
  const report = JSON.stringify(
    { comparison, comparisonUnavailable, options, originalText: text, result },
    null,
    2,
  );
  const textArtifact = {
    base64: encodeBase64Text(result.text),
    fileName: 'reflowed-text.txt',
    mimeType: 'text/plain;charset=utf-8',
  };
  const reportArtifact = {
    base64: encodeBase64Text(report),
    fileName: 'reflow-report.json',
    mimeType: 'application/json;charset=utf-8',
  };

  return {
    artifact: preview === 'report' ? reportArtifact : textArtifact,
    artifacts: [preview === 'report' ? textArtifact : reportArtifact],
    language: preview === 'report' ? 'json' : 'plaintext',
    resultActions: preview === 'report' ? ['copy', 'scratch', 'save'] : undefined,
    summary: `${reflowOutcome(result.text === text, mode)} · ${result.inputLines} → ${result.outputLines} physical lines · ${result.insertedBreaks} inserted breaks · ${result.joinedBreaks} joined breaks.${mode === 'wrap' ? ` Longest line: ${result.longestLineGraphemes} graphemes · ${result.overWidthLines} over-width lines.` : ''}${comparisonUnavailable ? ' Comparison unavailable; exact result and reason are in the audit.' : ''}`,
    text: preview === 'report' ? report : result.text,
    textDiff:
      preview === 'changes' && comparison ? { layout: 'split', rows: comparison.rows } : undefined,
  };
}
