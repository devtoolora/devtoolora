import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { processJsonDocument } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';

export const jsonFormatTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description:
    'Format, minify or validate JSON without rounding numbers, rewriting strings or dropping duplicate keys.',
  fields: [
    {
      defaultValue: 'format',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Format', value: 'format' },
        { label: 'Minify', value: 'minify' },
        { label: 'Validate', value: 'validate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '2',
      help: 'Used only in Format mode.',
      id: 'indentation',
      label: 'Indentation',
      options: [
        { label: '2 spaces', value: '2' },
        { label: '4 spaces', value: '4' },
        { label: 'Tabs', value: 'tab' },
      ],
      type: 'select',
      visibleWhen: { field: 'mode', is: ['format'] },
    },
    {
      defaultValue: 'lf',
      help: 'Used only in Format mode; escaped newlines inside strings stay unchanged.',
      id: 'lineEnding',
      label: 'Line endings',
      options: [
        { label: 'LF', value: 'lf' },
        { label: 'CRLF', value: 'crlf' },
      ],
      type: 'select',
      visibleWhen: { field: 'mode', is: ['format'] },
    },
  ],
  badge: { accent: 'signal', glyph: '{ }' },
  id: 'json-format',
  inputKind: 'text',
  keywords: [
    'json',
    'json formatter',
    'json minify',
    'json validate',
    'json-minify',
    'json-validate',
    'beautifier',
    'pretty print',
    'lossless',
    'duplicate keys',
  ],
  name: 'JSON Format',
  outputKind: 'json',
  relatedToolIds: ['json-tree', 'json-query', 'json-diff', 'json-schema-validator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'format';
      const indentation = fields.indentation ?? '2';
      const lineEnding = fields.lineEnding ?? 'lf';

      if (mode !== 'format' && mode !== 'minify' && mode !== 'validate')
        throw new ToolError('Choose Format, Minify or Validate.');
      if (indentation !== '2' && indentation !== '4' && indentation !== 'tab')
        throw new ToolError('Choose 2 spaces, 4 spaces or tabs.');
      if (lineEnding !== 'lf' && lineEnding !== 'crlf')
        throw new ToolError('Choose LF or CRLF line endings.');

      const output = processJsonDocument(text, { indentation, lineEnding, mode });
      const report = output.report;
      const warnings = report.duplicateKeys + report.numbersOutsideSafeRange;
      const rendered =
        mode === 'validate'
          ? [
              'Valid JSON',
              `Type: ${report.rootType}`,
              `Values: ${report.values}`,
              `Objects: ${report.objects}`,
              `Arrays: ${report.arrays}`,
              `Maximum container depth: ${report.maxDepth}`,
              `Duplicate keys: ${report.duplicateKeys}`,
              `Numbers outside JavaScript safe range: ${report.numbersOutsideSafeRange}`,
              '',
              warnings
                ? 'Warnings (up to 20 details):'
                : 'No duplicate-key or numeric-range warnings.',
              ...report.warnings,
            ].join('\n')
          : output.text;

      return {
        artifact: {
          base64: encodeBase64Text(rendered),
          fileName: {
            format: 'formatted.json',
            minify: 'minified.json',
            validate: 'json-validation.txt',
          }[mode],
          mimeType:
            mode === 'validate' ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8',
        },
        language: mode === 'validate' ? 'plaintext' : 'json',
        resultActions:
          mode === 'validate'
            ? ['copy', 'scratch', 'save']
            : ['copy', 'replace', 'insert', 'scratch', 'save'],
        summary: `Valid JSON · ${report.rootType} · ${report.values} values · ${warnings} warnings${mode === 'validate' ? '.' : ' · original tokens preserved.'}`,
        text: rendered,
      };
    }),
  samples: [
    {
      fields: { indentation: '2', lineEnding: 'lf', mode: 'format' },
      label: 'Nested API response',
      text: '{"user":{"name":"Ada","active":true},"items":[1,2],"empty":{},"nothing":null}',
    },
    {
      fields: { indentation: '4', lineEnding: 'lf', mode: 'format' },
      label: 'Exact large numbers',
      text: '{"id":9007199254740993,"decimal":1.2300,"negativeZero":-0,"huge":1e400}',
    },
    {
      fields: { indentation: '2', lineEnding: 'lf', mode: 'validate' },
      label: 'Duplicate keys warning',
      text: '{"role":"user","\\u0072ole":"admin","nested":{"ok":true}}',
    },
    {
      fields: { indentation: '2', lineEnding: 'lf', mode: 'minify' },
      label: 'Minify strings and escapes',
      text: '{\n  "message": "Keep spaces and \\n newlines",\n  "unicode": "Příliš žluťoučký 🐎",\n  "escaped": "\\u0061"\n}',
    },
    {
      fields: { indentation: 'tab', lineEnding: 'crlf', mode: 'format' },
      label: 'Tabs and CRLF',
      text: '{"settings":{"enabled":true,"paths":["/api","/health"]}}',
    },
    {
      fields: { indentation: '2', lineEnding: 'lf', mode: 'validate' },
      label: 'Validate root null',
      text: 'null',
    },
  ],
  supportsSelection: true,
};

export const jsonMinifyTool: ToolDefinition = {
  ...jsonFormatTool,
  aliasOf: 'json-format',
  fields: jsonFormatTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'minify' } : field,
  ),
  id: 'json-minify',
  name: 'JSON Minify',
  run: (input) => jsonFormatTool.run({ ...input, fields: { mode: 'minify', ...input.fields } }),
};

export const jsonValidateTool: ToolDefinition = {
  ...jsonFormatTool,
  aliasOf: 'json-format',
  fields: jsonFormatTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'validate' } : field,
  ),
  badge: undefined,
  id: 'json-validate',
  name: 'JSON Validator',
  run: (input) => jsonFormatTool.run({ ...input, fields: { mode: 'validate', ...input.fields } }),
};
