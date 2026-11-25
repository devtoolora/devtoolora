import { ToolDefinition } from '@devtoolora/core';
import {
  exitTables,
  lookupExitCodes,
  type ExitRow,
  type ExitTable,
} from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, logOutput } from '../shared';

const columns = ['Table', 'Code', 'Name', 'Description'];
const tableLabels = { errno: 'errno', exit: 'exit code', signal: 'signal', sysexits: 'sysexits' };
const tableOrder = ['exit', 'sysexits', 'signal', 'errno'] as const;
const countLabels: Record<ExitTable, string> = {
  all: 'entries',
  errno: 'errno values',
  exit: 'exit codes',
  signals: 'signals',
};

const cells = (row: ExitRow): string[] => [
  tableLabels[row.table],
  String(row.code),
  row.name,
  row.description,
];

function alignedText(rows: string[][]): string {
  const widths = columns.map((_, i) =>
    Math.max(...[columns, ...rows].map((r) => r[i]?.length ?? 0)),
  );

  return [columns, ...rows]
    .map((row) =>
      row
        .map((cell, i) => cell.padEnd(widths[i] ?? 0))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
}

function querySummary(query: string, found: ExitRow[]): string {
  const parts = tableOrder.flatMap((table) => {
    const first = found.find((row) => row.table === table);

    if (!first) {
      return [];
    }

    if (first.name === '') {
      const killed = /^Killed by signal \d+ \(([A-Z0-9]+)\)$/.exec(
        found.find((row) => row.table === 'exit' && row.description.startsWith('Killed'))
          ?.description ?? '',
      )?.[1];

      return killed ? [tableLabels[table], `signal ${killed}`] : [tableLabels[table]];
    }

    return [`${tableLabels[table]} ${first.name}`];
  });

  return [query, ...parts].join(' · ');
}

export const exitCodeReferenceTool: ToolDefinition = {
  id: 'exit-code-reference',
  name: 'Exit Code & errno Reference',
  category: 'Logs & Diagnostics',
  description:
    'Look up shell exit codes, sysexits, POSIX signals and Linux errno values by number or name.',
  samples: [
    { fields: { table: 'all' }, label: 'Exit code 2', text: '2' },
    { fields: { table: 'all' }, label: 'Exit code 130 (Ctrl-C)', text: '130' },
    { fields: { table: 'all' }, label: 'errno by name', text: 'ENOENT' },
    { fields: { table: 'all' }, label: 'Signal by name', text: 'SIGTERM' },
    { fields: { table: 'all' }, label: 'sysexits by name', text: 'EX_USAGE' },
    { fields: { table: 'signals' }, label: 'All signals', text: '' },
  ],
  inputKind: 'optionalText',
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'all',
      id: 'table',
      label: 'Table',
      options: [
        { label: 'All', value: 'all' },
        { label: 'errno', value: 'errno' },
        { label: 'Signals', value: 'signals' },
        { label: 'Exit codes', value: 'exit' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: ['exit code', 'errno', 'signal', 'sysexits', 'sigterm', 'enoent', 'exit status'],
  relatedToolIds: ['http-status', 'stack-trace-cleaner', 'chmod-calculator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() => {
      const table = exitTables.find((value) => value === fields.table) ?? 'all';
      const query = text.trim();
      const found = lookupExitCodes(query, table);
      const rows = found.map(cells);
      const summary =
        query === '' ? `${found.length} ${countLabels[table]}` : querySummary(query, found);

      return {
        ...logOutput(alignedText(rows), 'exit-codes.txt', 'plaintext', summary),
        jsonTable: { columns, presentation: 'plain', rows },
      };
    }),
};
