import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  adjustIndentation,
  compareTextLines,
  type IndentationOptions,
  type TextDiffResult,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { visibleLine } from '../../../adapters/visibleWhitespace';

const defaults: Record<string, string> = {
  blankLines: 'skip',
  mode: 'indent',
  partial: 'up-to',
  preview: 'visible',
  spaces: '2',
  unit: 'spaces',
};

export const indentDedentTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Add or remove literal space/tab indentation, optionally remove a shared prefix, and inspect visible whitespace without normalizing line endings.',
  fields: [
    {
      defaultValue: 'indent',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Indent', value: 'indent' },
        { label: 'Dedent', value: 'dedent' },
        { label: 'Remove common prefix', value: 'common' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'spaces',
      help: 'Counts literal ASCII characters, not display columns. Space mode never removes a tab; Tab mode never removes a space.',
      id: 'unit',
      label: 'Indentation unit',
      options: [
        { label: 'Spaces', value: 'spaces' },
        { label: 'Tabs', value: 'tabs' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', isNot: ['common'] },
    },
    {
      defaultValue: '2',
      help: 'Integer 0–64 characters of the selected unit. Zero is a valid no-op. The legacy field identifier remains spaces for saved drafts.',
      id: 'spaces',
      label: 'Amount',
      type: 'number',
      visibleWhen: { field: 'mode', isNot: ['common'] },
    },
    {
      defaultValue: 'up-to',
      help: 'Up to removes a consecutive leading run of the chosen character, bounded by Amount. Exact requires the whole requested prefix; it never removes a partial match.',
      id: 'partial',
      label: 'Shorter indentation',
      options: [
        { label: 'Up to amount', value: 'up-to' },
        { label: 'Exact amount', value: 'exact' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['dedent'] },
    },
    {
      defaultValue: 'skip',
      help: 'Blank means empty or only ASCII spaces/tabs. Skip preserves these rows exactly. Common-prefix detection always excludes blanks; Include changes a blank only if the detected prefix matches exactly.',
      id: 'blankLines',
      label: 'Blank lines',
      options: [
        { label: 'Skip', value: 'skip' },
        { label: 'Include', value: 'include' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'visible',
      help: 'Preview-only markers: · is space, ↹ is tab, ⍽ is NBSP/narrow NBSP. Changes shows raw glyphs. Copy and TXT export always use actual transformed text.',
      id: 'preview',
      label: 'Preview',
      options: [
        { label: 'Visible whitespace', value: 'visible' },
        { label: 'Changes', value: 'changes' },
        { label: 'Result text', value: 'text' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'indent-dedent',
  inputKind: 'optionalText',
  keywords: ['indent', 'dedent', 'spaces', 'tabs', 'common prefix', 'whitespace'],
  name: 'Indent/Dedent Text',
  outputKind: 'text',
  relatedToolIds: ['whitespace-cleaner', 'prefix-suffix-lines', 'wrap-text', 'text-diff'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runIndentation(fields, text),
  samples: [
    { fields: { ...defaults }, label: 'Indent with two spaces', text: 'one\ntwo\n' },
    {
      fields: { ...defaults, spaces: '1', unit: 'tabs' },
      label: 'Indent with a tab',
      text: 'one\ntwo',
    },
    {
      fields: { ...defaults, mode: 'dedent' },
      label: 'Remove up to two spaces',
      text: ' one\n  two\n\tthree\n',
    },
    {
      fields: { ...defaults, mode: 'dedent', partial: 'exact' },
      label: 'Require exactly two spaces',
      text: ' one\n  two\n\tthree\n',
    },
    {
      fields: { ...defaults, mode: 'dedent', spaces: '1', unit: 'tabs' },
      label: 'Dedent tabs without touching spaces',
      text: '\tone\n  two\n\t\tthree',
    },
    {
      fields: { ...defaults, mode: 'common' },
      label: 'Remove shared prefix',
      text: '  one\n    two\n  three\n',
    },
    {
      fields: { ...defaults, mode: 'common' },
      label: 'Mixed indentation has no shared prefix',
      text: '\t one\n  two\n',
    },
    {
      fields: { ...defaults, blankLines: 'include' },
      label: 'Include real blank rows',
      text: 'one\n\n \ntwo\n',
    },
    { fields: { ...defaults }, label: 'Keep mixed line endings', text: 'one\r\ntwo\rthree\n' },
    {
      fields: { ...defaults, blankLines: 'include', mode: 'dedent' },
      label: 'Dedent to empty',
      text: '  ',
    },
    {
      fields: { ...defaults, spaces: '0' },
      label: 'Zero amount is a no-op',
      text: '  one\n\ttwo\n',
    },
    {
      fields: { ...defaults, mode: 'common', preview: 'report' },
      label: 'Full indentation audit',
      text: '\t one\n\t  two\n',
    },
    { fields: { ...defaults }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};

type IndentPreview = 'changes' | 'report' | 'text' | 'visible';

function parseIndentationOptions(fields: Record<string, string>): {
  options: IndentationOptions;
  preview: IndentPreview;
} {
  const mode = fields.mode ?? 'indent';
  const blankLines = fields.blankLines ?? 'skip';
  const preview = fields.preview ?? 'visible';

  if (mode !== 'indent' && mode !== 'dedent' && mode !== 'common')
    throw new ToolError('Choose Indent, Dedent or Remove common prefix.');
  if (blankLines !== 'skip' && blankLines !== 'include')
    throw new ToolError('Choose Skip or Include blank lines.');
  if (preview !== 'visible' && preview !== 'changes' && preview !== 'text' && preview !== 'report')
    throw new ToolError('Choose Visible whitespace, Changes, Result text or JSON audit.');

  const options: IndentationOptions = { blankLines, mode };

  if (mode !== 'common') addAmountOptions(options, fields);

  return { options, preview };
}

function addAmountOptions(options: IndentationOptions, fields: Record<string, string>): void {
  const amount = (fields.spaces ?? '2').trim();
  const unit = fields.unit ?? 'spaces';

  if (!/^\d+$/.test(amount) || !Number.isSafeInteger(Number(amount)))
    throw new ToolError('Amount must be a decimal integer from 0 through 64.');
  if (unit !== 'spaces' && unit !== 'tabs') throw new ToolError('Choose Spaces or Tabs.');

  options.amount = Number(amount);
  options.unit = unit;

  if (options.mode === 'dedent') {
    const partial = fields.partial ?? 'up-to';

    if (partial !== 'exact' && partial !== 'up-to')
      throw new ToolError('Choose Up to amount or Exact amount.');

    options.partial = partial;
  }
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

function runIndentation(fields: Record<string, string>, text: string): ToolResult {
  const { options, preview } = parseIndentationOptions(fields);
  const result = withToolError(() => adjustIndentation(text, options));
  const { comparison, comparisonUnavailable } = compareOrExplain(text, result.text);
  const rows = comparison?.rows.map((row) =>
    preview === 'visible'
      ? { ...row, after: visibleLine(row.after), before: visibleLine(row.before) }
      : row,
  );
  const report = JSON.stringify(
    { comparison, comparisonUnavailable, options, originalText: text, result },
    null,
    2,
  );
  const textArtifact = {
    base64: encodeBase64Text(result.text),
    fileName: 'indented-text.txt',
    mimeType: 'text/plain;charset=utf-8',
  };
  const reportArtifact = {
    base64: encodeBase64Text(report),
    fileName: 'indentation-report.json',
    mimeType: 'application/json;charset=utf-8',
  };

  return {
    artifact: preview === 'report' ? reportArtifact : textArtifact,
    artifacts: [preview === 'report' ? textArtifact : reportArtifact],
    language: preview === 'report' ? 'json' : 'plaintext',
    resultActions: preview === 'report' ? ['copy', 'scratch', 'save'] : undefined,
    summary: `${result.changedLines === 0 ? 'Unchanged' : 'Indentation updated'} · ${result.inputLines} → ${result.outputLines} physical lines · ${result.changedLines} changed lines · spaces +${result.spacesAdded}/−${result.spacesRemoved} · tabs +${result.tabsAdded}/−${result.tabsRemoved} · ${result.skippedBlankLines} blank lines skipped.${options.mode === 'common' ? ` Shared prefix: ${result.commonPrefix?.length ?? 0} literal characters; exact prefix in audit.` : ''}${result.lineStructureChanged ? ' Warning: empty bodies changed CR/LF boundaries or terminal empty-line representation.' : ''}${comparisonUnavailable ? ' Comparison unavailable; exact result and reason are in the audit.' : ''}`,
    text: preview === 'report' ? report : result.text,
    textDiff:
      (preview === 'visible' || preview === 'changes') && rows
        ? { layout: 'split', rows }
        : undefined,
  };
}
