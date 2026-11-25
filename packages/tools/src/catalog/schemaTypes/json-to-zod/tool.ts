import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { jsonDuplicateWarning } from '@devtoolora/functions/format';
import { generateZodSchema, parseTypeSample } from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';
import { choiceField, booleanField } from '../../../adapters/fields';

const zodDefaults = {
  exportType: 'true',
  inferFormats: 'true',
  optionalProperties: 'observed',
  strictObjects: 'false',
  version: '4',
};

export const jsonToZodTool: ToolDefinition = {
  samples: [
    {
      fields: { ...zodDefaults, rootName: 'User' },
      label: 'API user with formats',
      text: '{"id":1,"name":"Ada Lovelace","email":"ada@example.com","website":"https://example.com/ada","roles":["admin"],"createdAt":"2026-01-02T10:00:00Z","profile":{"active":true,"score":9.5}}',
    },
    {
      fields: { ...zodDefaults, rootName: 'Contacts' },
      label: 'Optional and nullable fields',
      text: '[{"id":1,"email":"ada@example.com","phone":null},{"id":2,"phone":"+1 415-555-0134"}]',
    },
    {
      fields: { ...zodDefaults, rootName: 'Webhook' },
      label: 'Webhook with offsets and UUIDs',
      text: '{"eventId":"550e8400-e29b-41d4-a716-446655440000","type":"invoice.paid","occurredAt":"2026-03-14T09:30:00+01:00","data":{"invoiceId":"in_123","amount":4990,"currency":"EUR","paidOn":"2026-03-14"}}',
    },
    {
      fields: { ...zodDefaults, rootName: 'Config', strictObjects: 'true', version: '3' },
      label: 'Zod 3 strict config',
      text: '{"port":8080,"host":"localhost","debug":false,"allowedOrigins":["https://example.com"]}',
    },
    {
      fields: { ...zodDefaults, rootName: 'Rows' },
      label: 'Mixed arrays and empty values',
      text: '[{"values":[1,"a",null],"tags":[],"extra":{}},{"values":[2],"tags":["x"],"extra":{}}]',
    },
    {
      fields: { ...zodDefaults, inferFormats: 'false', rootName: 'Event' },
      label: 'Plain strings and numbers',
      text: '{"id":42,"email":"grace@example.com","at":"2026-01-02T10:00:00Z"}',
    },
  ],
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Schema & Types',
  description:
    'Generate a Zod 4 or Zod 3 schema with an inferred type from sample JSON, including optional, nullable and format checks.',
  fields: [
    {
      defaultValue: 'Root',
      help: 'Exports NameSchema and, optionally, type Name = z.infer<typeof NameSchema>.',
      id: 'rootName',
      label: 'Schema name',
      type: 'text',
    },
    {
      defaultValue: '4',
      help: 'Match the major version of zod in your package.json.',
      id: 'version',
      label: 'Zod version',
      options: [
        { label: 'Zod 4', value: '4' },
        { label: 'Zod 3', value: '3' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'observed',
      help: 'Observed marks a property optional when some records in an array omit it.',
      id: 'optionalProperties',
      label: 'Optional properties',
      options: [
        { label: 'Observed', value: 'observed' },
        { label: 'All optional', value: 'all' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: 'Integers and strings that are always emails, URLs, UUIDs, ISO dates or date-times get specific validators.',
      id: 'inferFormats',
      label: 'Infer formats and integers',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Rejects keys that are not in the schema.',
      id: 'strictObjects',
      label: 'Strict objects',
      type: 'checkbox',
    },
    { defaultValue: 'true', id: 'exportType', label: 'Export z.infer type', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'json-to-zod',
  inputKind: 'text',
  keywords: [
    'zod',
    'zod 4',
    'schema',
    'validation',
    'z.infer',
    'typescript',
    'runtime validation',
    'json to zod',
  ],
  name: 'JSON to Zod Schema',
  outputKind: 'text',
  relatedToolIds: [
    'json-to-typescript',
    'json-schema-generator',
    'json-schema-validator',
    'json-format',
  ],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const version = choiceField(fields.version, '4', ['4', '3'], 'Choose Zod 4 or Zod 3.');
      const optionalProperties = choiceField(
        fields.optionalProperties,
        'observed',
        ['observed', 'all'],
        'Choose observed or all optional properties.',
      );
      const inferFormats = booleanField(fields.inferFormats, true);
      const strictObjects = booleanField(fields.strictObjects, false);
      const output = generateZodSchema(parseTypeSample(text), fields.rootName?.trim() || 'Root', {
        exportType: booleanField(fields.exportType, true),
        inferFormats,
        optionalProperties,
        strictObjects,
        version: version === '3' ? 3 : 4,
      });

      return {
        artifact: {
          base64: encodeBase64Text(`${output}\n`),
          fileName: 'schema.ts',
          mimeType: 'text/typescript;charset=utf-8',
        },
        language: 'typescript',
        summary: withWarning(
          `Zod ${version} schema · ${inferFormats ? 'formats and integers inferred' : 'plain strings and numbers'}${strictObjects ? ' · strict objects' : ''} · review before use.`,
          jsonDuplicateWarning(text),
        ),
        text: output,
      };
    }),
  supportsSelection: true,
};
