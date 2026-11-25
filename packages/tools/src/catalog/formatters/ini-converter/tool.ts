import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { iniToJson, jsonDocumentToIni, jsonDuplicateWarning } from '@devtoolora/functions/format';
import type { JsonValue } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function countEntries(value: JsonValue): { keys: number; sections: number } {
  const counts = { keys: 0, sections: 0 };

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return counts;

  for (const entry of Object.values(value)) {
    if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
      const inner = countEntries(entry);

      counts.keys += inner.keys;
      counts.sections += inner.sections + 1;
    } else counts.keys += 1;
  }

  return counts;
}

export const iniConverterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Convert INI to JSON and JSON to INI locally. Sections become objects, dotted section names nest, and big integers stay exact.',
  fields: [
    {
      defaultValue: 'ini-to-json',
      id: 'mode',
      label: 'Direction',
      options: [
        { label: 'INI → JSON', value: 'ini-to-json' },
        { label: 'JSON → INI', value: 'json-to-ini' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'false',
      help: 'INI to JSON only. Turns true, false, plain integers and plain decimals into JSON types; everything else, such as 0012 or 1e5, stays a string.',
      id: 'typed',
      label: 'Typed values',
      type: 'checkbox',
    },
  ],
  id: 'ini-converter',
  inputKind: 'text',
  keywords: ['ini', 'json', 'convert', 'config', 'sections', 'cfg', 'conf', 'php.ini', 'desktop'],
  name: 'INI Converter',
  outputKind: 'text',
  relatedToolIds: ['json-to-toml', 'json-format', 'properties-converter'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'ini-to-json';

      if (mode !== 'ini-to-json' && mode !== 'json-to-ini')
        throw new ToolError('Choose INI → JSON or JSON → INI.');

      if (mode === 'json-to-ini') {
        const ini = jsonDocumentToIni(text);
        const sections = ini.split('\n').filter((line) => line.startsWith('[')).length;

        return {
          artifact: {
            base64: encodeBase64Text(ini),
            fileName: 'converted.ini',
            mimeType: 'text/plain;charset=utf-8',
          },
          summary: withWarning(
            `Converted to INI · ${plural(sections, 'section')}.`,
            jsonDuplicateWarning(text),
          ),
          text: ini,
        };
      }

      const value = iniToJson(text, { typed: fields.typed === 'true' });
      const json = JSON.stringify(value, null, 2);
      const counts = countEntries(value);

      return {
        artifact: {
          base64: encodeBase64Text(json),
          fileName: 'converted.json',
          mimeType: 'application/json;charset=utf-8',
        },
        language: 'json',
        summary: `Converted to JSON · ${plural(counts.sections, 'section')} · ${plural(counts.keys, 'key')}.`,
        text: json,
      };
    }),
  samples: [
    {
      fields: { mode: 'ini-to-json' },
      label: 'Database config',
      text: '; app settings\nname = demo\n\n[database]\nhost = localhost\nport = 5432\n\n[database.replica]\nhost = replica.local\n',
    },
    {
      fields: { mode: 'ini-to-json', typed: 'true' },
      label: 'Typed values',
      text: 'debug = true\nretries = 3\nratio = 0.75\nversion = 0012\nlabel = 1e5\n',
    },
    {
      fields: { mode: 'ini-to-json' },
      label: 'Comments and quotes',
      text: '# comment\n[paths]\nhome = /srv/app ; stays in the value\n"key = with equals" = " padded "\n',
    },
    {
      fields: { mode: 'ini-to-json' },
      label: 'php.ini style',
      text: '[PHP]\nmemory_limit = 256M\nerror_reporting = E_ALL & ~E_NOTICE\n\n[Date]\ndate.timezone = UTC\n',
    },
    {
      fields: { mode: 'json-to-ini' },
      label: 'JSON to INI',
      text: '{\n  "name": "demo",\n  "server": { "host": "localhost", "port": 8080 }\n}\n',
    },
    {
      fields: { mode: 'json-to-ini' },
      label: 'Strings that need quotes',
      text: '{\n  "greeting": " hello ",\n  "a=b": "x;y#z",\n  "id": 12345678901234567890123\n}\n',
    },
  ],
  supportsSelection: true,
};
