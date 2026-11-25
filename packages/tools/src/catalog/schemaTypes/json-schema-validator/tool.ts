import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  inspectJsonSchema,
  type JsonSchemaIssue,
  type JsonSchemaValidationReport,
} from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { capabilities, draftOptions, draftValue } from '../shared';
import { booleanField } from '../../../adapters/fields';

const validatorDefaults: Record<string, string> = {
  allErrors: 'true',
  draft: 'auto',
  report: 'text',
  validateFormats: 'true',
};
const userSchema: string = JSON.stringify(
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    additionalProperties: false,
    properties: {
      age: { minimum: 0, type: 'integer' },
      email: { format: 'email', type: 'string' },
      name: { minLength: 1, type: 'string' },
    },
    required: ['name', 'email'],
    type: 'object',
  },
  null,
  2,
);

export const jsonSchemaValidatorTool: ToolDefinition = {
  capabilities,
  category: 'Schema & Types',
  description:
    'Validate JSON locally with draft-aware rules, format checks and precise error paths without eval.',
  fields: [
    {
      help: 'Paste the contract here; the main input is the JSON data to check. Local references are supported, remote loading is not.',
      id: 'schema',
      label: 'JSON Schema',
      placeholder:
        '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["name"]}',
      rows: 14,
      type: 'textarea',
    },
    {
      defaultValue: 'auto',
      help: 'Auto follows $schema or defaults to Draft 7. An explicit draft must agree with an existing declaration.',
      id: 'draft',
      label: 'Schema draft',
      options: [{ label: 'Auto', value: 'auto' }, ...draftOptions],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'text',
      id: 'report',
      label: 'Report format',
      options: [
        { label: 'Plain text', value: 'text' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: 'Check supported formats such as date, date-time, email, URI, UUID and IP addresses. Off ignores all format constraints explicitly.',
      id: 'validateFormats',
      label: 'Validate string formats',
      type: 'checkbox',
    },
    {
      defaultValue: 'true',
      help: 'On reports all failures; off uses short-circuit validation and shows only the first error. At most 200 errors are displayed with the total count.',
      id: 'allErrors',
      label: 'Collect all errors',
      type: 'checkbox',
    },
  ],
  id: 'json-schema-validator',
  inputKind: 'text',
  keywords: [
    'ajv',
    'jsonschema',
    'schema validation',
    'draft',
    'format',
    'json pointer',
    'prefixItems',
  ],
  name: 'JSON Schema Validator',
  outputKind: 'text',
  relatedToolIds: ['json-schema-generator', 'json-format', 'json-tree'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const selectedDraft = fields.draft || 'auto';
      const report = inspectJsonSchema(text, fields.schema ?? '', {
        allErrors: booleanField(fields.allErrors, true),
        draft: selectedDraft === 'auto' ? 'auto' : draftValue(selectedDraft),
        validateFormats: booleanField(fields.validateFormats, true),
      });
      const format = fields.report || 'text';

      if (format !== 'text' && format !== 'json')
        throw new ToolError('Choose a plain text or JSON report.');

      const output =
        format === 'json' ? JSON.stringify(report, null, 2) : renderValidationReport(report);

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: `validation-report.${format === 'json' ? 'json' : 'txt'}`,
          mimeType:
            format === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: format === 'json' ? 'json' : 'plaintext',
        summary: withWarning(
          `${report.valid ? 'Valid' : 'Invalid'} against schema · ${report.draft} · ${report.totalErrors} errors.`,
          report.warnings[0],
        ),
        text: output,
      };
    }),
  samples: [
    {
      fields: { ...validatorDefaults, schema: userSchema },
      label: 'Valid user',
      text: '{"name":"Ada","age":37,"email":"ada@example.com"}',
    },
    {
      fields: { ...validatorDefaults, schema: userSchema },
      label: 'Multiple validation errors',
      text: '{"name":1,"age":-1,"email":"not-an-email","extra":true}',
    },
    {
      fields: { ...validatorDefaults, schema: '{"type":"string","format":"date"}' },
      label: 'Invalid calendar date',
      text: '"2026-02-30"',
    },
    {
      fields: {
        ...validatorDefaults,
        schema:
          '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"array","prefixItems":[{"type":"string"},{"type":"integer"}],"items":false,"minItems":2}',
      },
      label: '2020-12 tuple',
      text: '["Ada",37]',
    },
    {
      fields: {
        ...validatorDefaults,
        schema:
          '{"$schema":"https://json-schema.org/draft/2019-09/schema","type":"object","properties":{"name":{"type":"string"},"creditCard":{"type":"string"},"billingAddress":{"type":"string"}},"dependentRequired":{"creditCard":["billingAddress"]},"unevaluatedProperties":false}',
      },
      label: '2019-09 dependencies',
      text: '{"name":"Ada","creditCard":"test-card"}',
    },
    {
      fields: {
        ...validatorDefaults,
        report: 'json',
        schema:
          '{"$schema":"https://json-schema.org/draft/2020-12/schema","$defs":{"user":{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}},"type":"object","properties":{"user":{"$ref":"#/$defs/user"}}}',
      },
      label: 'Local reference and JSON report',
      text: '{"user":{"name":"Příliš žluťoučký kůň 🐎."}}',
    },
  ],
  supportsSelection: true,
};

function renderValidationReport(report: JsonSchemaValidationReport): string {
  return [
    report.valid ? 'Valid against schema.' : 'Invalid against schema.',
    ...report.warnings.map((warning) => `Warning: ${warning}`),
    `Draft: ${report.draft}`,
    `Format checks: ${report.validateFormats ? 'on' : 'off (format constraints ignored)'}`,
    `Errors: ${report.totalErrors}`,
    ...(report.errors.length > 0
      ? [
          '',
          ...report.errors.map(
            (error: JsonSchemaIssue) =>
              `- ${error.instancePath || '$'} — ${error.message} [${error.keyword}]\n  Schema: ${error.schemaPath}`,
          ),
        ]
      : []),
    ...(report.errorsTruncated
      ? ['', `Showing ${report.errors.length} of ${report.totalErrors} errors.`]
      : []),
  ].join('\n');
}
