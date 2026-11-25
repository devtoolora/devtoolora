import {
  csvToJson as convertCsvToJson,
  jsonDocumentToCsv as convertJsonToCsv,
  jsonDuplicateWarning,
} from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { conversionPair } from '../../../adapters/conversionPair';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import {
  csvParseOptions,
  csvReadFields,
  csvSeparatorField,
  csvWriteOptions,
} from '../../../adapters/csvOptions';
import { browserSafeCapabilities } from '../shared';

const [jsonCsvTool, csvJsonTool] = conversionPair({
  aliasId: 'csv-to-json',
  aliasName: 'CSV to JSON',
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  decode: {
    fields: csvReadFields,
    run: ({ fields, text }) =>
      withToolError(() => {
        const records = convertCsvToJson(text, csvParseOptions(fields));
        const converted = JSON.stringify(records, null, 2);

        return {
          artifact: {
            base64: encodeBase64Text(converted),
            fileName: 'converted.json',
            mimeType: 'application/json;charset=utf-8',
          },
          language: 'json',
          summary: `Converted ${records.length} CSV records to JSON · cell values remain strings.`,
          text: converted,
        };
      }),
  },
  decodedLabel: 'JSON',
  description:
    'Convert JSON records to CSV or TSV and CSV back to JSON, with quoted headers, multiline cells, leading zeros and an explicit separator.',
  encode: {
    fields: [
      csvSeparatorField,
      {
        defaultValue: 'lf',
        id: 'lineEnding',
        label: 'Record line endings',
        options: [
          { label: 'LF', value: 'lf' },
          { label: 'CRLF', value: 'crlf' },
        ],
        presentation: 'segmented',
        type: 'select',
      },
      {
        defaultValue: 'false',
        help: 'Adds an apostrophe to formula-like string cells and headers, then quotes them. This changes the data and is not a universal spreadsheet safety guarantee.',
        id: 'escapeFormulas',
        label: 'Prefix formula-like text',
        type: 'checkbox',
      },
    ],
    run: ({ fields, text }) =>
      withToolError(() => {
        const options = csvWriteOptions(fields);
        const converted = convertJsonToCsv(text, options);
        const isTsv = options.delimiter === '\t';

        return {
          artifact: {
            base64: encodeBase64Text(converted),
            fileName: isTsv ? 'converted.tsv' : 'converted.csv',
            mimeType: isTsv
              ? 'text/tab-separated-values;charset=utf-8'
              : 'text/csv;charset=utf-8;header=present',
          },
          language: isTsv ? 'plaintext' : 'csv',
          summary: withWarning(
            converted
              ? `Converted JSON to ${isTsv ? 'TSV' : 'CSV'} · UTF-8 · ${options.lineEnding === '\r\n' ? 'CRLF' : 'LF'} records${options.escapeFormulas ? ' · formula-like strings prefixed' : ''}.`
              : `Converted an empty JSON array to an empty ${isTsv ? 'TSV' : 'CSV'} file · no header row or records.`,
            jsonDuplicateWarning(text),
          ),
          text: converted,
        };
      }),
  },
  encodedLabel: 'CSV',
  id: 'json-to-csv',
  inputKind: 'text',
  keywords: [
    'csv',
    'tsv',
    'json to csv',
    'csv to json',
    'spreadsheet',
    'excel',
    'converter',
    'delimiter',
    'quoted headers',
    'leading zeros',
    'json records',
  ],
  name: 'JSON ↔ CSV Converter',
  outputKind: 'text',
  relatedToolIds: ['csv-profiler', 'json-table', 'json-format', 'json-to-yaml'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  supportsSelection: true,
  samples: [
    {
      fields: { delimiter: 'comma', escapeFormulas: 'false', lineEnding: 'lf', mode: 'encode' },
      label: 'JSON → CSV: Users',
      text: '[{"name":"Ada","role":"admin"},{"name":"Grace","role":"dev"}]',
    },
    {
      fields: { delimiter: 'comma', escapeFormulas: 'false', lineEnding: 'lf', mode: 'encode' },
      label: 'JSON → CSV: Quoted headers and Unicode',
      text: '[{"last,name":"Příliš žluťoučký kůň 🐎.","note":"He said \\"yes\\".\\nSecond line."}]',
    },
    {
      fields: { delimiter: 'comma', escapeFormulas: 'false', lineEnding: 'lf', mode: 'encode' },
      label: 'JSON → CSV: Nested values and blanks',
      text: '[{"name":"Ada","roles":["admin","editor"],"profile":{"active":true},"note":null},{"name":"Grace","roles":[],"note":""}]',
    },
    {
      fields: { delimiter: 'tab', escapeFormulas: 'false', lineEnding: 'lf', mode: 'encode' },
      label: 'JSON → CSV: Tab-separated export',
      text: '[{"id":"001","name":"Ada","note":"one\\ttwo"},{"id":"002","name":"Grace","note":"done"}]',
    },
    {
      fields: { delimiter: 'comma', escapeFormulas: 'true', lineEnding: 'lf', mode: 'encode' },
      label: 'JSON → CSV: Formula-like strings',
      text: '[{"note":"=1+1","amount":-5,"id":"001"},{"note":"  @SUM(A1:A2)","amount":10,"id":"002"}]',
    },
    {
      fields: { delimiter: 'comma', mode: 'decode', skipEmptyLines: 'true' },
      label: 'CSV → JSON: Users',
      text: 'name,role\nAda,admin\nGrace,dev',
    },
    {
      fields: { delimiter: 'comma', mode: 'decode', skipEmptyLines: 'true' },
      label: 'CSV → JSON: Quoted headers and Unicode',
      text: '"last,name",note\n"Příliš žluťoučký kůň 🐎.","He said ""yes"".\nSecond line."',
    },
    {
      fields: { delimiter: 'comma', mode: 'decode', skipEmptyLines: 'true' },
      label: 'CSV → JSON: Leading zeros and empty records',
      text: 'id,active,note\n00123,true,""\n,,\n9007199254740993,false,"  text  "',
    },
    {
      fields: { delimiter: 'semicolon', mode: 'decode', skipEmptyLines: 'true' },
      label: 'CSV → JSON: Semicolon records',
      text: 'id;amount;note\r\n001;12.5;"one; two"\r\n002;-5;done',
    },
    {
      fields: { delimiter: 'tab', mode: 'decode', skipEmptyLines: 'true' },
      label: 'CSV → JSON: Tab-separated records',
      text: 'id\tname\tnote\n001\tAda\t"one\ttwo"\n002\tGrace\tdone',
    },
    {
      fields: { delimiter: 'comma', mode: 'decode', skipEmptyLines: 'false' },
      label: 'CSV → JSON: Retain one-column blank lines',
      text: 'note\nfirst\n\n""\nlast',
    },
  ],
});

export const jsonToCsvTool = jsonCsvTool;
export const csvToJsonTool = csvJsonTool;
