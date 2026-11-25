import { ToolDefinition, ToolError } from '@devtoolora/core';
import { formatToml } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const tomlFormatTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Format or validate TOML with normalized spacing and table sections. Comments are removed in Format mode.',
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
  ],
  id: 'toml-format',
  inputKind: 'text',
  keywords: ['toml', 'formatter', 'validator', 'lint', 'pretty print', 'cargo', 'pyproject'],
  name: 'TOML Format',
  outputKind: 'text',
  relatedToolIds: ['json-to-toml', 'yaml-format'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'format';

      if (mode !== 'format' && mode !== 'validate')
        throw new ToolError('Choose Format or Validate.');

      const result = formatToml(text, { mode });
      const count = `${result.comments} ${result.comments === 1 ? 'comment' : 'comments'}`;

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: 'formatted.toml',
          mimeType: 'application/toml;charset=utf-8',
        },
        language: 'toml',
        summary:
          mode === 'validate' ? `Valid TOML · ${count}.` : `TOML formatted · ${count} removed.`,
        text: result.text,
      };
    }),
  samples: [
    {
      fields: { mode: 'format' },
      label: 'Messy key order',
      text: 'b=1\na   = "x"\nlist=[1,2,3]\n',
    },
    {
      fields: { mode: 'format' },
      label: 'Cargo manifest',
      text: '[package]\nname="demo"\nversion = "0.1.0"\n\n[dependencies]\nserde = { version = "1", features = ["derive"] }\n',
    },
    {
      fields: { mode: 'format' },
      label: 'Array of tables',
      text: '[[items]]\nid=1\n\n[[items]]\nid=2\n',
    },
    {
      fields: { mode: 'format' },
      label: 'Dates stay dates',
      text: 'released = 1979-05-27\nat = 1979-05-27T07:32:00Z\ntext = "1979-05-27"\n',
    },
    {
      fields: { mode: 'format' },
      label: 'Comments removed',
      text: '# service config\nhost = "localhost" # local only\nport = 8080\n',
    },
    {
      fields: { mode: 'validate' },
      label: 'Validate pyproject',
      text: '[project]\nname = "demo"\nrequires-python = ">=3.10"\n',
    },
  ],
  supportsSelection: true,
};
