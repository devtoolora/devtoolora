import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { testRegex } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

export const regexTestTool: ToolDefinition = {
  capabilities: ['browserWorker', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Inspect JavaScript regex matches, capture groups and replacements with explicit flags and an isolated execution limit.',
  fields: [
    {
      defaultValue: 'visual',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Visual matches', value: 'visual' },
        { label: 'JSON report', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '\\w+',
      help: 'Pattern source only, without surrounding / delimiters. Empty patterns and literal spaces are valid.',
      id: 'pattern',
      label: 'Pattern',
      type: 'textarea',
    },
    {
      defaultValue: 'g',
      help: 'Unique flags: d g i m s u v y. No flags means first match; flags are never added silently.',
      id: 'flags',
      label: 'Flags',
      type: 'text',
    },
    {
      defaultValue: 'false',
      id: 'previewReplacement',
      label: 'Preview replacement',
      type: 'checkbox',
    },
    {
      defaultValue: '',
      help: "Empty means remove matches when preview is enabled. Supports $$, $&, $1–$99, $<name>, $` and $'. No replacement code is executed.",
      id: 'replacement',
      label: 'Replacement text',
      type: 'textarea',
      visibleWhen: { field: 'previewReplacement', is: ['true'] },
    },
  ],
  badge: { accent: 'calibration', glyph: '.*' },
  id: 'regex-test',
  inputKind: 'optionalText',
  keywords: ['regex', 'regexp', 'capture', 'named groups', 'replacement', 'javascript'],
  name: 'Regex Tester',
  outputKind: 'json',
  relatedToolIds: ['find-replace', 'text-statistics', 'regex-explainer'],
  requiresInput: false,
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = fields.output ?? 'json';

      if (output !== 'json' && output !== 'visual')
        throw new ToolError('Choose Visual matches or JSON report.');

      const preview = fields.previewReplacement ?? (fields.replacement ? 'true' : 'false');

      if (preview !== 'true' && preview !== 'false')
        throw new ToolError('Preview replacement must be true or false.');

      const result = testRegex(
        text,
        fields.pattern ?? '',
        fields.flags ?? 'g',
        preview === 'true' ? (fields.replacement ?? '') : undefined,
      );
      const report = JSON.stringify({ ...result, source: text }, null, 2);
      const replacement = result.replacementPreview;

      if (replacement !== undefined && /[\uD800-\uDFFF]/u.test(replacement)) {
        throw new ToolError(
          'Replacement produced unpaired Unicode surrogates and cannot be exported exactly as UTF-8. Use the u or v flag to match complete Unicode code points.',
        );
      }

      return {
        artifact: {
          base64: encodeBase64Text(report),
          fileName: 'regex-report.json',
          mimeType: 'application/json;charset=utf-8',
        },
        artifacts:
          replacement !== undefined
            ? [
                {
                  base64: encodeBase64Text(replacement),
                  fileName: 'replaced.txt',
                  mimeType: 'text/plain;charset=utf-8',
                },
              ]
            : undefined,
        language: 'json',
        regex:
          output === 'visual'
            ? { matches: result.matches, replacementPreview: replacement, source: text }
            : undefined,
        summary: `${result.count} ${result.count === 1 ? 'match' : 'matches'} · flags: ${result.flags || '(none)'} · positions in UTF-16 units${replacement !== undefined ? ' · replacement preview enabled' : ''}.`,
        text: report,
      };
    }),
  samples: [
    {
      fields: {
        flags: 'g',
        output: 'visual',
        pattern: '[\\w.-]+@[\\w.-]+\\.\\w+',
        previewReplacement: 'true',
        replacement: '[$&]',
      },
      label: 'Match email-shaped strings',
      text: 'Contact support@example.test or admin@test.org.',
    },
    {
      fields: {
        flags: 'g',
        output: 'visual',
        pattern: '(?<key>\\w+)=(?<value>\\w+)',
        previewReplacement: 'true',
        replacement: '$<key>: "$<value>"',
      },
      label: 'Named key-value groups',
      text: 'PORT=3000\nHOST=localhost\nDEBUG=true',
    },
    {
      fields: {
        flags: '',
        output: 'visual',
        pattern: '\\d+',
        previewReplacement: 'false',
        replacement: '',
      },
      label: 'Only the first match',
      text: 'first 12, second 34, third 56',
    },
    {
      fields: {
        flags: 'g',
        output: 'visual',
        pattern: '(a)?(b)',
        previewReplacement: 'false',
        replacement: '',
      },
      label: 'Optional unmatched captures',
      text: 'b ab',
    },
    {
      fields: {
        flags: 'gu',
        output: 'visual',
        pattern: '(?=😀)|$',
        previewReplacement: 'true',
        replacement: '|',
      },
      label: 'Unicode zero-width matches',
      text: '😀😀',
    },
    {
      fields: {
        flags: 'gm',
        output: 'visual',
        pattern: '^ERROR: (?<message>.*)$',
        previewReplacement: 'false',
        replacement: '',
      },
      label: 'Multiline log anchors',
      text: 'INFO: started\nERROR: failed\nINFO: retry\nERROR: stopped',
    },
    {
      fields: {
        flags: 'g',
        output: 'visual',
        pattern: '\\d+',
        previewReplacement: 'true',
        replacement: '',
      },
      label: 'Empty replacement removes matches',
      text: 'keep 123 text 456',
    },
    {
      fields: {
        flags: 'g',
        output: 'json',
        pattern: 'z+',
        previewReplacement: 'false',
        replacement: '',
      },
      label: 'No matches',
      text: 'nothing found',
    },
  ],
  supportsSelection: true,
  isolatedWorker: true,
};
