import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  jsonDocumentToProperties,
  jsonDuplicateWarning,
  jsonToYaml,
  propertiesToJson,
  yamlDocumentToProperties,
} from '@devtoolora/functions/format';
import type { JsonValue } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';

const modes = [
  'properties-to-json',
  'properties-to-yaml',
  'json-to-properties',
  'yaml-to-properties',
];

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function countKeys(value: JsonValue): number {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 1;

  return Object.values(value).reduce<number>((total, entry) => total + countKeys(entry), 0);
}

function toProperties(mode: string, text: string, asciiOnly: boolean) {
  const properties =
    mode === 'json-to-properties'
      ? jsonDocumentToProperties(text, { asciiOnly })
      : yamlDocumentToProperties(text, { asciiOnly });
  const keys = properties.split('\n').filter((line) => line && !line.startsWith('#')).length;

  return {
    artifact: {
      base64: encodeBase64Text(properties),
      fileName: 'converted.properties',
      mimeType: 'text/plain;charset=utf-8',
    },
    summary: withWarning(
      `Converted to properties · ${plural(keys, 'key')}.`,
      mode === 'json-to-properties' ? jsonDuplicateWarning(text) : undefined,
    ),
    text: properties,
  };
}

function fromProperties(mode: string, text: string, nested: boolean) {
  const value = propertiesToJson(text, { nested });
  const isYaml = mode === 'properties-to-yaml';
  const output = isYaml ? jsonToYaml(value) : JSON.stringify(value, null, 2);

  return {
    artifact: {
      base64: encodeBase64Text(output),
      fileName: isYaml ? 'converted.yaml' : 'converted.json',
      mimeType: isYaml ? 'application/yaml;charset=utf-8' : 'application/json;charset=utf-8',
    },
    language: isYaml ? 'yaml' : 'json',
    summary: `Converted to ${isYaml ? 'YAML' : 'JSON'} · ${plural(countKeys(value), 'key')}.`,
    text: output,
  };
}

export const propertiesConverterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Convert Java .properties to JSON or YAML and back locally. Dotted keys nest, escapes and line continuations are read as java.util.Properties reads them.',
  fields: [
    {
      defaultValue: 'properties-to-json',
      id: 'mode',
      label: 'Direction',
      options: [
        { label: 'Properties → JSON', value: 'properties-to-json' },
        { label: 'Properties → YAML', value: 'properties-to-yaml' },
        { label: 'JSON → Properties', value: 'json-to-properties' },
        { label: 'YAML → Properties', value: 'yaml-to-properties' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'true',
      help: 'Turns dotted keys such as db.host into nested objects. A key that is both a value and a parent is an error.',
      id: 'nested',
      label: 'Nested keys',
      type: 'checkbox',
      visibleWhen: { field: 'mode', is: ['properties-to-json', 'properties-to-yaml'] },
    },
    {
      defaultValue: 'false',
      help: 'Writes every character outside printable ASCII as a \\uXXXX escape.',
      id: 'asciiOnly',
      label: 'Escape non-ASCII',
      type: 'checkbox',
      visibleWhen: { field: 'mode', is: ['json-to-properties', 'yaml-to-properties'] },
    },
  ],
  id: 'properties-converter',
  inputKind: 'text',
  keywords: [
    'properties',
    'java',
    'spring',
    'application.properties',
    'resource bundle',
    'json',
    'yaml',
    'convert',
    'config',
  ],
  name: 'Properties Converter',
  outputKind: 'text',
  relatedToolIds: ['ini-converter', 'json-to-yaml'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'properties-to-json';

      if (!modes.includes(mode))
        throw new ToolError(
          'Choose Properties → JSON, Properties → YAML, JSON → Properties or YAML → Properties.',
        );

      return mode.endsWith('-to-properties')
        ? toProperties(mode, text, fields.asciiOnly === 'true')
        : fromProperties(mode, text, fields.nested !== 'false');
    }),
  samples: [
    {
      fields: { mode: 'properties-to-json' },
      label: 'Spring config',
      text: '# application.properties\nserver.port=8080\nspring.datasource.url=jdbc:postgresql://localhost/app\nspring.datasource.username=app\n',
    },
    {
      fields: { mode: 'properties-to-yaml' },
      label: 'Properties to YAML',
      text: 'app.name=Demo\napp.features=search, export\nlogging.level.root=INFO\n',
    },
    {
      fields: { mode: 'properties-to-json' },
      label: 'Escapes and continuations',
      text: '! separators: =, : or a space\ngreeting : Hello\\u0020world\npath = C:\\\\tools\\\\bin\nlist = one, \\\n       two, \\\n       three\nkey\\ with\\ spaces value\n',
    },
    {
      fields: { mode: 'properties-to-json', nested: 'false' },
      label: 'Flat message bundle',
      text: 'button.save=Save\nbutton.cancel=Cancel\nerror.required=This field is required.\n',
    },
    {
      fields: { mode: 'json-to-properties' },
      label: 'JSON to properties',
      text: '{\n  "server": { "port": 8080, "ssl": false },\n  "greeting": " hello = world"\n}\n',
    },
    {
      fields: { asciiOnly: 'true', mode: 'yaml-to-properties' },
      label: 'YAML to ASCII properties',
      text: 'messages:\n  welcome: Vítejte\n  farewell: Tschüß\n',
    },
  ],
  supportsSelection: true,
};
