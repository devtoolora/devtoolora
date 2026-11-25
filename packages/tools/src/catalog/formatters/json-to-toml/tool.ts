import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  jsonDocumentToToml,
  jsonDuplicateWarning,
  tomlDocumentToJson,
} from '@devtoolora/functions/format';
import { conversionPair } from '../../../adapters/conversionPair';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';

const capabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

const [jsonTomlTool, tomlJsonTool] = conversionPair({
  aliasId: 'toml-to-json',
  aliasName: 'TOML to JSON',
  capabilities,
  category: 'Formatters',
  decode: {
    fields: [
      {
        defaultValue: 'numbers',
        help: 'Exact numbers keep digits, but receiving JavaScript or spreadsheets may round them. Strings protects integers outside ±9,007,199,254,740,991.',
        id: 'integers',
        label: 'Large integers',
        options: [
          { label: 'Exact JSON numbers', value: 'numbers' },
          { label: 'Strings for large integers', value: 'strings' },
        ],
        presentation: 'segmented',
        type: 'select',
      },
      {
        defaultValue: '2',
        id: 'indentation',
        label: 'JSON indentation',
        options: [
          { label: '2 spaces', value: '2' },
          { label: '4 spaces', value: '4' },
        ],
        presentation: 'segmented',
        type: 'select',
      },
    ],
    run: ({ fields, text }) =>
      withToolError(() => {
        const integers = fields.integers ?? 'numbers';
        const indentation = fields.indentation ?? '2';

        if (integers !== 'numbers' && integers !== 'strings')
          throw new ToolError('Choose exact JSON numbers or strings for large integers.');
        if (indentation !== '2' && indentation !== '4')
          throw new ToolError('Choose 2 or 4 spaces.');

        const converted = tomlDocumentToJson(text, integers, indentation);

        return {
          artifact: {
            base64: encodeBase64Text(converted.text),
            fileName: 'converted.json',
            mimeType: 'application/json;charset=utf-8',
          },
          language: 'json',
          summary: `Converted TOML to JSON · ${converted.dates} date/time strings · ${converted.largeIntegers} large integers ${integers === 'strings' ? 'quoted as strings' : 'kept as exact numeric tokens'}.`,
          text: converted.text,
        };
      }),
  },
  decodedLabel: 'JSON',
  description:
    'Convert JSON to TOML sections or inline tables and TOML back to JSON, with exact 64-bit integers, dates kept as strings and no silently dropped nulls.',
  encode: {
    fields: [
      {
        defaultValue: 'tables',
        id: 'layout',
        label: 'TOML layout',
        options: [
          { label: 'Table sections', value: 'tables' },
          { label: 'Inline objects', value: 'inline' },
        ],
        presentation: 'segmented',
        type: 'select',
      },
    ],
    run: ({ fields, text }) =>
      withToolError(() => {
        const layout = fields.layout ?? 'tables';

        if (layout !== 'tables' && layout !== 'inline')
          throw new ToolError('Choose Table sections or Inline objects.');

        const converted = jsonDocumentToToml(text, layout);

        return {
          artifact: {
            base64: encodeBase64Text(converted),
            fileName: 'converted.toml',
            mimeType: 'application/toml;charset=utf-8',
          },
          language: 'toml',
          summary: withWarning(
            `Converted JSON to TOML · ${layout === 'tables' ? 'table sections' : 'inline objects'} · integer digits retained.`,
            jsonDuplicateWarning(text),
          ),
          text: converted,
        };
      }),
  },
  encodedLabel: 'TOML',
  id: 'json-to-toml',
  inputKind: 'text',
  keywords: [
    'config',
    'converter',
    'json to toml',
    'toml to json',
    'toml parser',
    'cargo.toml',
    'pyproject',
    'tables',
    'datetime',
    'exact integers',
    'bigint',
  ],
  name: 'JSON ↔ TOML Converter',
  outputKind: 'text',
  relatedToolIds: ['json-to-yaml', 'json-format', 'json-tree', 'json-schema-validator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  supportsSelection: true,
  samples: [
    {
      fields: { layout: 'tables', mode: 'encode' },
      label: 'JSON → TOML: Config',
      text: '{"name":"demo","port":3000,"debug":true}',
    },
    {
      fields: { layout: 'tables', mode: 'encode' },
      label: 'JSON → TOML: Nested service configuration',
      text: '{"name":"demo","server":{"host":"localhost","port":3000,"tls":{"enabled":false}},"users":[{"name":"Ada","roles":["admin"]},{"name":"Grace","roles":["dev"]}]}',
    },
    {
      fields: { layout: 'inline', mode: 'encode' },
      label: 'JSON → TOML: Compact nested objects',
      text: '{"server":{"host":"localhost","port":3000},"users":[{"name":"Ada"},{"name":"Grace"}]}',
    },
    {
      fields: { layout: 'tables', mode: 'encode' },
      label: 'JSON → TOML: Exact 64-bit integers',
      text: '{"id":9007199254740993,"maximum":9223372036854775807,"minimum":-9223372036854775808,"price":1.00}',
    },
    {
      fields: { layout: 'tables', mode: 'encode' },
      label: 'JSON → TOML: Quoted keys Unicode and empty values',
      text: '{"a.b":{"":"Příliš žluťoučký 🐎","a/b~c":"Line one\\nLine two"},"items":[],"settings":{},"date":"2026-10-11"}',
    },
    {
      fields: { layout: 'tables', mode: 'encode' },
      label: 'JSON → TOML: Empty object',
      text: '{}',
    },
    {
      fields: { indentation: '2', integers: 'numbers', mode: 'decode' },
      label: 'TOML → JSON: Tables and arrays of records',
      text: 'name = "demo"\n[server]\nhost = "localhost"\nport = 3000\n[[users]]\nname = "Ada"\nroles = ["admin"]\n[[users]]\nname = "Grace"\nroles = ["dev"]',
    },
    {
      fields: { indentation: '4', integers: 'numbers', mode: 'decode' },
      label: 'TOML → JSON: Dates times and precise fractions',
      text: 'day = 2026-10-11\nlocal = 2026-10-11T12:30:01.123456789\noffset = 2026-10-11T12:30:01.123456789+02:00\ntime = 12:30:01.123456789',
    },
    {
      fields: { indentation: '2', integers: 'numbers', mode: 'decode' },
      label: 'TOML → JSON: Exact 64-bit integers',
      text: 'id = 9_007_199_254_740_993\nmaximum = 9223372036854775807\nminimum = -9223372036854775808\nhex = 0xFF',
    },
    {
      fields: { indentation: '2', integers: 'strings', mode: 'decode' },
      label: 'TOML → JSON: Protect large IDs as strings',
      text: 'id = 9007199254740993\ncount = 42\nactive = true',
    },
    {
      fields: { indentation: '2', integers: 'numbers', mode: 'decode' },
      label: 'TOML → JSON: Multiline text and quoted keys',
      text: '"a.b" = { "" = "Příliš žluťoučký 🐎" }\nmessage = """\nLine one # this is text\nLine two = still text\n"""\nitems = []\nsettings = {}',
    },
    {
      fields: { indentation: '2', integers: 'numbers', mode: 'decode' },
      label: 'TOML → JSON: Empty configuration',
      text: '# An empty TOML document is an empty JSON object.',
    },
  ],
});

export const jsonToTomlTool = jsonTomlTool;
export const tomlToJsonTool = tomlJsonTool;
