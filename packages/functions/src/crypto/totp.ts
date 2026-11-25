import { FunctionError } from '../errors';
import { decodeBaseN, encodeBaseN } from '../encoding/baseN';
import { subtle } from './jwtKeyEncoding';

type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export type TotpConfig = {
  account?: string;
  algorithm: TotpAlgorithm;
  digits: 6 | 8;
  issuer?: string;
  period: number;
  secret: Uint8Array;
};

type TotpDefaults = Omit<TotpConfig, 'secret'>;

const MAX_INPUT = 4096;
const MAX_SECRET = 1024;
const uriNames: Record<string, TotpAlgorithm> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
};

function totpError(message: string): FunctionError {
  return new FunctionError('INVALID_TOTP', message);
}

function decodeSecret(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');

  if (clean.length > MAX_SECRET) throw totpError('Secret exceeds 1,024 characters.');
  if (!/^[A-Z2-7]+$/.test(clean))
    throw totpError('Secret must be Base32 (letters A-Z and digits 2-7).');

  return decodeBaseN(clean, 'base32');
}

function checkPeriod(period: number): number {
  if (!Number.isInteger(period) || period < 15 || period > 120)
    throw totpError('Period must be an integer between 15 and 120 seconds.');

  return period;
}

function parseUri(input: string, defaults: TotpDefaults): TotpConfig {
  let url: URL;
  let label: string;

  try {
    url = new URL(input);
    label = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw totpError('The otpauth URI is not valid.');
  }

  if (url.protocol !== 'otpauth:' || url.hostname.toLowerCase() !== 'totp')
    throw totpError('Only otpauth://totp/ URIs are supported.');

  const params = url.searchParams;
  const colon = label.indexOf(':');
  const labelIssuer = colon === -1 ? undefined : label.slice(0, colon).trim();
  const account = (colon === -1 ? label : label.slice(colon + 1)).trim();
  const algorithm = params.has('algorithm')
    ? uriNames[(params.get('algorithm') ?? '').toUpperCase()]
    : defaults.algorithm;
  const digits = params.has('digits') ? params.get('digits') : String(defaults.digits);

  if (!algorithm) throw totpError('Algorithm must be SHA1, SHA256 or SHA512.');
  if (digits !== '6' && digits !== '8') throw totpError('Digits must be 6 or 8.');

  return {
    account: account || defaults.account,
    algorithm,
    digits: digits === '8' ? 8 : 6,
    issuer: params.get('issuer') || labelIssuer || defaults.issuer,
    period: checkPeriod(params.has('period') ? Number(params.get('period')) : defaults.period),
    secret: decodeSecret(params.get('secret') ?? ''),
  };
}

export function parseTotpInput(input: string, defaults: TotpDefaults): TotpConfig {
  const text = input.trim();

  if (!text) throw totpError('Secret or otpauth URI is required.');
  if (text.length > MAX_INPUT) throw totpError('Input exceeds 4,096 characters.');

  if (/^otpauth:/i.test(text)) return parseUri(text, defaults);

  return { ...defaults, period: checkPeriod(defaults.period), secret: decodeSecret(text) };
}

export function buildOtpauthUri(config: TotpConfig): string {
  const { account, issuer } = config;
  const label = (issuer ? [issuer, account ?? ''] : [account ?? ''])
    .map((part) => encodeURIComponent(part))
    .join(':');
  const query = [
    `secret=${encodeBaseN(config.secret, 'base32').replace(/=+$/, '')}`,
    ...(issuer ? [`issuer=${encodeURIComponent(issuer)}`] : []),
    `algorithm=${config.algorithm.replace('-', '')}`,
    `digits=${config.digits}`,
    `period=${config.period}`,
  ];

  return `otpauth://totp/${label}?${query.join('&')}`;
}

export function parseTotpTime(value: string, now: number): number {
  const text = value.trim();

  if (!text) return now;

  const invalid = totpError('Time must be Unix seconds or an ISO 8601 date-time.');

  if (/^\d+$/.test(text)) {
    if (!Number.isSafeInteger(Number(text))) throw invalid;

    return Number(text);
  }

  const seconds = Math.floor(Date.parse(text) / 1000);

  if (!/^\d{4}-\d{2}-\d{2}/.test(text) || !(seconds >= 0)) throw invalid;

  return seconds;
}

async function codeAt(config: TotpConfig, step: number): Promise<string> {
  const counter = new DataView(new ArrayBuffer(8));

  counter.setBigUint64(0, BigInt(step));

  const key = await subtle().importKey(
    'raw',
    Uint8Array.from(config.secret),
    { hash: config.algorithm, name: 'HMAC' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await subtle().sign('HMAC', key, counter));
  const offset = (mac[mac.length - 1] ?? 0) & 15;
  const binary = new DataView(mac.buffer).getUint32(offset) & 0x7fffffff;

  return String(binary % 10 ** config.digits).padStart(config.digits, '0');
}

export async function generateTotp(
  config: TotpConfig,
  time: number,
): Promise<{
  code: string;
  next: string;
  previous?: string;
  secondsRemaining: number;
  step: number;
}> {
  const step = Math.floor(time / config.period);
  const [code, next, previous] = await Promise.all([
    codeAt(config, step),
    codeAt(config, step + 1),
    step > 0 ? codeAt(config, step - 1) : undefined,
  ]);

  return { code, next, previous, secondsRemaining: config.period - (time % config.period), step };
}

/** Checks every step in the window without stopping early; reports the lowest offset. */
export async function validateTotp(
  config: TotpConfig,
  code: string,
  time: number,
  window: number,
): Promise<{ offset?: number; valid: boolean }> {
  const step = Math.floor(time / config.period);
  const offsets = Array.from({ length: window * 2 + 1 }, (_, index) => index - window).filter(
    (offset) => step + offset >= 0,
  );
  const codes = await Promise.all(offsets.map((offset) => codeAt(config, step + offset)));
  const index = codes.findIndex((candidate) => candidate === code.trim());

  return index === -1 ? { valid: false } : { offset: offsets[index], valid: true };
}
