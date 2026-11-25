import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  compareTextLines,
  describeInvisible,
  inspectInvisibleText,
  markInvisibleText,
  type InvisibleOptions,
  type TextDiffLine,
  type TextDiffResult,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

function markedLine(line: TextDiffLine | undefined): TextDiffLine | undefined {
  if (!line) return undefined;

  return { ...line, highlight: undefined, text: markInvisibleText(line.text) };
}

function escapedReport(report: unknown): string {
  return JSON.stringify(report, null, 2).replace(/[^\x00-\x7F]/gu, (character) =>
    describeInvisible(character.codePointAt(0) ?? 0)
      ? character
          .split('')
          .map((unit) => `\\u${unit.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
          .join('')
      : character,
  );
}

const defaults: Record<string, string> = {
  detectionOutput: 'table',
  mode: 'detect',
  removalPreview: 'changes',
  scope: 'common',
};

type InvisibleResult = ReturnType<typeof inspectInvisibleText>;
type ZeroWidthMode = 'detect' | 'remove';

const removalScopes = ['common', 'layout', 'joiners', 'bidi', 'selectors', 'all'] as const;
const comparisonLimitMessage =
  /comparison budget|Ambiguous diff|limited to 100,000 UTF-16 units|limited to 10,000 physical lines/;

function zeroWidthRequest(fields: Record<string, string>): {
  mode: ZeroWidthMode;
  options: InvisibleOptions;
  output: string;
} {
  const mode = fields.mode ?? 'detect';

  if (mode !== 'detect' && mode !== 'remove') throw new ToolError('Choose Detect or Remove.');

  const output =
    mode === 'detect' ? (fields.detectionOutput ?? 'table') : (fields.removalPreview ?? 'changes');

  if (mode === 'detect' && output !== 'table' && output !== 'report')
    throw new ToolError('Choose Character table or JSON audit.');
  if (mode === 'remove' && output !== 'changes' && output !== 'text' && output !== 'report')
    throw new ToolError('Choose Labeled changes, Cleaned text or JSON audit.');

  const options: InvisibleOptions = { mode };

  if (mode === 'remove') {
    const scope = fields.scope ?? 'common';

    if (!removalScopes.some((candidate) => candidate === scope))
      throw new ToolError('Choose a valid removal scope.');

    options.scope = scope as (typeof removalScopes)[number];
  }

  return { mode, options, output };
}

function compareCleanup(
  text: string,
  cleaned: string,
): { comparison?: TextDiffResult; comparisonUnavailable?: string } {
  try {
    return { comparison: withToolError(() => compareTextLines(text, cleaned)) };
  } catch (error) {
    if (!(error instanceof ToolError) || !comparisonLimitMessage.test(error.message)) throw error;

    return { comparisonUnavailable: error.message };
  }
}

function detectionTable(result: InvisibleResult): NonNullable<ToolResult['jsonTable']> {
  return {
    columns: ['Code point', 'Name', 'Group', 'UTF-16 offset', 'Line', 'Column (UTF-16)', 'Context'],
    rows: result.matches.map((match) =>
      [
        match.codePoint,
        match.name,
        match.group,
        match.index,
        match.line,
        match.column,
        match.context,
      ].map((cell) => JSON.stringify(cell)),
    ),
  };
}

function zeroWidthSummary(
  result: InvisibleResult,
  options: InvisibleOptions,
  comparisonUnavailable: string | undefined,
): string {
  const found = `${result.count} declared characters found · ${result.removed} removed · ${result.count - result.removed} retained`;
  const lines = `${result.inputLines} → ${result.outputLines} physical lines`;
  const note =
    options.mode === 'remove'
      ? ` Removal scope: ${options.scope}. Deletion can change text meaning or presentation.`
      : ' Detect does not change source; no findings is not a safety verdict.';

  return `${found} · ${lines} · positions refer to original UTF-16 source.${note}${result.lineStructureChanged ? ' Warning: deletion changed CR/LF boundaries or terminal empty-line representation.' : ''}${comparisonUnavailable ? ' Comparison unavailable; exact result and reason are in the audit.' : ''}`;
}

function runZeroWidthDetector(fields: Record<string, string>, text: string): ToolResult {
  const { mode, options, output } = zeroWidthRequest(fields);
  const result = withToolError(() => inspectInvisibleText(text, options));
  const { comparison, comparisonUnavailable } =
    mode === 'remove' ? compareCleanup(text, result.text) : {};
  const report = escapedReport({
    comparison,
    comparisonUnavailable,
    options,
    originalText: text,
    result,
  });
  const reportArtifact = {
    base64: encodeBase64Text(report),
    fileName: 'invisible-characters.json',
    mimeType: 'application/json;charset=utf-8',
  };
  const textArtifact = {
    base64: encodeBase64Text(result.text),
    fileName: 'cleaned-invisibles.txt',
    mimeType: 'text/plain;charset=utf-8',
  };
  const showReport = mode === 'detect' || output === 'report';

  return {
    artifact: showReport ? reportArtifact : textArtifact,
    artifacts: mode === 'remove' ? [showReport ? textArtifact : reportArtifact] : undefined,
    jsonTable: mode === 'detect' && output === 'table' ? detectionTable(result) : undefined,
    language: showReport ? 'json' : 'plaintext',
    resultActions: showReport
      ? ['copy', 'scratch', 'save']
      : ['copy', 'replace', 'insert', 'scratch', 'save'],
    summary: zeroWidthSummary(result, options, comparisonUnavailable),
    text: showReport ? report : result.text,
    textDiff:
      mode === 'remove' && output === 'changes' && comparison
        ? {
            layout: 'split',
            rows: comparison.rows.map((row) => ({
              ...row,
              after: markedLine(row.after),
              before: markedLine(row.before),
            })),
          }
        : undefined,
  };
}

export const zeroWidthDetectorTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Inspect a documented set of invisible/formatting Unicode characters by name and source position, then remove only explicitly selected groups.',
  fields: [
    {
      defaultValue: 'detect',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Detect', value: 'detect' },
        { label: 'Remove', value: 'remove' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'table',
      id: 'detectionOutput',
      label: 'Detection output',
      options: [
        { label: 'Character table', value: 'table' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', isNot: ['remove'] },
    },
    {
      defaultValue: 'common',
      help: 'Detection always reports the whole declared set. This only chooses deletion: common = ZWSP/BOM; layout adds SHY/WJ; joiners changes shaping; selectors includes variation selectors and tags; all includes mathematical controls too.',
      id: 'scope',
      label: 'Removal scope',
      options: [
        { label: 'ZWSP + BOM only', value: 'common' },
        { label: 'Break/layout controls', value: 'layout' },
        { label: 'Joining controls', value: 'joiners' },
        { label: 'Bidi controls', value: 'bidi' },
        { label: 'Variation selectors + tags', value: 'selectors' },
        { label: 'All detected characters', value: 'all' },
      ],
      type: 'select',
      visibleWhen: { field: 'mode', is: ['remove'] },
    },
    {
      defaultValue: 'changes',
      help: 'Changes labels detected characters as [ZWSP], [ZWJ], [VS16], etc. Those labels are preview-only; the TXT is the actual cleaned source.',
      id: 'removalPreview',
      label: 'Removal preview',
      options: [
        { label: 'Labeled changes', value: 'changes' },
        { label: 'Cleaned text', value: 'text' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['remove'] },
    },
  ],
  id: 'zero-width-detector',
  inputKind: 'optionalText',
  keywords: ['zero-width', 'invisible', 'unicode', 'bidi', 'bom', 'joiner', 'variation selector'],
  name: 'Zero-Width Character Detector',
  outputKind: 'json',
  relatedToolIds: ['strip-diacritics', 'whitespace-cleaner', 'text-diff', 'text-statistics'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => runZeroWidthDetector(fields, text),
  samples: [
    { fields: { ...defaults }, label: 'Find a zero-width space', text: 'zero\u200Bwidth' },
    { fields: { ...defaults }, label: 'Emoji before hidden character', text: '😀\u200Bx' },
    { fields: { ...defaults }, label: 'Leading BOM', text: '\uFEFFhello\n' },
    { fields: { ...defaults }, label: 'Meaningful emoji joiners', text: '👨‍👩‍👧‍👦 ♥️' },
    {
      fields: { ...defaults },
      label: 'Bidi display controls',
      text: 'name\u202Etxt\u202C\n\u2066isolated\u2069',
    },
    {
      fields: { ...defaults },
      label: 'Soft hyphen and word joiner',
      text: 'hy\u00ADphen\nword\u2060joiner',
    },
    {
      fields: { ...defaults },
      label: 'Supplementary selector and tags',
      text: '𠀀\u{E0100} 🏴\u{E0067}\u{E0062}\u{E007F}',
    },
    {
      fields: { ...defaults, mode: 'remove' },
      label: 'Targeted cleanup keeps emoji',
      text: '\uFEFFzero\u200Bwidth 👨‍👩‍👧‍👦 ♥️\n',
    },
    {
      fields: { ...defaults, mode: 'remove', scope: 'joiners' },
      label: 'Explicit joiner removal',
      text: '👨‍👩‍👧‍👦',
    },
    {
      fields: { ...defaults, mode: 'remove' },
      label: 'Preserve mixed line endings',
      text: 'one\u200B\r\ntwo\uFEFF\rthree\n',
    },
    { fields: { ...defaults, mode: 'remove' }, label: 'Remove to empty', text: '\u200B\uFEFF' },
    { fields: { ...defaults }, label: 'No declared controls', text: 'plain text\n' },
    { fields: { ...defaults }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};
