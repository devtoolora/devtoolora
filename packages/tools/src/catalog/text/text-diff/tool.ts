import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { compareTextLines, formatTextDiff } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

export const textDiffTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Align two texts by actual line changes, inspect both versions and export a complete comparison report.',
  fields: [
    { defaultValue: '', id: 'left', label: 'Before text', rows: 8, type: 'textarea' },
    { defaultValue: '', id: 'right', label: 'After text', rows: 8, type: 'textarea' },
    {
      defaultValue: 'split',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Side by side', value: 'split' },
        { label: 'Unified view', value: 'unified' },
        { label: 'JSON report', value: 'json' },
        { label: 'Readable report', value: 'text' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'false',
      help: 'Trim leading/trailing spaces and tabs and collapse interior runs for comparison only.',
      id: 'ignoreWhitespace',
      label: 'Ignore spaces and tabs',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Compare using full Unicode case mapping, so Straße matches STRASSE; no locale-specific or accent folding.',
      id: 'ignoreCase',
      label: 'Ignore letter case',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Treat LF, CRLF, CR and a missing last terminator as equivalent for matching.',
      id: 'ignoreLineEndings',
      label: 'Ignore line endings',
      type: 'checkbox',
    },
  ],
  id: 'text-diff',
  inputKind: 'none',
  keywords: ['diff', 'compare', 'lines', 'before', 'after', 'newline'],
  name: 'Text Diff',
  outputKind: 'json',
  relatedToolIds: ['json-diff', 'text-statistics', 'whitespace-cleaner', 'pdf-compare'],
  requiresInput: false,
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const output = fields.output ?? 'json';

      if (output !== 'split' && output !== 'unified' && output !== 'json' && output !== 'text')
        throw new ToolError('Choose Side by side, Unified view, JSON report or Readable report.');

      function booleanOption(id: string, label: string): boolean {
        const value = fields[id] ?? 'false';

        if (value !== 'true' && value !== 'false')
          throw new ToolError(`${label} must be true or false.`);

        return value === 'true';
      }

      const before = fields.left ?? '';
      const after = fields.right ?? '';
      const result = compareTextLines(before, after, {
        ignoreCase: booleanOption('ignoreCase', 'Ignore letter case'),
        ignoreLineEndings: booleanOption('ignoreLineEndings', 'Ignore line endings'),
        ignoreWhitespace: booleanOption('ignoreWhitespace', 'Ignore spaces and tabs'),
      });
      const report = JSON.stringify({ ...result, after, before }, null, 2);
      const readable = formatTextDiff(result);
      const jsonArtifact = {
        base64: encodeBase64Text(report),
        fileName: 'text-diff.json',
        mimeType: 'application/json;charset=utf-8',
      };
      const textArtifact = {
        base64: encodeBase64Text(readable),
        fileName: 'text-diff.txt',
        mimeType: 'text/plain;charset=utf-8',
      };

      return {
        artifact: output === 'text' ? textArtifact : jsonArtifact,
        artifacts: [output === 'text' ? jsonArtifact : textArtifact],
        language: output === 'text' ? 'text' : 'json',
        summary: `${result.added} added · ${result.removed} removed · ${result.unchanged} matched · ${result.equivalent} equivalent but not identical · ${result.beforeLines} → ${result.afterLines} lines.`,
        text: output === 'text' ? readable : report,
        textDiff:
          output === 'split' || output === 'unified'
            ? { layout: output, rows: result.rows }
            : undefined,
      };
    }),
  samples: [
    {
      fields: {
        ignoreCase: 'false',
        ignoreLineEndings: 'false',
        ignoreWhitespace: 'false',
        left: 'one\nthree\n',
        output: 'split',
        right: 'one\ntwo\nthree\n',
      },
      label: 'Inserted line stays aligned',
    },
    {
      fields: {
        ignoreCase: 'false',
        ignoreLineEndings: 'false',
        ignoreWhitespace: 'false',
        left: 'PORT=3000\nHOST=localhost\nDEBUG=false\n',
        output: 'split',
        right: 'PORT=8080\nHOST=localhost\nDEBUG=true\n',
      },
      label: 'Changed configuration',
    },
    {
      fields: {
        ignoreCase: 'false',
        ignoreLineEndings: 'false',
        ignoreWhitespace: 'false',
        left: 'one\ntwo\nthree\n',
        output: 'unified',
        right: 'one\nthree\n',
      },
      label: 'Removed line',
    },
    {
      fields: {
        ignoreCase: 'false',
        ignoreLineEndings: 'false',
        ignoreWhitespace: 'false',
        left: 'same\r\nlast',
        output: 'split',
        right: 'same\nlast\n',
      },
      label: 'Line endings and final newline',
    },
    {
      fields: {
        ignoreCase: 'true',
        ignoreLineEndings: 'true',
        ignoreWhitespace: 'true',
        left: '  Hello   world \r\n',
        output: 'split',
        right: 'hello world\n',
      },
      label: 'Equivalent under ignore options',
    },
    {
      fields: {
        ignoreCase: 'false',
        ignoreLineEndings: 'false',
        ignoreWhitespace: 'false',
        left: 'Příliš 😀 happy\n',
        output: 'split',
        right: 'Příliš 😃 happy\n',
      },
      label: 'Unicode changed span',
    },
    {
      fields: {
        ignoreCase: 'false',
        ignoreLineEndings: 'false',
        ignoreWhitespace: 'false',
        left: '',
        output: 'split',
        right: 'first\nsecond\n',
      },
      label: 'Empty before text',
    },
    {
      fields: {
        ignoreCase: 'false',
        ignoreLineEndings: 'false',
        ignoreWhitespace: 'false',
        left: '',
        output: 'split',
        right: '',
      },
      label: 'Both texts empty',
    },
  ],
  supportsSelection: false,
};
