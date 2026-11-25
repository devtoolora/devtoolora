import { logError } from './shared';
import { errnoTable, shellTable, signalsTable, sysexitsTable } from './exitCodesData';

export type ExitTable = 'all' | 'errno' | 'exit' | 'signals';

export const exitTables: readonly ExitTable[] = ['all', 'errno', 'signals', 'exit'];

export type ExitRow = {
  code: number;
  description: string;
  name: string;
  table: 'errno' | 'exit' | 'signal' | 'sysexits';
};

type Tables = {
  errno: ExitRow[];
  exit: ExitRow[];
  signal: ExitRow[];
  sysexits: ExitRow[];
};

const maxQueryLength = 64;
const aliases = new Map([
  ['EWOULDBLOCK', 'EAGAIN'],
  ['EDEADLOCK', 'EDEADLK'],
  ['ENOTSUP', 'EOPNOTSUPP'],
]);

type Index = { byCode: Map<number, ExitRow[]>; byName: Map<string, ExitRow[]> };

let tables: Tables | undefined;
let indexes: Map<keyof Tables, Index> | undefined;

// Only the first `columns - 1` commas separate columns; the last column may contain commas.
function parse(table: string, columns: number, build: (parts: string[]) => ExitRow): ExitRow[] {
  return table.split('|').map((line) => {
    const parts = line.split(',');

    return build([...parts.slice(0, columns - 1), parts.slice(columns - 1).join(',')]);
  });
}

function loadTables(): Tables {
  tables ??= {
    errno: parse(errnoTable, 3, ([code, name, description]) => ({
      code: Number(code),
      description: description ?? '',
      name: name ?? '',
      table: 'errno',
    })),
    exit: parse(shellTable, 2, ([code, description]) => ({
      code: Number(code),
      description: description ?? '',
      name: '',
      table: 'exit',
    })),
    signal: parse(signalsTable, 4, ([code, name, action, description]) => ({
      code: Number(code),
      description: `${description ?? ''} (default action: ${action ?? ''})`,
      name: name ?? '',
      table: 'signal',
    })),
    sysexits: parse(sysexitsTable, 3, ([code, name, description]) => ({
      code: Number(code),
      description: description ?? '',
      name: name ?? '',
      table: 'sysexits',
    })),
  };

  return tables;
}

function indexOf(name: keyof Tables): Index {
  indexes ??= new Map();

  let index = indexes.get(name);

  if (!index) {
    index = { byCode: new Map(), byName: new Map() };

    for (const row of loadTables()[name]) {
      index.byCode.set(row.code, [...(index.byCode.get(row.code) ?? []), row]);
      index.byName.set(row.name, [...(index.byName.get(row.name) ?? []), row]);
    }

    indexes.set(name, index);
  }

  return index;
}

function tablesFor(table: ExitTable): Array<keyof Tables> {
  const order: Record<ExitTable, Array<keyof Tables>> = {
    all: ['exit', 'sysexits', 'signal', 'errno'],
    errno: ['errno'],
    exit: ['exit', 'sysexits'],
    signals: ['signal'],
  };

  return order[table];
}

function numericRows(code: number, names: Array<keyof Tables>): ExitRow[] {
  const rows: ExitRow[] = [];

  if (names.includes('exit') && code <= 255) {
    const shell = indexOf('exit').byCode.get(code) ?? [];
    const signal =
      code >= 129 && code <= 159 ? indexOf('signal').byCode.get(code - 128)?.[0] : undefined;

    rows.push(...shell);

    if (signal) {
      rows.push({
        code,
        description: `Killed by signal ${signal.code} (${signal.name})`,
        name: '',
        table: 'exit',
      });
    }

    const sysexit = names.includes('sysexits') && indexOf('sysexits').byCode.has(code);

    if (shell.length === 0 && !signal && !sysexit) {
      rows.push({
        code,
        description: `Exit status ${code} (program-defined)`,
        name: '',
        table: 'exit',
      });
    }
  }

  for (const name of names) {
    if (name !== 'exit') {
      rows.push(...(indexOf(name).byCode.get(code) ?? []));
    }
  }

  return rows;
}

function nameRows(query: string, names: Array<keyof Tables>): ExitRow[] {
  const upper = query.toUpperCase();
  const canonical = aliases.get(upper) ?? upper;
  const candidates: Array<[keyof Tables, string]> = [
    ['sysexits', upper],
    ['sysexits', `EX_${upper}`],
    ['signal', upper],
    ['signal', `SIG${upper}`],
    ['errno', canonical],
  ];
  const rows: ExitRow[] = [];

  for (const [table, name] of candidates) {
    if (names.includes(table)) {
      rows.push(...(indexOf(table).byName.get(name) ?? []).filter((row) => !rows.includes(row)));
    }
  }

  return rows;
}

export function lookupExitCodes(query: string, table: ExitTable): ExitRow[] {
  if (query.length > maxQueryLength) {
    throw logError('Query exceeds 64 characters.');
  }

  const trimmed = query.trim();
  const names = tablesFor(table);

  if (trimmed === '') {
    const all = loadTables();

    return names.flatMap((name) => all[name]);
  }

  const rows = /^\d+$/.test(trimmed)
    ? numericRows(Number(trimmed), names)
    : nameRows(trimmed, names);

  if (rows.length === 0) {
    throw logError(`No exit code, errno or signal named "${trimmed}".`);
  }

  return rows;
}
