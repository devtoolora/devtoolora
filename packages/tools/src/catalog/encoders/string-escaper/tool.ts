import { ToolDefinition } from '@devtoolora/core';
import { escapeString, unescapeString, type EscapeLanguage } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities, conversionMode } from '../shared';

const languages: readonly EscapeLanguage[] = [
  'json',
  'javascript',
  'java',
  'sql',
  'regex',
  'xml',
  'csv',
  'shell',
];

export const stringEscaperTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Escape or unescape text as a JSON, JavaScript, Java, SQL, regex, XML, CSV or POSIX shell string literal.',
  fields: [
    {
      defaultValue: 'json',
      id: 'language',
      label: 'Language',
      options: [
        { label: 'JSON', value: 'json' },
        { label: 'JavaScript', value: 'javascript' },
        { label: 'Java', value: 'java' },
        { label: 'SQL', value: 'sql' },
        { label: 'Regular expression', value: 'regex' },
        { label: 'XML', value: 'xml' },
        { label: 'CSV field', value: 'csv' },
        { label: 'POSIX shell', value: 'shell' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'encode',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Escape', value: 'encode' },
        { label: 'Unescape', value: 'decode' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'false',
      id: 'quotes',
      label: 'Wrap in quotes',
      type: 'checkbox',
      visibleWhen: [
        { field: 'mode', is: ['encode'] },
        { field: 'language', is: ['json', 'javascript', 'java', 'sql'] },
      ],
    },
  ],
  freshResults: true,
  id: 'string-escaper',
  inputKind: 'text',
  keywords: [
    'escape',
    'unescape',
    'string',
    'json',
    'javascript',
    'java',
    'sql',
    'regex',
    'xml',
    'csv',
    'shell',
    'quote',
    'backslash',
  ],
  name: 'String Escaper',
  outputKind: 'text',
  relatedToolIds: ['unicode-escape', 'html-entities', 'url-encode', 'json-format'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const language = choiceField(
        fields.language,
        'json',
        languages,
        'Choose JSON, JavaScript, Java, SQL, Regular expression, XML, CSV or POSIX shell.',
      );
      const mode = conversionMode(fields);
      const output =
        mode === 'decode'
          ? unescapeString(text, language)
          : escapeString(text, language, { quotes: booleanField(fields.quotes, false) });

      return {
        language: 'plaintext',
        summary: `${mode === 'decode' ? 'unescape' : 'escape'} · ${language} · ${text.length} ${text.length === 1 ? 'character' : 'characters'}`,
        text: output,
      };
    }),
  samples: [
    {
      fields: { language: 'json', mode: 'encode', quotes: 'true' },
      label: 'JSON string with quotes',
      text: 'He said "hi"\n\tok',
    },
    {
      fields: { language: 'javascript', mode: 'encode' },
      label: 'JavaScript single quote',
      text: "it's a path: C:\\temp",
    },
    { fields: { language: 'sql', mode: 'encode' }, label: 'SQL literal', text: "O'Reilly" },
    {
      fields: { language: 'regex', mode: 'encode' },
      label: 'Regex special characters',
      text: 'price (USD) = 3.50?',
    },
    {
      fields: { language: 'shell', mode: 'encode' },
      label: 'Shell single quoting',
      text: "it's $HOME",
    },
    {
      fields: { language: 'json', mode: 'decode' },
      label: 'Unescape a JSON string',
      text: '"line one\\nline two \\u00e9"',
    },
  ],
  supportsSelection: true,
};

export const jsonStringEscapeTool: ToolDefinition = {
  ...stringEscaperTool,
  aliasOf: 'string-escaper',
  id: 'json-string-escape',
  name: 'JSON String Escape / Unescape',
  run: (input) =>
    stringEscaperTool.run({ ...input, fields: { language: 'json', ...input.fields } }),
};
