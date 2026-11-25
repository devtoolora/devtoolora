import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { profileCsv } from '@devtoolora/functions/schema';
import { withToolError } from '../../../adapters/errors';
import { csvParseOptions, csvReadFields } from '../../../adapters/csvOptions';
import { browserSafeCapabilities } from '../shared';

export const csvProfilerTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Data',
  description:
    'Inspect CSV or TSV column types, missing values, distinct values and precise integer ranges locally.',
  fields: csvReadFields,
  id: 'csv-profiler',
  inputKind: 'text',
  keywords: [
    'csv',
    'tsv',
    'profile',
    'columns',
    'data quality',
    'missing values',
    'uniqueness',
    'integer ranges',
  ],
  name: 'CSV Profiler',
  outputKind: 'markdown',
  relatedToolIds: ['json-to-csv', 'text-statistics', 'json-schema-validator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const report = profileCsv(text, csvParseOptions(fields));

      return {
        artifact: {
          base64: encodeBase64Text(report),
          fileName: 'csv-profile.md',
          mimeType: 'text/markdown;charset=utf-8',
        },
        language: 'markdown',
        summary: 'Profiled CSV locally · inferred types, not schema validation.',
        text: report,
      };
    }),
  samples: [
    {
      fields: { delimiter: 'comma', skipEmptyLines: 'true' },
      label: 'Users CSV',
      text: 'name,age,active,joined\nAda,37,true,2026-01-01\nGrace,40,false,2026-02-15\nLinus,,true,2026-03-20',
    },
    {
      fields: { delimiter: 'comma', skipEmptyLines: 'true' },
      label: 'Quoted headers and Unicode',
      text: '"last,name",note\n"Příliš žluťoučký kůň 🐎.","He said ""yes"".\nSecond line."',
    },
    {
      fields: { delimiter: 'comma', skipEmptyLines: 'true' },
      label: 'Identifiers and precise integers',
      text: 'id,total,date\n001,9007199254740993,2024-02-29\n002,9007199254740995,2026-02-30\n,,',
    },
    {
      fields: { delimiter: 'semicolon', skipEmptyLines: 'true' },
      label: 'Semicolon records',
      text: 'id;amount;note\r\n001;12.5;"one; two"\r\n002;-5;done',
    },
    {
      fields: { delimiter: 'tab', skipEmptyLines: 'true' },
      label: 'Tab-separated records',
      text: 'id\tname\tnote\n001\tAda\t"one\ttwo"\n002\tGrace\tdone',
    },
    {
      fields: { delimiter: 'comma', skipEmptyLines: 'false' },
      label: 'Retain one-column blank lines',
      text: 'note\nfirst\n\n""\nlast',
    },
  ],
  supportsSelection: true,
};
