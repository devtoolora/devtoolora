import { ToolDefinition, ToolError } from '@devtoolora/core';
import { formatYaml } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, indentationField } from '../shared';

export const yamlFormatTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Format or validate YAML, including multi-document streams, while keeping comments, anchors and aliases.',
  fields: [
    {
      defaultValue: 'format',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Format', value: 'format' },
        { label: 'Validate', value: 'validate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '2',
      help: 'Used only in Format mode. YAML does not allow tabs for indentation.',
      id: 'indentation',
      label: 'Indentation',
      options: [
        { label: '2 spaces', value: '2' },
        { label: '4 spaces', value: '4' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['format'] },
    },
  ],
  id: 'yaml-format',
  inputKind: 'text',
  keywords: ['yaml', 'yml', 'formatter', 'validator', 'lint', 'pretty print', 'indentation'],
  name: 'YAML Format',
  outputKind: 'text',
  relatedToolIds: ['json-to-yaml', 'json-to-toml'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'format';
      const indent = indentationField(fields);

      if (mode !== 'format' && mode !== 'validate')
        throw new ToolError('Choose Format or Validate.');
      if (indent === 'tab') throw new ToolError('YAML cannot be indented with tabs.');

      const result = formatYaml(text, { indent, mode });
      const count = `${result.documents} ${result.documents === 1 ? 'document' : 'documents'}`;

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: 'formatted.yaml',
          mimeType: 'application/yaml;charset=utf-8',
        },
        language: 'yaml',
        summary: mode === 'validate' ? `Valid YAML · ${count}.` : `YAML formatted · ${count}.`,
        text: result.text,
      };
    }),
  samples: [
    {
      fields: { indentation: '2', mode: 'format' },
      label: 'Messy mapping',
      text: 'name:   demo\nitems: [1,2,3]\nnested: {a: 1,   b: two}\n',
    },
    {
      fields: { indentation: '2', mode: 'format' },
      label: 'Comments kept',
      text: '# service config\nserver:\n    host: localhost   # local only\n    port: 8080\n',
    },
    {
      fields: { indentation: '2', mode: 'format' },
      label: 'Anchors and aliases',
      text: 'defaults: &defaults\n  retries: 3\n  timeout: 30\nproduction:\n  <<: *defaults\n  timeout: 60\n',
    },
    {
      fields: { indentation: '4', mode: 'format' },
      label: 'Multi-document stream',
      text: 'kind: Service\nspec:\n  port: 80\n---\nkind: Deployment\nspec:\n  replicas: 2\n',
    },
    {
      fields: { indentation: '2', mode: 'format' },
      label: 'Block and quoted strings',
      text: "description: |\n  line one\n  line two\ntitle: 'Příliš žluťoučký kůň'\nflag: yes\n",
    },
    {
      fields: { mode: 'validate' },
      label: 'Validate a CI file',
      text: 'jobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
    },
  ],
  supportsSelection: true,
};
