import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  compileJsonSchema,
  renderSchemaZod,
  typeScriptReservedNames,
} from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';
import { choiceField, booleanField } from '../../../adapters/fields';

const defaults = { exportType: 'true', version: '4' };

export const jsonSchemaToZodTool: ToolDefinition = {
  samples: [
    {
      fields: { ...defaults, rootName: 'User' },
      label: 'User with $defs',
      text: '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"User","type":"object","required":["id","email"],"properties":{"id":{"type":"integer"},"email":{"type":"string","format":"email"},"role":{"enum":["admin","editor"]},"tags":{"type":"array","items":{"type":"string"}},"address":{"$ref":"#/$defs/Address"}},"additionalProperties":false,"$defs":{"Address":{"type":"object","description":"Postal address","properties":{"city":{"type":"string"},"zip":{"type":["string","null"]}},"required":["city"]}}}',
    },
    {
      fields: { ...defaults, exportType: 'false', rootName: 'Mode' },
      label: 'String enum',
      text: '{"type":"string","enum":["light","dark","system"]}',
    },
    {
      fields: { ...defaults, rootName: 'Pair' },
      label: 'Fixed-length tuple',
      text: '{"type":"array","prefixItems":[{"type":"string"},{"type":"number"}],"items":false}',
    },
    {
      fields: { ...defaults, rootName: 'Slug' },
      label: 'Constrained string',
      text: '{"type":"string","minLength":3,"maxLength":40,"pattern":"^[a-z0-9-]+$"}',
    },
    {
      fields: { ...defaults, rootName: 'Employee' },
      label: 'allOf composition',
      text: '{"allOf":[{"$ref":"#/definitions/Person"},{"type":"object","properties":{"salary":{"type":"number"}},"required":["salary"]}],"definitions":{"Person":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}}}',
    },
    {
      fields: { ...defaults, rootName: 'Labels', version: '3' },
      label: 'Zod 3 record with additionalProperties',
      text: '{"type":"object","properties":{"default":{"type":"string","format":"uuid"}},"additionalProperties":{"type":"string"}}',
    },
  ],
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Schema & Types',
  description:
    'Turn a JSON Schema into Zod 4 or Zod 3 schemas with z.infer types, keeping string, number and array constraints and resolving local $ref.',
  fields: [
    {
      defaultValue: 'Root',
      help: 'Converted to PascalCase. A schema title takes precedence.',
      id: 'rootName',
      label: 'Root schema name',
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
    { defaultValue: 'true', id: 'exportType', label: 'Export z.infer type', type: 'checkbox' },
  ],
  id: 'json-schema-to-zod',
  inputKind: 'text',
  keywords: [
    'json schema',
    'zod',
    'zod 4',
    'zod 3',
    'schema to zod',
    'json-schema-to-zod',
    '$ref',
    'validation',
  ],
  name: 'JSON Schema to Zod',
  outputKind: 'text',
  relatedToolIds: ['json-to-zod', 'json-schema-to-typescript', 'json-schema-validator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const version = choiceField(fields.version, '4', ['4', '3'], 'Choose Zod 4 or Zod 3.');
      // The exported z.infer types would shadow globals such as Date just like TypeScript output.
      const compiled = compileJsonSchema(
        text,
        fields.rootName?.trim() || 'Root',
        typeScriptReservedNames,
      );
      const output = renderSchemaZod(compiled, {
        exportType: booleanField(fields.exportType, true),
        version: version === '3' ? 3 : 4,
      });
      const count = compiled.declarations.length;
      const ignored = compiled.ignored.length + compiled.omitted;
      const parts = [
        `${count} ${count === 1 ? 'schema' : 'schemas'}`,
        `Zod ${version}`,
        ...(ignored > 0 ? [`${ignored} ignored ${ignored === 1 ? 'keyword' : 'keywords'}`] : []),
      ];

      return {
        artifact: {
          base64: encodeBase64Text(`${output}\n`),
          fileName: 'schema.ts',
          mimeType: 'text/typescript;charset=utf-8',
        },
        language: 'typescript',
        summary: parts.join(' · '),
        text: output,
      };
    }),
  supportsSelection: true,
};
