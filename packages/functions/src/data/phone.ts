import type { CountryCode, PhoneNumber } from 'libphonenumber-js/max';
import { FunctionError } from '../errors';
import { phoneCallingCodes } from './phoneRegions';

let phoneLibrary: Promise<typeof import('libphonenumber-js/max')> | undefined;

/** The full numbering-plan metadata is large, so it loads the first time a number is checked. */
function loadPhoneLibrary(): Promise<typeof import('libphonenumber-js/max')> {
  phoneLibrary ??= import('libphonenumber-js/max');

  return phoneLibrary;
}

export interface PhoneReport {
  country: CountryCode | null;
  countryCode: string;
  digits: string;
  e164: string;
  extension: string | null;
  international: string;
  national: string;
  nationalNumber: string;
  possible: boolean;
  type: string | null;
  uri: string;
  valid: boolean;
}

export interface PhoneRegion {
  callingCode: string;
  code: CountryCode;
  label: string;
}

export function listPhoneRegions(): PhoneRegion[] {
  const names = new Intl.DisplayNames(['en'], { type: 'region' });

  return Object.entries(phoneCallingCodes)
    .map(([code, callingCode]) => ({
      callingCode,
      code: code as CountryCode,
      label: names.of(code) ?? code,
    }))
    .sort((left: PhoneRegion, right: PhoneRegion) => left.label.localeCompare(right.label, 'en'));
}

export async function formatPhone(value: string, defaultRegion = 'US'): Promise<PhoneReport> {
  if (value.length > 128)
    throw phoneError('INPUT_TOO_LARGE', 'Phone input exceeds 128 characters.');

  const input = value.trim().replace(/^tel:/i, '');

  if (!input) throw phoneError('REQUIRED_INPUT', 'Phone input is required.');

  const extension = input.match(/(?:\s*(?:ext\.?|x|#)\s*|;ext=)(\d{1,10})$/i);
  const number = extension ? input.slice(0, extension.index).trim() : input;

  if (!/^\+?[\d\s().-]+$/.test(number) || !hasBalancedParentheses(number)) {
    throw phoneError(
      'INVALID_PHONE',
      'Enter one complete phone number, not prose or a vanity number. Use digits, an optional leading +, spaces, dots, hyphens or balanced parentheses; append ext. 123 or ;ext=123 for a numeric extension.',
    );
  }

  const options = phoneParseOptions(defaultRegion.trim().toUpperCase(), number);
  const { parsePhoneNumberWithError } = await loadPhoneLibrary();
  let phone: PhoneNumber;

  try {
    phone = parsePhoneNumberWithError(number, options);
  } catch {
    throw phoneError(
      'INVALID_PHONE',
      'The number cannot be parsed. Check the country calling code and enter the complete national number, including any area code.',
    );
  }

  if (!phone.isPossible())
    throw phoneError(
      'INVALID_PHONE_LENGTH',
      'The number has an impossible length for this numbering plan. Check the selected country and include the area code.',
    );
  if (!phone.isValid())
    throw phoneError(
      'INVALID_PHONE_PATTERN',
      'The length is possible, but the digits do not match the bundled numbering-plan rules. Check the prefix and selected country.',
    );
  if (extension) phone.setExt(extension[1]!);

  return phoneReport(phone);
}

function phoneParseOptions(region: string, number: string) {
  const options: { defaultCallingCode?: string; defaultCountry?: CountryCode; extract: boolean } = {
    extract: false,
  };

  if (region === 'INTERNATIONAL') {
    if (!number.startsWith('+'))
      throw phoneError(
        'COUNTRY_REQUIRED',
        'International-only mode requires a leading + and country calling code. Choose a country for a national number.',
      );
  } else if (Object.hasOwn(phoneCallingCodes, region))
    options.defaultCountry = region as CountryCode;
  else if (/^[1-9]\d{0,2}$/.test(region) && Object.values(phoneCallingCodes).includes(region))
    options.defaultCallingCode = region;
  else
    throw phoneError(
      'INVALID_COUNTRY',
      'Choose a supported two-letter country code or International only. Legacy numeric country calling codes remain supported.',
    );

  return options;
}

function phoneReport(phone: PhoneNumber): PhoneReport {
  return {
    country: phone.country ?? null,
    countryCode: phone.countryCallingCode,
    digits: phone.number.slice(1),
    e164: phone.number,
    extension: phone.ext ?? null,
    international: phone.formatInternational(),
    national: phone.formatNational(),
    nationalNumber: phone.nationalNumber,
    possible: phone.isPossible(),
    type: phone.getType() ?? null,
    uri: phone.getURI(),
    valid: phone.isValid(),
  };
}

function hasBalancedParentheses(value: string): boolean {
  let isOpen = false;

  for (const character of value) {
    if (character === '(') {
      if (isOpen) return false;

      isOpen = true;
    } else if (character === ')') {
      if (!isOpen) return false;

      isOpen = false;
    }
  }

  return !isOpen;
}

function phoneError(code: string, message: string): FunctionError {
  return new FunctionError(code, message);
}
