import { nonBlankLines } from './lineInput';

export type GtinKind = 'auto' | 'ean13' | 'ean8' | 'gtin14' | 'isbn10' | 'isbn13' | 'issn' | 'upca';

export const gtinKinds: readonly GtinKind[] = [
  'auto',
  'ean13',
  'ean8',
  'gtin14',
  'isbn10',
  'isbn13',
  'issn',
  'upca',
];

const kindLabels: Record<GtinKind, string> = {
  auto: 'Auto',
  ean13: 'EAN-13',
  ean8: 'EAN-8',
  gtin14: 'GTIN-14',
  isbn10: 'ISBN-10',
  isbn13: 'ISBN-13',
  issn: 'ISSN',
  upca: 'UPC-A',
};

const kindLengths: Record<Exclude<GtinKind, 'auto'>, number> = {
  ean13: 13,
  ean8: 8,
  gtin14: 14,
  isbn10: 10,
  isbn13: 13,
  issn: 8,
  upca: 12,
};

export function gtinKindLabel(kind: GtinKind): string {
  return kindLabels[kind];
}

export interface GtinCheck {
  checkDigit: string;
  conversions: string[];
  input: string;
  type: string;
  valid: boolean;
}

function gs1CheckDigit(digits: string): string {
  const sum = [...digits]
    .reverse()
    .reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 3 : 1), 0);

  return String((10 - (sum % 10)) % 10);
}

function weightedMod11(digits: string, firstWeight: number): string {
  const sum = [...digits].reduce(
    (total, char, index) => total + Number(char) * (firstWeight - index),
    0,
  );
  const check = (11 - (sum % 11)) % 11;

  return check === 10 ? 'X' : String(check);
}

const isbn10CheckDigit = (digits: string): string => weightedMod11(digits, 10);
const issnCheckDigit = (digits: string): string => weightedMod11(digits, 8);

function expectedDigit(kind: Exclude<GtinKind, 'auto'>, payload: string): string {
  if (kind === 'isbn10') return isbn10CheckDigit(payload);

  return kind === 'issn' ? issnCheckDigit(payload) : gs1CheckDigit(payload);
}

function detectKind(raw: string, norm: string): Exclude<GtinKind, 'auto'> | undefined {
  if (norm.length === 8)
    return /^\d{4}-\d{3}[\dXx]$/.test(raw) || /[Xx]$/.test(norm) ? 'issn' : 'ean8';

  if (norm.length === 10) return 'isbn10';

  if (norm.length === 12) return 'upca';

  if (norm.length === 13) return /^97[89]/.test(norm) ? 'isbn13' : 'ean13';

  return norm.length === 14 ? 'gtin14' : undefined;
}

function conversionsFor(kind: Exclude<GtinKind, 'auto'>, norm: string): string[] {
  const gtin14 = `GTIN-14 ${norm.padStart(14, '0')}`;

  switch (kind) {
    case 'ean13':
    case 'ean8':
      return [gtin14];
    case 'upca':
      return [`EAN-13 ${norm.padStart(13, '0')}`, gtin14];

    case 'isbn10': {
      const body = `978${norm.slice(0, 9)}`;

      return [`ISBN-13 ${body}${gs1CheckDigit(body)}`];
    }

    case 'isbn13':
      return norm.startsWith('978')
        ? [`ISBN-10 ${norm.slice(3, 12)}${isbn10CheckDigit(norm.slice(3, 12))}`, gtin14]
        : [gtin14];
    default:
      return [];
  }
}

function checkLine(line: string, forced: GtinKind): GtinCheck {
  const input = line.trim();
  const norm = input.replace(/[ -]/g, '');
  const unknown: GtinCheck = {
    checkDigit: '',
    conversions: [],
    input,
    type: 'Unknown',
    valid: false,
  };

  // The check character may be X only in the last position; Unicode digits are not digits.
  if (!/^[0-9]+[0-9Xx]$|^[0-9]$/.test(norm)) return unknown;

  const kind = forced === 'auto' ? detectKind(input, norm) : forced;

  if (!kind) return unknown;

  const type = kindLabels[kind];
  const payload = norm.slice(0, -1);

  if (norm.length !== kindLengths[kind] || !/^[0-9]*$/.test(payload)) return { ...unknown, type };

  const checkDigit = expectedDigit(kind, payload);
  const prefixOk = kind !== 'isbn13' || /^97[89]/.test(norm);
  const valid = prefixOk && norm.slice(-1).toUpperCase() === checkDigit;

  return { checkDigit, conversions: valid ? conversionsFor(kind, norm) : [], input, type, valid };
}

export function validateGtins(text: string, kind: GtinKind): GtinCheck[] {
  return nonBlankLines(text).map((line) => checkLine(line, kind));
}
