import { rawLicenses } from './licenseTexts';
import { devError } from './shared';

export const licenseIds = [
  'mit',
  'apache-2.0',
  'bsd-2-clause',
  'bsd-3-clause',
  'isc',
  'mpl-2.0',
  'gpl-3.0',
  'unlicense',
] as const;

export type LicenseId = (typeof licenseIds)[number];

export const licenseNames: ReadonlyMap<LicenseId, string> = new Map([
  ['mit', 'MIT License'],
  ['apache-2.0', 'Apache License 2.0'],
  ['bsd-2-clause', 'BSD 2-Clause "Simplified" License'],
  ['bsd-3-clause', 'BSD 3-Clause "New" or "Revised" License'],
  ['isc', 'ISC License'],
  ['mpl-2.0', 'Mozilla Public License 2.0'],
  ['gpl-3.0', 'GNU General Public License v3.0'],
  ['unlicense', 'The Unlicense'],
]);

export const licenseTexts: ReadonlyMap<LicenseId, string> = new Map(
  licenseIds.map((id) => [id, rawLicenses[id]]),
);

export const holderLicenseIds: readonly LicenseId[] = [
  'mit',
  'bsd-2-clause',
  'bsd-3-clause',
  'isc',
];

const maxHolderLength = 200;

export function generateLicense(
  options: { holder: string; id: string; year: string },
  now: Date = new Date(),
): { name: string; text: string; year: string } {
  const id = licenseIds.find((candidate) => candidate === options.id);
  const template = id === undefined ? undefined : licenseTexts.get(id);
  const name = id === undefined ? undefined : licenseNames.get(id);

  if (id === undefined || template === undefined || name === undefined)
    throw devError('Choose a license.');

  if (!holderLicenseIds.includes(id)) return { name, text: template, year: '' };

  const holder = options.holder.trim();
  const year = options.year.trim() === '' ? String(now.getUTCFullYear()) : options.year.trim();

  if (holder === '') throw devError('Enter the copyright holder.');
  if (/[\r\n]/.test(holder)) throw devError('Copyright holder must be one line.');
  if (holder.length > maxHolderLength)
    throw devError(`Copyright holder is limited to ${maxHolderLength} characters.`);
  if (!/^\d{4}$/.test(year)) throw devError('Year must have 4 digits.');

  // One pass, so a holder that contains "[year]" is never filled in again.
  const text = template.replace(/\[(year|fullname)\]/g, (_, key: string) =>
    key === 'year' ? year : holder,
  );

  return { name, text, year };
}
