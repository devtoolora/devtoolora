import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { convertCase, isTextCase } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { checkbox } from '../shared';

export const caseConvertTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Convert text without losing punctuation, or build identifiers with Unicode-aware acronym boundaries.',
  fields: [
    {
      defaultValue: 'camel',
      id: 'case',
      label: 'Target case',
      options: [
        { label: 'camelCase', value: 'camel' },
        { label: 'PascalCase', value: 'pascal' },
        { label: 'snake_case', value: 'snake' },
        { label: 'kebab-case', value: 'kebab' },
        { label: 'CONSTANT_CASE', value: 'constant' },
        { label: 'Title Case', value: 'title' },
        { label: 'lower case', value: 'lower' },
        { label: 'UPPER CASE', value: 'upper' },
        { label: 'Sentence case', value: 'sentence' },
        { label: 'aLtErNaTiNg cAsE', value: 'alternating' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'default',
      id: 'locale',
      label: 'Case rules',
      options: [
        { label: 'Default Unicode', value: 'default' },
        { label: 'Turkish', value: 'tr' },
        { label: 'Azerbaijani', value: 'az' },
        { label: 'Lithuanian', value: 'lt' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: 'Identifier modes only; display modes always keep accents.',
      id: 'removeAccents',
      label: 'Remove Latin accents',
      type: 'checkbox',
      visibleWhen: { field: 'case', is: ['camel', 'pascal', 'snake', 'kebab', 'constant'] },
    },
  ],
  id: 'case-convert',
  inputKind: 'optionalText',
  keywords: ['camelcase', 'pascalcase', 'snakecase', 'uppercase', 'unicode', 'acronym'],
  name: 'Case Converter',
  outputKind: 'text',
  relatedToolIds: ['slugify', 'strip-diacritics', 'text-statistics'],
  requiresInput: false,
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const target = fields.case ?? 'camel';
      const locale = fields.locale ?? 'default';

      if (!isTextCase(target)) throw new ToolError('Choose a supported target case.');
      if (locale !== 'default' && locale !== 'tr' && locale !== 'az' && locale !== 'lt')
        throw new ToolError('Choose a supported case-rule locale.');

      const output = convertCase(text, target, {
        locale,
        removeAccents: checkbox(fields, 'removeAccents', 'Remove Latin accents'),
      });

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: 'converted-case.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: `${target} · ${locale === 'default' ? 'default Unicode rules' : locale + ' locale rules'} · ${[...output].length} output code points${output ? '' : ' · empty result'}.`,
        text: output,
      };
    }),
  samples: [
    {
      fields: { case: 'camel', locale: 'default', removeAccents: 'true' },
      label: 'Camel case',
      text: 'user profile settings API',
    },
    {
      fields: { case: 'kebab', locale: 'default', removeAccents: 'true' },
      label: 'Kebab case',
      text: 'parseJSONPayloadResponse',
    },
    {
      fields: { case: 'constant', locale: 'default', removeAccents: 'true' },
      label: 'Constant case',
      text: 'maximum retry limit count',
    },
    {
      fields: { case: 'snake', locale: 'default', removeAccents: 'true' },
      label: 'Acronyms and numeric word parts',
      text: 'XMLHttpRequest version2Value API_response-code',
    },
    {
      fields: { case: 'upper', locale: 'default', removeAccents: 'true' },
      label: 'Preserve punctuation and line endings',
      text: 'Příliš žluťoučký, world!\r\nNext line: Straße 42.',
    },
    {
      fields: { case: 'lower', locale: 'tr', removeAccents: 'false' },
      label: 'Turkish dotted and dotless I',
      text: 'İSTANBUL I',
    },
    {
      fields: { case: 'camel', locale: 'default', removeAccents: 'false' },
      label: 'Unicode identifiers with accents',
      text: 'příliš žluťoučký नमस्ते दुनिया',
    },
    {
      fields: { case: 'title', locale: 'default', removeAccents: 'true' },
      label: 'Mechanical title case',
      text: "DON’T PANIC — this ISN'T A STYLE GUIDE.\nhello-world",
    },
    {
      fields: { case: 'alternating', locale: 'default', removeAccents: 'true' },
      label: 'Alternate letters not spaces',
      text: 'ab 42 😀 cd',
    },
  ],
  supportsSelection: true,
};
