import { FunctionError } from '../errors';
import { nonBlankLines } from './lineInput';
import { checksumVat } from './vatChecksums';

const gbFormat = /^(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/;

const formats = new Map<string, RegExp>([
  ['AT', /^U\d{8}$/],
  ['BE', /^[01]\d{9}$/],
  ['BG', /^\d{9,10}$/],
  ['CH', /^E\d{9}(MWST|TVA|IVA)?$/],
  ['CY', /^\d{8}[A-Z]$/],
  ['CZ', /^\d{8,10}$/],
  ['DE', /^\d{9}$/],
  ['DK', /^\d{8}$/],
  ['EE', /^\d{9}$/],
  ['EL', /^\d{9}$/],
  ['ES', /^[A-Z0-9]\d{7}[A-Z0-9]$/],
  ['FI', /^\d{8}$/],
  ['FR', /^[A-Z0-9]{2}\d{9}$/],
  ['GB', gbFormat],
  ['HR', /^\d{11}$/],
  ['HU', /^\d{8}$/],
  ['IE', /^(\d{7}[A-W][A-IW]?|\d[A-Z+*]\d{5}[A-W])$/],
  ['IT', /^\d{11}$/],
  ['LT', /^(\d{9}|\d{12})$/],
  ['LU', /^\d{8}$/],
  ['LV', /^\d{11}$/],
  ['MT', /^\d{8}$/],
  ['NL', /^\d{9}B\d{2}$/],
  ['NO', /^\d{9}(MVA)?$/],
  ['PL', /^\d{10}$/],
  ['PT', /^\d{9}$/],
  ['RO', /^\d{2,10}$/],
  ['SE', /^\d{12}$/],
  ['SI', /^\d{8}$/],
  ['SK', /^\d{10}$/],
  ['XI', gbFormat],
]);

const names = new Map<string, string>([
  ['AT', 'Austria'],
  ['BE', 'Belgium'],
  ['BG', 'Bulgaria'],
  ['CH', 'Switzerland'],
  ['CY', 'Cyprus'],
  ['CZ', 'Czechia'],
  ['DE', 'Germany'],
  ['DK', 'Denmark'],
  ['EE', 'Estonia'],
  ['EL', 'Greece'],
  ['ES', 'Spain'],
  ['FI', 'Finland'],
  ['FR', 'France'],
  ['GB', 'United Kingdom'],
  ['HR', 'Croatia'],
  ['HU', 'Hungary'],
  ['IE', 'Ireland'],
  ['IT', 'Italy'],
  ['LT', 'Lithuania'],
  ['LU', 'Luxembourg'],
  ['LV', 'Latvia'],
  ['MT', 'Malta'],
  ['NL', 'Netherlands'],
  ['NO', 'Norway'],
  ['PL', 'Poland'],
  ['PT', 'Portugal'],
  ['RO', 'Romania'],
  ['SE', 'Sweden'],
  ['SI', 'Slovenia'],
  ['SK', 'Slovakia'],
  ['XI', 'Northern Ireland'],
]);

export const vatCountries: readonly string[] = [...formats.keys()].sort();

export function vatCountryName(code: string): string {
  return names.get(code) ?? code;
}

export interface VatCheck {
  checksum: 'fail' | 'not checked' | 'pass';
  country: string;
  format: boolean;
  input: string;
  valid: boolean;
}

function checkLine(line: string, forced: string): VatCheck {
  const input = line.trim();
  const norm = input.replace(/[ .-]/g, '').toUpperCase();
  const prefix = norm.slice(0, 2);
  const country = forced || (formats.has(prefix) ? prefix : '??');
  const stripped = norm.slice(country === '??' || (forced && !norm.startsWith(forced)) ? 0 : 2);
  // A forced country may be given with or without its prefix; FR bodies can start with letters.
  const body = forced && !formats.get(country)?.test(stripped) ? norm : stripped;
  const format = formats.get(country)?.test(body) ?? false;
  const checksum = format ? checksumVat(country, body) : 'not checked';

  return { checksum, country, format, input, valid: format && checksum !== 'fail' };
}

export function validateVatNumbers(text: string, country: string): VatCheck[] {
  if (country && !formats.has(country))
    throw new FunctionError('INVALID_INPUT', 'Choose a supported country code.');

  return nonBlankLines(text).map((line) => checkLine(line, country));
}
