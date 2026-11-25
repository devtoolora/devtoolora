import { FunctionError } from '../errors';
import { ibanRegistry, ibanRegistryVersion } from './ibanRegistry';

export type IbanCheckStatus = 'pass' | 'fail' | 'not-checked';

export interface IbanIssue {
  code: string;
  message: string;
}

export interface IbanReport {
  bban: string;
  checkDigits: string;
  checks: {
    checkDigits: IbanCheckStatus;
    checksum: IbanCheckStatus;
    country: IbanCheckStatus;
    length: IbanCheckStatus;
    structure: IbanCheckStatus;
    syntax: IbanCheckStatus;
  };
  country: string;
  expectedLength: number | null;
  iban: string;
  issues: IbanIssue[];
  length: number;
  printFormat: string;
  registry: string;
  remainder: number | null;
  structure: string | null;
  valid: boolean;
}

const bbanCharacterClasses: Record<string, string> = {
  a: '[A-Z]',
  c: '[A-Z0-9]',
  n: '[0-9]',
};

export function validateIban(value: string): IbanReport {
  if (value.length > 128)
    throw new FunctionError('INPUT_TOO_LARGE', 'IBAN input exceeds 128 characters.');
  if (!value.trim()) throw new FunctionError('REQUIRED_INPUT', 'IBAN input is required.');

  const iban = value.replace(/\s+/g, '').toUpperCase();
  const country = iban.slice(0, 2);
  const checkDigits = iban.slice(2, 4);
  const bban = iban.slice(4);
  const spec = Object.hasOwn(ibanRegistry, country) ? ibanRegistry[country] : undefined;
  const hasSyntax = /^[a-zA-Z0-9\s]+$/.test(value) && /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban);
  const hasCheckDigits =
    /^\d{2}$/.test(checkDigits) && Number(checkDigits) >= 2 && Number(checkDigits) <= 98;
  const hasLength = spec !== undefined && iban.length === spec.length;
  const checks: IbanReport['checks'] = {
    checkDigits: hasSyntax ? status(hasCheckDigits) : 'not-checked',
    checksum: 'not-checked',
    country: status(spec !== undefined),
    length: spec ? status(hasLength) : 'not-checked',
    structure: 'not-checked',
    syntax: status(hasSyntax),
  };
  let remainder: number | null = null;

  if (hasSyntax && iban.length <= 34) {
    remainder = ibanRemainder(iban);
    checks.checksum = status(remainder === 1 && hasCheckDigits);
  }

  if (spec && hasSyntax && hasLength) checks.structure = status(matchesBbanStructure(bban, spec));

  const issues = collectIbanIssues({ checks, country, hasSyntax, iban, spec });

  return {
    bban,
    checkDigits,
    checks,
    country,
    expectedLength: spec?.length ?? null,
    iban,
    issues,
    length: iban.length,
    printFormat: iban.match(/.{1,4}/g)?.join(' ') ?? '',
    registry: ibanRegistryVersion,
    remainder,
    structure: spec ? country + '2!n' + spec.bbanStructure : null,
    valid: Object.values(checks).every((check: IbanCheckStatus) => check === 'pass'),
  };
}

function matchesBbanStructure(bban: string, spec: IbanSpec): boolean {
  const pattern = spec.bbanStructure.replace(
    /(\d+)!([nac])/g,
    (_: string, length: string, kind: string) => bbanCharacterClasses[kind] + '{' + length + '}',
  );

  return new RegExp('^(?:' + pattern + ')$').test(bban);
}

type IbanSpec = (typeof ibanRegistry)[string];

function collectIbanIssues(context: {
  checks: IbanReport['checks'];
  country: string;
  hasSyntax: boolean;
  iban: string;
  spec: IbanSpec | undefined;
}): IbanIssue[] {
  const { checks, country, hasSyntax, iban, spec } = context;
  const issues: IbanIssue[] = [];

  if (!hasSyntax)
    issues.push({
      code: 'INVALID_SYNTAX',
      message:
        'Use two ASCII country letters, two check digits and an alphanumeric BBAN. Whitespace and lowercase letters are normalized; punctuation and non-ASCII letters or digits are not accepted.',
    });
  if (!spec)
    issues.push({
      code: 'UNSUPPORTED_COUNTRY',
      message: `${country || 'Missing prefix'} is not an IBAN prefix in the bundled registry. Use the registered IBAN prefix, not a guessed territory or bank-country code.`,
    });
  if (checks.checkDigits === 'fail')
    issues.push({
      code: 'INVALID_CHECK_DIGITS',
      message:
        'IBAN check digits must be from 02 through 98; 00, 01 and 99 are not valid check-digit values.',
    });
  if (checks.length === 'fail')
    issues.push({
      code: 'INVALID_LENGTH',
      message: `${country} requires ${spec?.length} characters; received ${iban.length}. Do not add, truncate or strip significant zeroes.`,
    });
  if (checks.structure === 'fail')
    issues.push({
      code: 'INVALID_BBAN_STRUCTURE',
      message: `The BBAN does not match ${spec?.bbanStructure}: n means digit, a means letter and c means alphanumeric; ! indicates a fixed count.`,
    });
  if (checks.checksum === 'fail')
    issues.push({
      code: 'INVALID_CHECKSUM',
      message:
        'The MOD 97-10 check failed. Verify the original account details; this tool does not repair check digits.',
    });

  return issues;
}

function ibanRemainder(iban: string): number {
  let remainder = 0;

  for (const character of iban.slice(4) + iban.slice(0, 4)) {
    const digits =
      character >= 'A' && character <= 'Z' ? String(character.charCodeAt(0) - 55) : character;

    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }

  return remainder;
}

function status(passed: boolean): IbanCheckStatus {
  return passed ? 'pass' : 'fail';
}
