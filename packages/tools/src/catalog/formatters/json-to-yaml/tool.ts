import {
  jsonDocumentToYaml as convertJsonToYaml,
  jsonDuplicateWarning,
  yamlToJson as convertYamlToJson,
} from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { conversionPair } from '../../../adapters/conversionPair';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';

const [jsonYamlTool, yamlJsonTool] = conversionPair({
  aliasId: 'yaml-to-json',
  aliasName: 'YAML to JSON',
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  decode: {
    run: ({ text }) =>
      withToolError(() => {
        const converted = JSON.stringify(convertYamlToJson(text), null, 2);

        return {
          artifact: {
            base64: encodeBase64Text(converted),
            fileName: 'converted.json',
            mimeType: 'application/json;charset=utf-8',
          },
          language: 'json',
          summary: 'Converted YAML to JSON · comments and alias notation omitted.',
          text: converted,
        };
      }),
  },
  decodedLabel: 'JSON',
  description:
    'Convert JSON to YAML or YAML to JSON on one page, keeping nested data, empty collections and string types such as "123" and "true" intact.',
  encode: {
    run: ({ text }) =>
      withToolError(() => {
        const converted = convertJsonToYaml(text);

        return {
          artifact: {
            base64: encodeBase64Text(converted),
            fileName: 'converted.yaml',
            mimeType: 'application/yaml;charset=utf-8',
          },
          language: 'yaml',
          summary: withWarning(
            'Converted JSON to YAML · data types, key order and number spelling preserved.',
            jsonDuplicateWarning(text),
          ),
          text: converted,
        };
      }),
  },
  encodedLabel: 'YAML',
  id: 'json-to-yaml',
  inputKind: 'text',
  keywords: [
    'converter',
    'json to yaml',
    'yaml to json',
    'yaml',
    'configuration',
    'manifest',
    'nested arrays',
    'anchors',
    'merge keys',
  ],
  name: 'JSON ↔ YAML Converter',
  outputKind: 'text',
  relatedToolIds: ['json-format', 'json-tree', 'json-to-toml', 'json-to-xml'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  supportsSelection: true,
  samples: [
    {
      fields: { mode: 'encode' },
      label: 'JSON → YAML: Server config',
      text: '{\n  "server": {\n    "port": 8080,\n    "host": "localhost",\n    "routes": ["/api", "/health"]\n  }\n}',
    },
    {
      fields: { mode: 'encode' },
      label: 'JSON → YAML: Nested users',
      text: '{\n  "users": [\n    {"name": "Ada", "active": true, "roles": ["admin", "editor"]},\n    {"name": "Grace", "active": false, "roles": []}\n  ]\n}',
    },
    {
      fields: { mode: 'encode' },
      label: 'JSON → YAML: Types and empty values',
      text: '{\n  "code": "123",\n  "count": 123,\n  "enabled": "true",\n  "active": true,\n  "date": "2026-10-10",\n  "emptyText": "",\n  "items": [],\n  "settings": {},\n  "value": null\n}',
    },
    {
      fields: { mode: 'encode' },
      label: 'JSON → YAML: Multiline Unicode',
      text: '{\n  "title": "Příliš žluťoučký kůň 🐎",\n  "message": "First line.\\nSecond line.\\n",\n  "literal": "Keep # and : exactly."\n}',
    },
    {
      fields: { mode: 'decode' },
      label: 'YAML → JSON: Nested users',
      text: 'users:\n  - name: Ada\n    active: true\n    roles: [admin, editor]\n  - name: Grace\n    active: false\n    roles: []',
    },
    {
      fields: { mode: 'decode' },
      label: 'YAML → JSON: Types and empty values',
      text: 'code: "123"\ncount: 123\nenabled: "true"\nactive: true\ndate: 2026-10-10\nemptyText: ""\nitems: []\nsettings: {}\nvalue: null',
    },
    {
      fields: { mode: 'decode' },
      label: 'YAML → JSON: Multiline Unicode',
      text: 'title: Příliš žluťoučký kůň 🐎\nmessage: |\n  First line.\n  Second line.\nliteral: "Keep # and : exactly."',
    },
    {
      fields: { mode: 'decode' },
      label: 'YAML → JSON: Anchors and merge keys',
      text: '# Shared defaults become ordinary JSON values.\ndefaults: &defaults\n  port: 8080\n  retries: 3\nserver:\n  <<: *defaults\n  host: localhost\n  retries: 5',
    },
  ],
});

export const jsonToYamlTool = jsonYamlTool;
export const yamlToJsonTool = yamlJsonTool;
