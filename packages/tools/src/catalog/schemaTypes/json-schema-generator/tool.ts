import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { jsonDuplicateWarning } from '@devtoolora/functions/format';
import { generateJsonSchema, parseJsonSchemaData } from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { capabilities, draftOptions, draftValue } from '../shared';
import { booleanField } from '../../../adapters/fields';

const generatorDefaults: Record<string, string> = {
  additionalProperties: 'false',
  draft: '2020-12',
  requiredProperties: 'observed',
};

export const jsonSchemaGeneratorTool: ToolDefinition = {
  capabilities,
  category: 'Schema & Types',
  description:
    'Infer a reviewable JSON Schema from sample data, preserving mixed types and optional fields.',
  fields: [
    {
      defaultValue: '2020-12',
      help: 'The output declares this draft; all three are supported by our validator.',
      id: 'draft',
      label: 'Schema draft',
      options: draftOptions,
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'observed',
      help: 'Observed required means present in every object sample of the same merged shape. Null is present, not missing.',
      id: 'requiredProperties',
      label: 'Required properties',
      options: [
        { label: 'Observed required', value: 'observed' },
        { label: 'All optional', value: 'none' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'false',
      help: 'Off rejects unknown keys; on allows them. This choice applies to every nested object.',
      id: 'additionalProperties',
      label: 'Allow additional properties',
      type: 'checkbox',
    },
  ],
  id: 'json-schema-generator',
  inputKind: 'text',
  keywords: ['jsonschema', 'infer', 'schema', 'draft', 'required', 'nullable', 'anyOf'],
  name: 'JSON Schema Generator',
  outputKind: 'json',
  relatedToolIds: [
    'json-schema-validator',
    'json-format',
    'json-tree',
    'json-to-typescript',
    'json-to-zod',
    'function-schema-builder',
  ],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const draft = draftValue(fields.draft || '2020-12');
      const requiredProperties = fields.requiredProperties || 'observed';

      if (requiredProperties !== 'observed' && requiredProperties !== 'none')
        throw new ToolError('Choose observed required properties or all optional.');

      const schema = generateJsonSchema(parseJsonSchemaData(text), {
        additionalProperties: booleanField(fields.additionalProperties, false),
        draft,
        requiredProperties,
      });
      const output = JSON.stringify(schema, null, 2);

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: 'schema.json',
          mimeType: 'application/schema+json;charset=utf-8',
        },
        language: 'json',
        summary: withWarning(
          `Generated JSON Schema · ${draft} · review inferred constraints before use.`,
          jsonDuplicateWarning(text),
        ),
        text: output,
      };
    }),
  samples: [
    {
      fields: generatorDefaults,
      label: 'Users and optional fields',
      text: '[{"id":1,"name":"Ada","active":true},{"id":2,"name":"Grace","email":"grace@example.com"}]',
    },
    {
      fields: generatorDefaults,
      label: 'Mixed types and null',
      text: '[{"value":null,"note":"Příliš žluťoučký kůň 🐎."},{"value":{"active":true},"note":"Second line.\\nMore text."},{"value":[1,"001",false]}]',
    },
    {
      fields: generatorDefaults,
      label: 'Integers, decimals and empty arrays',
      text: '{"ids":[1,2],"measurements":[1,2.5],"future":[],"empty":{},"identifier":"001"}',
    },
    {
      fields: generatorDefaults,
      label: 'Unusual property names',
      text: '{"__proto__":1,"constructor":"plain JSON","a/b~c":"kept","číslo":42}',
    },
    {
      fields: { ...generatorDefaults, additionalProperties: 'true', requiredProperties: 'none' },
      label: 'Permissive nested objects',
      text: '{"id":1,"profile":{"name":"Ada"}}',
    },
    {
      fields: { ...generatorDefaults, draft: 'draft-07' },
      label: 'Draft 7 contract',
      text: '{"id":1,"name":"Ada"}',
    },
  ],
  supportsSelection: true,
};
