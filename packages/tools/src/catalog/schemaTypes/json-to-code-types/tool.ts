import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { jsonDuplicateWarning } from '@devtoolora/functions/format';
import {
  codeTypeLabel,
  codeTypeLanguages,
  generateCodeTypes,
  parseTypeSample,
} from '@devtoolora/functions/schema';
import type { CodeTypeLanguage } from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const codeDefaults = { language: 'go', optionalProperties: 'observed', pythonFlavor: 'dataclass' };
const highlightLanguages: Record<CodeTypeLanguage, string> = {
  csharp: 'csharp',
  go: 'go',
  java: 'java',
  kotlin: 'kotlin',
  python: 'python',
  rust: 'rust',
  swift: 'swift',
};
const fileExtensions: Record<CodeTypeLanguage, string> = {
  csharp: 'cs',
  go: 'go',
  java: 'java',
  kotlin: 'kt',
  python: 'py',
  rust: 'rs',
  swift: 'swift',
};
const samples = [
  {
    fields: { ...codeDefaults, language: 'go', rootName: 'User' },
    label: 'API user',
    text: '{"id":1,"name":"Ada Lovelace","email":"ada@example.com","roles":["admin","editor"],"profile":{"active":true,"score":9.5},"lastLogin":null}',
  },
  {
    fields: { ...codeDefaults, language: 'rust', rootName: 'Users' },
    label: 'Records with optional fields',
    text: '[{"id":1,"name":"Ada","email":"ada@example.com"},{"id":2,"name":"Grace","phone":"+1 415-555-0134"}]',
  },
  {
    fields: { ...codeDefaults, language: 'kotlin', rootName: 'Rows' },
    label: 'Nullable objects and mixed arrays',
    text: '[{"meta":null,"values":[1,"a",null]},{"meta":{"source":"import"},"values":[]}]',
  },
  {
    fields: { ...codeDefaults, language: 'java', rootName: 'Order' },
    label: 'Nested order with line items',
    text: '{"orderId":"A-1001","customer":{"name":"Grace Hopper","address":{"city":"Prague","zip":"110 00"}},"items":[{"sku":"KB-1","qty":2,"price":49.9},{"sku":"MS-2","qty":1,"price":19.5,"discount":0.1}]}',
  },
  {
    fields: { ...codeDefaults, language: 'python', pythonFlavor: 'pydantic', rootName: 'Config' },
    label: 'Config with Pydantic models',
    text: '{"version":2,"features":["search","export"],"limits":{"maxUsers":50,"maxProjects":10}}',
  },
  {
    fields: { ...codeDefaults, language: 'swift', rootName: 'Document' },
    label: 'Unusual property names',
    text: '{"a/b":1,"constructor":"plain JSON","číslo":42,"data-id":"x1"}',
  },
];

export const jsonToCodeTypesTool: ToolDefinition = {
  samples,
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Schema & Types',
  description:
    'Generate Go structs, Rust structs, Kotlin data classes, Java records, C# classes, Python dataclasses or Swift Codable types from sample JSON.',
  fields: [
    {
      defaultValue: 'go',
      id: 'language',
      label: 'Language',
      options: codeTypeLanguages.map((value) => ({ label: codeTypeLabel(value), value })),
      type: 'select',
    },
    {
      defaultValue: 'Root',
      help: 'Converted to PascalCase. Nested types are named after it, such as UserProfile.',
      id: 'rootName',
      label: 'Root type name',
      type: 'text',
    },
    {
      defaultValue: 'observed',
      help: 'Observed marks a property optional when some records in an array omit it or hold null.',
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
      defaultValue: 'dataclass',
      id: 'pythonFlavor',
      label: 'Python models',
      options: [
        { label: 'Dataclass', value: 'dataclass' },
        { label: 'Pydantic', value: 'pydantic' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'language', is: ['python'] },
    },
  ],
  freshResults: true,
  id: 'json-to-code-types',
  inputKind: 'text',
  keywords: [
    'json to go',
    'json to rust',
    'json to kotlin',
    'json to java',
    'json to c#',
    'json to python',
    'json to swift',
    'struct',
    'data class',
    'record',
    'codable',
    'dataclass',
    'pydantic',
    'quicktype',
  ],
  name: 'JSON to Code Types',
  outputKind: 'text',
  relatedToolIds: ['json-to-typescript', 'json-to-zod', 'json-schema-generator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const language = choiceField(
        fields.language,
        'go',
        codeTypeLanguages,
        'Choose a language from the list.',
      );
      const optionalProperties = choiceField(
        fields.optionalProperties,
        'observed',
        ['observed', 'all'],
        'Choose observed or all optional properties.',
      );
      const pythonFlavor = choiceField(
        fields.pythonFlavor,
        'dataclass',
        ['dataclass', 'pydantic'],
        'Choose dataclass or Pydantic models.',
      );
      const output = generateCodeTypes(parseTypeSample(text), fields.rootName?.trim() || 'Root', {
        language,
        optionalProperties,
        pythonFlavor,
      });
      const flavor = language === 'python' && pythonFlavor === 'pydantic' ? ' (Pydantic)' : '';

      return {
        artifact: {
          base64: encodeBase64Text(`${output.text}\n`),
          fileName: `types.${fileExtensions[language]}`,
          mimeType: 'text/plain;charset=utf-8',
        },
        language: highlightLanguages[language],
        summary: withWarning(
          `${codeTypeLabel(language)}${flavor} · ${output.typeCount} ${output.typeCount === 1 ? 'type' : 'types'}`,
          jsonDuplicateWarning(text),
        ),
        text: output.text,
      };
    }),
  supportsSelection: true,
};

function aliasTool(language: CodeTypeLanguage, id: string, name: string): ToolDefinition {
  return {
    ...jsonToCodeTypesTool,
    aliasOf: 'json-to-code-types',
    description: `Generate ${codeTypeLabel(language)} types from sample JSON, merging records into optional and nullable fields.`,
    fields: jsonToCodeTypesTool.fields?.map((field) =>
      field.id === 'language' ? { ...field, defaultValue: language } : field,
    ),
    id,
    name,
    samples: samples.map((sample) => ({
      ...sample,
      fields: { ...sample.fields, language },
    })),
  };
}

export const jsonToGoTool = aliasTool('go', 'json-to-go', 'JSON to Go Struct');
export const jsonToRustTool = aliasTool('rust', 'json-to-rust', 'JSON to Rust Struct');
export const jsonToKotlinTool = aliasTool('kotlin', 'json-to-kotlin', 'JSON to Kotlin Data Class');
export const jsonToJavaTool = aliasTool('java', 'json-to-java', 'JSON to Java Record');
export const jsonToCsharpTool = aliasTool('csharp', 'json-to-csharp', 'JSON to C# Class');
export const jsonToPythonTool = aliasTool('python', 'json-to-python', 'JSON to Python Dataclass');
export const jsonToSwiftTool = aliasTool('swift', 'json-to-swift', 'JSON to Swift Codable');
