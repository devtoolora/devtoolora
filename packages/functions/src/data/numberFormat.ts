import { FunctionError } from '../errors';

export interface NumberFormatOptions {
  currency?: string;
  decimals?: number;
  grouping?: boolean;
  locale?: string;
  mode?: 'decimal' | 'currency' | 'percent';
  precision?: 'maximum' | 'fixed';
}

export interface NumberFormatReport {
  currency: string | null;
  formatted: string;
  input: string;
  locale: string;
  maximumFractionDigits: number;
  minimumFractionDigits: number;
  mode: 'decimal' | 'currency' | 'percent';
  parts: Intl.NumberFormatPart[];
}

export function formatNumber(
  value: number | bigint | string,
  options: NumberFormatOptions = {},
): string {
  return formatNumberReport(value, options).formatted;
}

export function formatNumberReport(
  value: number | bigint | string,
  options: NumberFormatOptions = {},
): NumberFormatReport {
  const input = decimalInput(value);
  const mode = options.mode ?? 'decimal';

  if (mode !== 'decimal' && mode !== 'currency' && mode !== 'percent')
    throw numberError('INVALID_MODE', 'Choose Decimal, Currency or Percent mode.');

  const precision = options.precision ?? (mode === 'currency' ? 'fixed' : 'maximum');

  if (precision !== 'maximum' && precision !== 'fixed')
    throw numberError('INVALID_PRECISION', 'Choose Maximum or Fixed fraction digits.');

  const locale = checkedLocale(options.locale ?? 'en-US');
  const currency = mode === 'currency' ? checkedCurrency(options.currency ?? 'USD') : undefined;
  const currencyDigits = currency
    ? (new Intl.NumberFormat(locale, { currency, style: 'currency' }).resolvedOptions()
        .maximumFractionDigits ?? 2)
    : 2;
  const decimals = options.decimals ?? currencyDigits;

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20)
    throw numberError('INVALID_DECIMALS', 'Fraction digits must be an integer from 0 through 20.');
  if (options.grouping !== undefined && typeof options.grouping !== 'boolean')
    throw numberError('INVALID_GROUPING', 'Grouping must be true or false.');

  const formatter = new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: decimals,
    minimumFractionDigits: precision === 'fixed' ? decimals : 0,
    style: mode,
    useGrouping: options.grouping ?? true,
  });
  const parsed = exactInput(input);
  // ECMA-402 accepts exact decimal strings; older TypeScript Intl declarations omit them.
  const parts: Intl.NumberFormatPart[] = Reflect.apply(formatter.formatToParts, formatter, [
    parsed,
  ]);
  const resolved = formatter.resolvedOptions();

  return {
    currency: currency ?? null,
    formatted: parts.map((part: Intl.NumberFormatPart) => part.value).join(''),
    input,
    locale: resolved.locale,
    maximumFractionDigits: resolved.maximumFractionDigits ?? decimals,
    minimumFractionDigits: resolved.minimumFractionDigits ?? (precision === 'fixed' ? decimals : 0),
    mode,
    parts,
  };
}

function decimalInput(value: number | bigint | string): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw numberError(
        'INVALID_NUMBER',
        'Input must be finite. NaN and Infinity are not supported.',
      );
    if (Number.isInteger(value) && !Number.isSafeInteger(value))
      throw numberError(
        'UNSAFE_NUMBER',
        'Pass a large integer as a decimal string or bigint; a JavaScript Number may already have lost digits.',
      );
  }

  const raw = typeof value === 'number' && Object.is(value, -0) ? '-0' : String(value);

  if (raw.length > 1024)
    throw numberError('INPUT_TOO_LARGE', 'Number input exceeds 1024 characters.');

  const input = raw.trim();

  if (!input) throw numberError('REQUIRED_INPUT', 'Number input is required.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input))
    throw numberError(
      'INVALID_NUMBER',
      'Use one ungrouped decimal number with a dot, optional sign and optional e exponent. Locale separators, currency symbols, percentages and hexadecimal notation are not input syntax.',
    );

  return input;
}

function exactInput(input: string): bigint | string {
  if (/^[+-]?\d+$/.test(input) && !/^-0+$/.test(input)) return BigInt(input);

  const magnitude = Number(input);
  const nonzero = /[1-9]/.test(input.split(/[eE]/)[0] ?? '');

  if (!Number.isFinite(magnitude) || (magnitude === 0 && nonzero))
    throw numberError(
      'NUMBER_OUT_OF_RANGE',
      'Decimal/exponent input is outside Intl’s finite magnitude range. Plain integers can use up to 1024 input characters.',
    );

  const probe = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, useGrouping: false });

  if (Reflect.apply(probe.format, probe, ['9007199254740993.1']) !== '9007199254740993.1')
    throw numberError(
      'EXACT_DECIMAL_UNAVAILABLE',
      'This runtime does not support exact decimal strings in Intl.NumberFormat. Update the browser or app; no precision-losing fallback is used.',
    );

  return input;
}

function checkedLocale(value: string): string {
  if (value.length > 128 || !value.trim())
    throw numberError('INVALID_LOCALE', 'Enter one BCP 47 locale, such as en-US, cs-CZ or de-DE.');

  try {
    const locales = Intl.getCanonicalLocales(value.trim());

    if (Intl.NumberFormat.supportedLocalesOf(locales).length !== 1)
      throw new Error('Unsupported locale.');

    const [locale] = locales;

    if (locale === undefined) throw new Error('Unsupported locale.');

    return locale;
  } catch {
    throw numberError(
      'INVALID_LOCALE',
      'The locale is malformed or its language is unavailable in this runtime. Use a supported tag such as en-US, cs-CZ or de-DE.',
    );
  }
}

function checkedCurrency(value: string): string {
  const currency = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency) || !Intl.supportedValuesOf('currency').includes(currency))
    throw numberError(
      'INVALID_CURRENCY',
      'Use a currency code available in this runtime, such as USD, EUR, CZK or JPY. This formatter does not accept arbitrary three-letter labels.',
    );

  return currency;
}

function numberError(code: string, message: string): FunctionError {
  return new FunctionError(code, message);
}
