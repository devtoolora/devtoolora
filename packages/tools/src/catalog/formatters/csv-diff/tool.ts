import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { diffCsv, type CsvDiff, type CsvDiffRow } from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

function count(value: number, noun: string): string {
  return `${value.toLocaleString('en-US')} ${noun}${value === 1 ? '' : 's'}`;
}

function cellsText(row: CsvDiffRow): string {
  return (row.cells ?? [])
    .map(
      (cell) =>
        `${JSON.stringify(cell.column)}: ${JSON.stringify(cell.before)} → ${JSON.stringify(cell.after)}`,
    )
    .join(', ');
}

function readableDiff(diff: CsvDiff, isKeyed: boolean): string {
  const lines = [
    ...diff.addedColumns.map((column) => `Added column ${JSON.stringify(column)}`),
    ...diff.removedColumns.map((column) => `Removed column ${JSON.stringify(column)}`),
    ...diff.rows.map((row) => {
      const kind = `${row.kind.charAt(0).toUpperCase()}${row.kind.slice(1)}`;
      const name = isKeyed ? `key ${JSON.stringify(row.key)}` : `row ${row.key}`;

      return row.cells ? `${kind} ${name}: ${cellsText(row)}` : `${kind} ${name}`;
    }),
  ];

  const shown = shownText(diff);

  if (shown) lines.push(`… ${shown}`);

  return lines.length ? lines.join('\n') : 'No differences.';
}

function shownText(diff: CsvDiff): string {
  const total = diff.added + diff.changed + diff.removed;

  return diff.rows.length < total
    ? `${diff.rows.length.toLocaleString('en-US')} of ${count(total, 'change')} shown.`
    : '';
}

function summary(diff: CsvDiff): string {
  const shown = shownText(diff);
  const columns = diff.addedColumns.length + diff.removedColumns.length;

  return [
    `${count(diff.added, 'row')} added, ${count(diff.removed, 'row')} removed, ${count(diff.changed, 'row')} changed.`,
    ...(columns
      ? [
          `${count(diff.addedColumns.length, 'column')} added, ${count(diff.removedColumns.length, 'column')} removed.`,
        ]
      : []),
    ...(shown ? [shown] : []),
  ].join(' ');
}

function compare(fields: Record<string, string>) {
  const key = fields.key?.trim() ? fields.key : '';
  const diff = diffCsv(fields.left ?? '', fields.right ?? '', { key });
  const text = readableDiff(diff, Boolean(key));

  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName: 'csv-diff.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    ...(diff.rows.length
      ? {
          jsonTable: {
            columns: ['Change', key ? 'Key' : 'Row', 'Cells'],
            presentation: 'plain' as const,
            rows: diff.rows.map((row) => [row.kind, row.key, cellsText(row)]),
          },
        }
      : {}),
    language: 'plaintext',
    summary: summary(diff),
    text,
  };
}

export const csvDiffTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Compare two CSV files locally by a key column or row by row, with added, removed and changed rows and the exact changed cells.',
  fields: [
    {
      defaultValue: '',
      help: 'Header name present in both CSVs, such as id. Leave empty to compare by data row number.',
      id: 'key',
      label: 'Key column',
      placeholder: 'id',
      type: 'text',
    },
    {
      id: 'left',
      label: 'First CSV (before)',
      placeholder: 'id,name\n1,Ada',
      required: true,
      rows: 10,
      type: 'textarea',
    },
    {
      id: 'right',
      label: 'Second CSV (after)',
      placeholder: 'id,name\n1,Ada Lovelace',
      required: true,
      rows: 10,
      type: 'textarea',
    },
  ],
  id: 'csv-diff',
  inputKind: 'none',
  keywords: [
    'csv',
    'tsv',
    'compare csv',
    'csv compare',
    'difference',
    'before after',
    'key column',
    'changed rows',
  ],
  name: 'CSV Diff',
  outputKind: 'text',
  relatedToolIds: ['json-diff', 'text-diff', 'csv-columns'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => withToolError(() => compare(fields)),
  samples: [
    {
      fields: {
        key: 'id',
        left: 'id,name,role\n1,Ada,engineer\n2,Grace,admiral',
        right: 'id,name,role\n2,Grace,rear admiral\n3,Linus,maintainer',
      },
      label: 'Compare by id',
    },
    {
      fields: {
        key: '',
        left: 'name,score\nAda,10\nGrace,8',
        right: 'name,score\nAda,10\nGrace,9\nLinus,7',
      },
      label: 'Row by row',
    },
    {
      fields: { key: 'sku', left: 'sku,price,color\nA1,10,red', right: 'sku,price,size\nA1,12,M' },
      label: 'Added and removed columns',
    },
    {
      fields: { key: 'id', left: 'id;city\n1;Prague\n2;Brno', right: 'id,city\n1,Prague\n2,Brno' },
      label: 'Different separators, no changes',
    },
    {
      fields: { key: 'id', left: 'id,value\n1,1.0\n2,a', right: 'id,value\n1,1\n2,A' },
      label: 'Exact value comparison',
    },
    {
      fields: { key: 'id', left: 'id,note\n1\n2,ok', right: 'id,note\n1,\n2,ok,extra' },
      label: 'Ragged rows',
    },
  ],
  supportsSelection: false,
};
