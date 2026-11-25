import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  cleanWhitespaceDetailed,
  compareTextLines,
  type TextDiffResult,
  type WhitespaceOptions,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { visibleLine } from '../../../adapters/visibleWhitespace';
import { checkbox } from '../shared';

const safeFields: Record<string, string> = {
  collapseBlankLines: 'true',
  collapseSpaces: 'false',
  lineEndings: 'preserve',
  normalizeUnicodeSpaces: 'false',
  preview: 'visible',
  trimLines: 'false',
  trimText: 'false',
  trimTrailing: 'true',
};

export const whitespaceCleanerTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Clean spacing with explicit controls, preserve indentation and line endings, and inspect invisible changes before exporting.',
  fields: [
    {
      defaultValue: 'true',
      help: 'Remove ASCII spaces and tabs at the end of each physical line. Markdown uses two trailing spaces for a hard break.',
      id: 'trimTrailing',
      label: 'Remove trailing spaces and tabs',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Destructive for indented code: remove ASCII spaces and tabs from both ends of every line.',
      id: 'trimLines',
      label: 'Trim both ends of each line',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Collapse interior runs to one ordinary space. Leading indentation remains unless line trimming is enabled.',
      id: 'collapseSpaces',
      label: 'Collapse interior spaces and tabs',
      type: 'checkbox',
    },
    {
      defaultValue: 'true',
      help: 'Keep at most one consecutive line containing only ASCII spaces and tabs. Does not join nonblank lines.',
      id: 'collapseBlankLines',
      label: 'Limit consecutive blank lines',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Trim Unicode whitespace from the edges of the entire result, including outer newlines and first-line indentation.',
      id: 'trimText',
      label: 'Trim whole-text edges',
      type: 'checkbox',
    },
    {
      defaultValue: 'preserve',
      help: 'Preserve retains mixed terminators too. LF and CRLF convert existing terminators only.',
      id: 'lineEndings',
      label: 'Line endings',
      options: [
        { label: 'Preserve', value: 'preserve' },
        { label: 'LF', value: 'lf' },
        { label: 'CRLF', value: 'crlf' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'false',
      help: 'Explicitly convert Unicode horizontal spaces, including NBSP and narrow NBSP, to ordinary spaces. This removes their no-break behavior.',
      id: 'normalizeUnicodeSpaces',
      label: 'Normalize Unicode spaces',
      type: 'checkbox',
    },
    {
      defaultValue: 'visible',
      help: 'Markers are preview-only: · means ASCII space, ↹ means tab, ⍽ means NBSP or narrow NBSP. JSON report exports the full audit instead of just cleaned text.',
      id: 'preview',
      label: 'Preview',
      options: [
        { label: 'Visible whitespace', value: 'visible' },
        { label: 'Changes', value: 'changes' },
        { label: 'Cleaned text', value: 'text' },
        { label: 'JSON report', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'whitespace-cleaner',
  inputKind: 'optionalText',
  keywords: ['spaces', 'tabs', 'whitespace', 'indentation', 'trim', 'line-endings'],
  name: 'Whitespace Cleaner',
  outputKind: 'text',
  relatedToolIds: ['text-diff', 'text-statistics', 'indent-dedent', 'zero-width-detector'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runWhitespaceCleaner(fields, text),
  samples: [
    {
      fields: { ...safeFields },
      label: 'Preserve code indentation',
      text: 'function greet() {  \n\tconsole.log("Hello"); \n}\n',
    },
    {
      fields: { ...safeFields, collapseSpaces: 'true', trimLines: 'true', trimText: 'true' },
      label: 'Clean pasted prose',
      text: '  hello    world  \n\n \t\n\n  local   tools  ',
    },
    {
      fields: { ...safeFields, trimTrailing: 'false' },
      label: 'Keep Markdown hard breaks',
      text: 'First line  \nSecond line\n',
    },
    {
      fields: { ...safeFields, lineEndings: 'lf' },
      label: 'Normalize mixed CRLF and CR to LF',
      text: 'one\r\ntwo\rthree\n',
    },
    {
      fields: { ...safeFields, normalizeUnicodeSpaces: 'true' },
      label: 'Normalize non-breaking spaces',
      text: 'hello\u00A0world\n1\u202F000\n',
    },
    {
      fields: { ...safeFields, trimText: 'true' },
      label: 'Whitespace-only becomes empty',
      text: ' \t\r\n\r\n',
    },
    { fields: { ...safeFields }, label: 'Empty input is valid', text: '' },
    {
      fields: { ...safeFields, preview: 'report' },
      label: 'Full audit report',
      text: '  one  \r\n\ttwo \r\n',
    },
  ],
  supportsSelection: true,
  freshResults: true,
};

function parseWhitespaceOptions(fields: Record<string, string>): {
  options: WhitespaceOptions;
  preview: 'changes' | 'report' | 'text' | 'visible';
} {
  const endings = fields.lineEndings ?? 'preserve';

  if (endings !== 'preserve' && endings !== 'lf' && endings !== 'crlf')
    throw new ToolError('Choose Preserve, LF or CRLF line endings.');

  const preview = fields.preview ?? 'visible';

  if (preview !== 'visible' && preview !== 'changes' && preview !== 'text' && preview !== 'report')
    throw new ToolError('Choose Visible whitespace, Changes, Cleaned text or JSON report.');

  return {
    options: {
      collapseBlankLines: checkbox(
        fields,
        'collapseBlankLines',
        'Limit consecutive blank lines',
        true,
      ),
      collapseSpaces: checkbox(
        fields,
        'collapseSpaces',
        'Collapse interior spaces and tabs',
        false,
      ),
      lineEndings: endings,
      normalizeUnicodeSpaces: checkbox(
        fields,
        'normalizeUnicodeSpaces',
        'Normalize Unicode spaces',
        false,
      ),
      trimLines: checkbox(fields, 'trimLines', 'Trim both ends of each line', false),
      trimText: checkbox(fields, 'trimText', 'Trim whole-text edges', false),
      trimTrailing: checkbox(fields, 'trimTrailing', 'Remove trailing spaces and tabs', true),
    },
    preview,
  };
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
      !/comparison budget|Ambiguous diff|Each text is limited to 100,000 UTF-16 units/.test(
        error.message,
      )
    )
      throw error;

    return { comparisonUnavailable: error.message };
  }
}

function runWhitespaceCleaner(fields: Record<string, string>, text: string): ToolResult {
  const { options, preview } = parseWhitespaceOptions(fields);
  const result = withToolError(() => cleanWhitespaceDetailed(text, options));
  const { comparison, comparisonUnavailable } = compareOrExplain(text, result.text);
  const rows = comparison?.rows.map((row) =>
    preview === 'visible'
      ? { ...row, after: visibleLine(row.after), before: visibleLine(row.before) }
      : row,
  );
  const report = JSON.stringify(
    {
      after: result.after,
      before: result.before,
      changed: result.changed,
      cleanedText: result.text,
      comparison,
      comparisonUnavailable,
      options,
      originalText: text,
    },
    null,
    2,
  );
  const textArtifact = {
    base64: encodeBase64Text(result.text),
    fileName: 'cleaned-text.txt',
    mimeType: 'text/plain;charset=utf-8',
  };
  const reportArtifact = {
    base64: encodeBase64Text(report),
    fileName: 'whitespace-report.json',
    mimeType: 'application/json;charset=utf-8',
  };

  return {
    artifact: preview === 'report' ? reportArtifact : textArtifact,
    artifacts: [preview === 'report' ? textArtifact : reportArtifact],
    language: preview === 'report' ? 'json' : 'plaintext',
    resultActions: preview === 'report' ? ['copy', 'scratch', 'save'] : undefined,
    summary: `${result.changed ? 'Changed' : 'Unchanged'} · ${result.before.codePoints} → ${result.after.codePoints} code points · ${result.before.spaces} → ${result.after.spaces} ASCII spaces · ${result.before.tabs} → ${result.after.tabs} tabs.${comparisonUnavailable ? ' Comparison unavailable; exact cleaned text and reason are in the report.' : ''}`,
    text: preview === 'report' ? report : result.text,
    textDiff:
      (preview === 'visible' || preview === 'changes') && rows
        ? { layout: 'split', rows }
        : undefined,
  };
}
