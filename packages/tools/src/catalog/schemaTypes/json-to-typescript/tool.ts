import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { jsonDuplicateWarning } from '@devtoolora/functions/format';
import { generateTypeScriptTypes, parseTypeSample } from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';
import { choiceField, booleanField } from '../../../adapters/fields';

const typeScriptDefaults = {
  declaration: 'interface',
  exported: 'true',
  optionalProperties: 'observed',
  readonly: 'false',
};

export const jsonToTypeScriptTool: ToolDefinition = {
  samples: [
    {
      fields: { ...typeScriptDefaults, rootName: 'User' },
      label: 'API user',
      text: '{"id":1,"name":"Ada Lovelace","email":"ada@example.com","roles":["admin","editor"],"profile":{"active":true,"score":9.5},"lastLogin":null}',
    },
    {
      fields: { ...typeScriptDefaults, rootName: 'Users' },
      label: 'Records with optional fields',
      text: '[{"id":1,"name":"Ada","email":"ada@example.com"},{"id":2,"name":"Grace","phone":"+1 415-555-0134"}]',
    },
    {
      fields: { ...typeScriptDefaults, rootName: 'Rows' },
      label: 'Nullable objects and mixed arrays',
      text: '[{"meta":null,"values":[1,"a",null]},{"meta":{"source":"import"},"values":[]}]',
    },
    {
      fields: { ...typeScriptDefaults, rootName: 'Order' },
      label: 'Nested order with line items',
      text: '{"orderId":"A-1001","customer":{"name":"Grace Hopper","address":{"city":"Prague","zip":"110 00"}},"items":[{"sku":"KB-1","qty":2,"price":49.9},{"sku":"MS-2","qty":1,"price":19.5,"discount":0.1}]}',
    },
    {
      fields: {
        ...typeScriptDefaults,
        declaration: 'type',
        readonly: 'true',
        rootName: 'Config',
      },
      label: 'Readonly type aliases',
      text: '{"version":2,"features":["search","export"],"limits":{"maxUsers":50,"maxProjects":10}}',
    },
    {
      fields: { ...typeScriptDefaults, rootName: 'Document' },
      label: 'Unusual property names',
      text: '{"a/b":1,"constructor":"plain JSON","číslo":42,"data-id":"x1"}',
    },
  ],
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Schema & Types',
  description:
    'Generate TypeScript interfaces or type aliases from sample JSON, merging records into optional and nullable fields.',
  fields: [
    {
      defaultValue: 'Root',
      help: 'Converted to PascalCase. Nested types are named after it, such as UserProfile.',
      id: 'rootName',
      label: 'Root type name',
      type: 'text',
    },
    {
      defaultValue: 'interface',
      id: 'declaration',
      label: 'Declarations',
      options: [
        { label: 'Interface', value: 'interface' },
        { label: 'Type alias', value: 'type' },
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
    { defaultValue: 'true', id: 'exported', label: 'Export declarations', type: 'checkbox' },
    {
      defaultValue: 'false',
      help: 'Adds readonly to every property and array.',
      id: 'readonly',
      label: 'Readonly',
      type: 'checkbox',
    },
  ],
  freshResults: true,
  id: 'json-to-typescript',
  inputKind: 'text',
  keywords: [
    'typescript',
    'interface',
    'type alias',
    'json to ts',
    'type generation',
    'quicktype',
    'optional',
    'nullable',
    'readonly',
  ],
  name: 'JSON to TypeScript Types',
  outputKind: 'text',
  relatedToolIds: ['json-to-zod', 'json-schema-generator', 'json-format', 'fake-data-generator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const declaration = choiceField(
        fields.declaration,
        'interface',
        ['interface', 'type'],
        'Choose interface or type alias declarations.',
      );
      const optionalProperties = choiceField(
        fields.optionalProperties,
        'observed',
        ['observed', 'all'],
        'Choose observed or all optional properties.',
      );
      const output = generateTypeScriptTypes(
        parseTypeSample(text),
        fields.rootName?.trim() || 'Root',
        {
          declaration,
          exported: booleanField(fields.exported, true),
          optionalProperties,
          readonly: booleanField(fields.readonly, false),
        },
      );
      const count = output.match(/^(?:export )?(?:interface|type) /gm)?.length ?? 0;

      return {
        artifact: {
          base64: encodeBase64Text(`${output}\n`),
          fileName: 'types.ts',
          mimeType: 'text/typescript;charset=utf-8',
        },
        language: 'typescript',
        summary: withWarning(
          `${count} ${count === 1 ? 'declaration' : 'declarations'} · inferred from the sample, review optional and union types.`,
          jsonDuplicateWarning(text),
        ),
        text: output,
      };
    }),
  supportsSelection: true,
};
