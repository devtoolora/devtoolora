import { FunctionError } from '../errors';
import { countriesTable, currenciesTable, languagesTable } from './isoCodesData';

export type IsoKind = 'all' | 'country' | 'currency' | 'language';

export const isoKinds: readonly IsoKind[] = ['all', 'country', 'currency', 'language'];

export type IsoRow = {
  alpha2: string;
  alpha3: string;
  detail: string;
  kind: 'country' | 'currency' | 'language';
  name: string;
  numeric: string;
};

type Entry = { keys: string[]; row: IsoRow; tableName: string };

const maxQueryLength = 256;
const maxRows = 1000;
const kindOrder = ['country', 'currency', 'language'] as const;
const displayNames = new Map<string, Intl.DisplayNames>();
let entries: Record<(typeof kindOrder)[number], Entry[]> | undefined;

// A name may contain commas, so only the first three commas separate columns.
function splitLine(line: string): [string, string, string, string] {
  const parts = line.split(',');

  return [parts[0] ?? '', parts[1] ?? '', parts[2] ?? '', parts.slice(3).join(',')];
}

const displayTypes: Record<(typeof kindOrder)[number], Intl.DisplayNamesType> = {
  country: 'region',
  currency: 'currency',
  language: 'language',
};

function isoDisplayName(kind: (typeof kindOrder)[number], code: string, fallback: string): string {
  const type = displayTypes[kind];

  try {
    let formatter = displayNames.get(kind);

    if (!formatter) {
      formatter = new Intl.DisplayNames(['en'], { type });
      displayNames.set(kind, formatter);
    }

    const name = formatter.of(code);

    return name && name !== code ? name : fallback;
  } catch {
    return fallback;
  }
}

function entry(row: IsoRow, tableName: string): Entry {
  const keys = [row.alpha2, row.alpha3, row.numeric]
    .filter(Boolean)
    .map((key) => key.toLowerCase());

  return { keys, row, tableName };
}

function parseTable(table: string): Array<[string, string, string, string]> {
  return table.split('|').map(splitLine);
}

function buildEntries(): Record<(typeof kindOrder)[number], Entry[]> {
  const country = parseTable(countriesTable).map(([alpha2, alpha3, numeric, name]) =>
    entry(
      {
        alpha2,
        alpha3,
        detail: '',
        kind: 'country',
        name: isoDisplayName('country', alpha2, name),
        numeric,
      },
      name,
    ),
  );
  const currency = parseTable(currenciesTable).map(([code, numeric, minor, name]) =>
    entry(
      {
        alpha2: '',
        alpha3: code,
        detail: minor === '-' ? 'no minor unit' : `${minor} minor units`,
        kind: 'currency',
        name: isoDisplayName('currency', code, name),
        numeric,
      },
      name,
    ),
  );
  const language = parseTable(languagesTable).map(([alpha2, alpha3, bibliographic, name]) => {
    const found = entry(
      {
        alpha2,
        alpha3,
        detail: bibliographic ? `639-2/B ${bibliographic}` : '',
        kind: 'language',
        name: isoDisplayName('language', alpha2, name),
        numeric: '',
      },
      name,
    );

    if (bibliographic) found.keys.push(bibliographic.toLowerCase());

    return found;
  });

  return { country, currency, language };
}

export function lookupIsoCodes(query: string, kind: IsoKind): IsoRow[] {
  if (query.length > maxQueryLength)
    throw new FunctionError('INPUT_TOO_LARGE', 'Query exceeds 256 characters.');

  entries ??= buildEntries();

  const needle = query.trim().toLowerCase();
  const kinds = kind === 'all' ? kindOrder : kindOrder.filter((item) => item === kind);

  const tiers: IsoRow[][] = [[], [], [], []];

  for (const item of kinds) {
    for (const candidate of entries[item]) {
      const names = [candidate.tableName, candidate.row.name].map((item) => item.toLowerCase());

      if (needle === '' || candidate.keys.includes(needle)) tiers[0]?.push(candidate.row);
      else if (names.includes(needle)) tiers[1]?.push(candidate.row);
      else if (names.some((name) => name.startsWith(needle))) tiers[2]?.push(candidate.row);
      else if (names.some((name) => name.includes(needle))) tiers[3]?.push(candidate.row);
    }
  }

  const rows = tiers.flat();

  if (rows.length === 0)
    throw new FunctionError(
      'NO_MATCH',
      `No country, currency or language matches "${query.trim().slice(0, 64)}".`,
    );

  return rows.slice(0, maxRows);
}
