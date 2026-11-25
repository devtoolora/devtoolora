import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  compileJsonSchema,
  renderSchemaTypeScript,
  typeScriptReservedNames,
} from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';
import { choiceField, booleanField } from '../../../adapters/fields';

const defaults = { declaration: 'interface', exported: 'true', readonly: 'false' };

export const jsonSchemaToTypeScriptTool: ToolDefinition = {
  samples: [
    {
      fields: { ...defaults, rootName: 'User' },
      label: 'User with $defs',
      text: '{"$schema":"https://json-schema.org/draft/2020-12/schema","title":"User","type":"object","required":["id","email"],"properties":{"id":{"type":"integer"},"email":{"type":"string","format":"email"},"role":{"enum":["admin","editor"]},"tags":{"type":"array","items":{"type":"string"}},"address":{"$ref":"#/$defs/Address"}},"additionalProperties":false,"$defs":{"Address":{"type":"object","description":"Postal address","properties":{"city":{"type":"string"},"zip":{"type":["string","null"]}},"required":["city"]}}}',
    },
    {
      fields: { ...defaults, declaration: 'type', exported: 'false', rootName: 'Mode' },
      label: 'String enum',
      text: '{"type":"string","enum":["light","dark","system"]}',
    },
    {
      fields: { ...defaults, rootName: 'Pair' },
      label: 'Fixed-length tuple',
      text: '{"type":"array","prefixItems":[{"type":"string"},{"type":"number"}],"items":false}',
    },
    {
      fields: { ...defaults, rootName: 'List' },
      label: 'Recursive $ref',
      text: '{"$defs":{"Node":{"type":"object","properties":{"value":{"type":"number"},"next":{"$ref":"#/$defs/Node"}},"required":["value"]}},"$ref":"#/$defs/Node"}',
    },
    {
      fields: { ...defaults, rootName: 'Employee' },
      label: 'allOf composition',
      text: '{"allOf":[{"$ref":"#/definitions/Person"},{"type":"object","properties":{"salary":{"type":"number"}},"required":["salary"]}],"definitions":{"Person":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}}}',
    },
    {
      fields: { ...defaults, declaration: 'type', readonly: 'true', rootName: 'Labels' },
      label: 'Record with additionalProperties',
      text: '{"type":"object","properties":{"default":{"type":"string"}},"additionalProperties":{"type":"string"}}',
    },
  ],
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Schema & Types',
  description:
    'Turn a JSON Schema into TypeScript interfaces or type aliases, resolving local $ref, enum, const, tuples and composition keywords.',
  fields: [
    {
      defaultValue: 'Root',
      help: 'Converted to PascalCase. A schema title takes precedence.',
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
    { defaultValue: 'true', id: 'exported', label: 'Export declarations', type: 'checkbox' },
    {
      defaultValue: 'false',
      help: 'Adds readonly to every property and array.',
      id: 'readonly',
      label: 'Readonly',
      type: 'checkbox',
    },
  ],
  id: 'json-schema-to-typescript',
  inputKind: 'text',
  keywords: [
    'json schema',
    'typescript',
    'interface',
    'type alias',
    'schema to ts',
    'json-schema-to-typescript',
    '$ref',
    'openapi',
  ],
  name: 'JSON Schema to TypeScript',
  outputKind: 'text',
  relatedToolIds: ['json-schema-generator', 'json-schema-validator', 'json-to-typescript'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const declaration = choiceField(
        fields.declaration,
        'interface',
        ['interface', 'type'],
        'Choose interface or type alias declarations.',
      );
      const compiled = compileJsonSchema(
        text,
        fields.rootName?.trim() || 'Root',
        typeScriptReservedNames,
      );
      const output = renderSchemaTypeScript(compiled, {
        declaration,
        exported: booleanField(fields.exported, true),
        readonly: booleanField(fields.readonly, false),
      });
      const count = compiled.declarations.length;
      const ignored = compiled.ignored.length + compiled.omitted;
      const parts = [
        `${count} ${count === 1 ? 'declaration' : 'declarations'}`,
        declaration,
        ...(ignored > 0 ? [`${ignored} ignored ${ignored === 1 ? 'keyword' : 'keywords'}`] : []),
      ];

      return {
        artifact: {
          base64: encodeBase64Text(`${output}\n`),
          fileName: 'types.ts',
          mimeType: 'text/typescript;charset=utf-8',
        },
        language: 'typescript',
        summary: parts.join(' · '),
        text: output,
      };
    }),
  supportsSelection: true,
};
