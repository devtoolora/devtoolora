import { base64Encode, bytesToUtf8, utf8Bytes } from '../binary';
import { FunctionError } from '../errors';
import { parseExactJson } from '../format/json';
import { JsonNumberToken, JsonSyntaxError, type JsonDuplicateKeys } from '../format/jsonDocument';
import { duplicateKeysWarning } from '../format/jsonDocumentHelpers';
import { relativeTime } from '../web/time';
import type { JwtTimeOptions, JwtTiming } from './jwt';
import { decodeBase64Url } from './jwtKeys';

export type ParsedToken = {
  encrypted: boolean;
  header: Record<string, unknown>;
  payload: unknown;
  segments: string[];
  signature: Uint8Array;
  warnings: string[];
};

const timeClaims = ['iat', 'nbf', 'exp', 'auth_time'] as const;
const maxTokenCharacters = 1_048_576;

export function parseToken(token: string): ParsedToken {
  if (token.length > maxTokenCharacters) throw jwtError('JWT input must be no larger than 1 MiB.');

  const input = token
    .trim()
    .replace(/^authorization:\s*/i, '')
    .replace(/^bearer\s+/i, '')
    .replace(/^(["'])(.*)\1$/s, '$2')
    .replace(/\s+/g, '');

  if (!input)
    throw jwtError('Paste a JWT: three Base64URL segments separated by dots, such as eyJhbGciOi….');

  const segments = input.split('.');

  if (segments.length !== 2 && segments.length !== 3 && segments.length !== 5) {
    throw jwtError(
      `A JWT has three dot-separated segments (five for an encrypted JWE); this input has ${segments.length}.`,
    );
  }

  const warnings: string[] = [];

  if (segments.some((segment) => segment.includes('=')))
    warnings.push('Segments contain = padding; JWTs normally use unpadded Base64URL.');
  if (segments.some((segment) => /[+/]/.test(segment)))
    warnings.push(
      'Segments use standard Base64 characters (+ or /); JWTs use Base64URL (- and _).',
    );

  const clean = segments.map((segment) => segment.replace(/(?<!=)=+$/, ''));
  const [headerSegment = '', payloadSegment = ''] = clean;
  const header = parseJsonSegment(headerSegment, 'Header', warnings);

  if (!isJsonObject(header)) throw jwtError('The header must be a JSON object.');
  if (segments.length === 5)
    return {
      encrypted: true,
      header,
      payload: null,
      segments: clean,
      signature: new Uint8Array(),
      warnings,
    };
  if (segments.length === 2)
    warnings.push(
      'The signature segment is missing; a JWT ends with a third segment, even an empty one.',
    );

  const payload = parseJsonSegment(payloadSegment, 'Payload', warnings, true);

  if (typeof payload === 'string')
    warnings.push('The payload is not JSON, so this is a JWS rather than a JWT.');
  else if (!isJsonObject(payload)) warnings.push('JWT claims should be a JSON object.');

  return {
    encrypted: false,
    header,
    payload,
    segments: clean,
    signature: decodeBase64Url(clean[2] ?? '', 'Signature'),
    warnings,
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof JsonNumberToken)
  );
}

function labelledDuplicateWarning(
  label: string,
  duplicates: JsonDuplicateKeys | undefined,
): string[] {
  const warning = duplicateKeysWarning(duplicates);

  return warning ? [`${label}: ${warning}`] : [];
}

function parseJsonSegment(
  segment: string,
  label: string,
  warnings: string[],
  allowText = false,
): unknown {
  if (!segment) throw jwtError(`The ${label.toLowerCase()} segment is empty.`);

  const text = bytesToUtf8(decodeBase64Url(segment, `${label} segment`));

  try {
    const { duplicates, value } = parseExactJson(text, { keepOutOfRange: true });

    warnings.push(...labelledDuplicateWarning(label, duplicates));

    return value;
  } catch {
    if (allowText) return text;

    throw jwtError(`${label} segment is not JSON. Check that the whole token was pasted.`);
  }
}

export function headerWarnings(header: Record<string, unknown>): string[] {
  const warnings: string[] = [];

  if (isUnsignedAlgorithm(header.alg))
    warnings.push('alg is "none": the token is unsigned, so anyone can change its claims.');
  else if (header.alg === undefined) warnings.push('The header has no alg.');
  if (Array.isArray(header.crit) && header.crit.length > 0)
    warnings.push(
      `crit lists header extensions this tool does not process: ${header.crit.join(', ')}. Verifiers must reject tokens with unknown critical extensions.`,
    );

  return warnings;
}

// Decode warns on any casing; verification accepts none of them.
function isUnsignedAlgorithm(alg: unknown): boolean {
  return typeof alg === 'string' && alg.toLowerCase() === 'none';
}

export function signatureStatus(parsed: ParsedToken): string {
  if (isUnsignedAlgorithm(parsed.header.alg)) return 'none (unsigned token)';
  if (parsed.segments.length === 2 || parsed.signature.length === 0) return 'missing';

  return `not verified (${parsed.signature.length} bytes); choose Verify and enter the key`;
}

export function describeTimes(
  payload: unknown,
  options: JwtTimeOptions,
): {
  hasMalformedTime: boolean;
  times: Record<string, string>;
  timing?: JwtTiming;
  warnings: string[];
} {
  const times: Record<string, string> = {};
  const warnings: string[] = [];
  let hasMalformedTime = false;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return { hasMalformedTime, times, warnings };

  const claims = payload as Record<string, unknown>;
  const now = options.nowSeconds ?? Date.now() / 1000;
  const tolerance = options.clockToleranceSeconds ?? 0;
  const values: Partial<Record<(typeof timeClaims)[number], number>> = {};

  for (const claim of timeClaims) {
    const claimValue = claims[claim];
    const value = claimValue instanceof JsonNumberToken ? Number(claimValue.text) : claimValue;

    if (value === undefined) continue;

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      warnings.push(`${claim} is not a NumericDate (a number of seconds since 1970-01-01).`);
      hasMalformedTime ||= claim === 'exp' || claim === 'nbf';

      continue;
    }

    if (Math.abs(value) > 8_640_000_000_000) {
      warnings.push(`${claim} is outside the representable date range.`);
      hasMalformedTime ||= claim === 'exp' || claim === 'nbf';

      continue;
    }

    if (Math.abs(value) >= 100_000_000_000)
      warnings.push(`${claim} looks like milliseconds; NumericDate values are seconds.`);

    values[claim] = value;
    times[claim] = `${isoSeconds(value)} (${relativeTime(value - now)})`;
  }

  if (values.iat !== undefined && values.iat > now + tolerance)
    warnings.push(
      `iat is ${relativeTime(values.iat - now)}, in the future; the issuer's clock may be wrong.`,
    );
  if (claims.exp === undefined) warnings.push('No exp claim: this token never expires.');

  let timing: JwtTiming | undefined;

  if (values.exp !== undefined && now - tolerance >= values.exp) timing = 'expired';
  else if (values.nbf !== undefined && values.nbf > now + tolerance) timing = 'not yet valid';
  else if (values.exp !== undefined || values.nbf !== undefined) timing = 'valid';

  return { hasMalformedTime, timing, times, warnings };
}

export type ParsedClaims = { value: Record<string, unknown>; warnings: string[] };

function parseClaims(input: string, label: string, invalid: string, shape: string): ParsedClaims {
  let parsed: ReturnType<typeof parseExactJson>;

  try {
    parsed = parseExactJson(input);
  } catch (error) {
    if (error instanceof FunctionError && !(error instanceof JsonSyntaxError)) throw error;

    throw jwtError(`${invalid}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!isJsonObject(parsed.value)) throw jwtError(shape);

  return {
    value: { ...parsed.value },
    warnings: labelledDuplicateWarning(label, parsed.duplicates),
  };
}

export function parsePayload(text: string): ParsedClaims {
  const input = text.trim();

  if (!input) throw jwtError('Enter the payload JSON to sign, such as {"sub":"user_123"}.');
  if (/^[\w-]+\.[\w-]+\.[\w-]*$/.test(input))
    throw jwtError(
      'Sign takes payload JSON, and this looks like a JWT. Choose Decode or Verify, or paste the claims as JSON.',
    );

  return parseClaims(
    input,
    'Payload',
    'Payload is not valid JSON',
    'JWT claims must be a JSON object.',
  );
}

export function parseHeaderJson(text: string): ParsedClaims {
  if (!text.trim()) return { value: {}, warnings: [] };

  return parseClaims(
    text,
    'Header',
    'Header JSON is invalid',
    'Header JSON must be an object, such as {"kid":"key-1"}.',
  );
}

export function withoutAlgorithm(header: Record<string, unknown>): Record<string, unknown> {
  const { alg: _alg, ...rest } = header;

  return rest;
}

function isoSeconds(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
}

export function base64UrlText(value: string): string {
  return base64UrlBytes(utf8Bytes(value));
}

export function base64UrlBytes(bytes: Uint8Array): string {
  return base64Encode(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/(?<!=)=+$/, '');
}

export function jwtError(message: string): FunctionError {
  return new FunctionError('INVALID_JWT', message);
}
