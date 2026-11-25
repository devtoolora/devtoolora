import { FunctionError } from '../errors';
import { sortFindings, type Finding } from './findings';

export type CookieAttributes = {
  domain?: string;
  expired?: boolean;
  expires?: string;
  httpOnly: boolean;
  maxAge?: number;
  partitioned: boolean;
  path?: string;
  priority?: string;
  sameSite?: string;
  secure: boolean;
};

export type ParsedCookie = {
  attributes: CookieAttributes;
  findings: Finding[];
  kind: 'cookie' | 'set-cookie';
  name: string;
  size: number;
  value: string;
};

export type CookieReport = { cookies: ParsedCookie[]; findingCount: number };

export type SetCookieOptions = {
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  maxAge?: string;
  name: string;
  partitioned?: boolean;
  path?: string;
  sameSite?: string;
  secure?: boolean;
  value: string;
};

const maxChars = 65_536;
const maxCookies = 1000;
const maxCookieBytes = 4096;
const tokenPattern = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const prefixPattern = /^(set-cookie|cookie)\s*:\s*/i;
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const knownAttributes = [
  'domain',
  'expires',
  'httponly',
  'max-age',
  'partitioned',
  'path',
  'priority',
  'samesite',
  'secure',
];
const sameSiteValues = ['Lax', 'Strict', 'None'];
const dateDelimiters = /[\x09\x20-\x2f\x3b-\x40\x5b-\x60\x7b-\x7e]+/;

function hasBadValueChars(value: string): boolean {
  const quoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"');

  return /[^\x21-\x7e]|[,;\\"]/.test(quoted ? value.slice(1, -1) : value);
}

function hasControlOrSemicolon(text: string): boolean {
  return [...text].some((char) => char === ';' || char.charCodeAt(0) < 32);
}

function cookieError(message: string): FunctionError {
  return new FunctionError('INVALID_COOKIE', message);
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

type DateTokens = { day?: number; hms?: number[]; month?: number; year?: number };

function readDateToken(token: string, parts: DateTokens): void {
  const hms = /^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\D|$)/.exec(token);
  const day = /^(\d{1,2})(?:\D|$)/.exec(token);
  const month = months.indexOf(token.slice(0, 3).toLowerCase());
  const year = /^(\d{2,4})(?:\D|$)/.exec(token);

  if (!parts.hms && hms) parts.hms = hms.slice(1).map(Number);
  else if (parts.day === undefined && day) parts.day = Number(day[1]);
  else if (parts.month === undefined && month >= 0) parts.month = month;
  else if (parts.year === undefined && year) parts.year = Number(year[1]);
}

// RFC 6265 §5.1.1: anything the algorithm fails on is ignored by browsers, so `0` is not a date.
function parseExpires(text: string): Date | undefined {
  const parts: DateTokens = {};

  for (const token of text.split(dateDelimiters).filter(Boolean)) readDateToken(token, parts);

  const { day = 0, hms, month, year: rawYear = 0 } = parts;

  if (!hms || month === undefined) return undefined;

  const [hour = 0, minute = 0, second = 0] = hms;
  let year = rawYear;

  if (year >= 70 && year <= 99) year += 1900;
  else if (year >= 0 && year <= 69) year += 2000;

  if (day < 1 || day > 31 || year < 1601 || hour > 23 || minute > 59 || second > 59)
    return undefined;

  const date = new Date(Date.UTC(year, month, day, hour, minute, second));

  // Date.UTC rolls 31 Feb into March; the RFC says that date fails.
  return date.getUTCDate() === day ? date : undefined;
}

function splitPair(pair: string): [string, string, boolean] {
  const index = pair.indexOf('=');

  return index < 0
    ? [pair.trim(), '', false]
    : [pair.slice(0, index).trim(), pair.slice(index + 1).trim(), true];
}

function readAttributes(segments: string[], now: Date, problems: Finding[]): CookieAttributes {
  const attributes: CookieAttributes = { httpOnly: false, partitioned: false, secure: false };

  for (const segment of segments) {
    const [rawName, value] = splitPair(segment);
    const name = rawName.toLowerCase();

    if (name === 'secure') attributes.secure = true;
    else if (name === 'httponly') attributes.httpOnly = true;
    else if (name === 'partitioned') attributes.partitioned = true;
    else if (name === 'path') attributes.path = value;
    else if (name === 'priority') attributes.priority = value;
    else if (name === 'samesite') attributes.sameSite = value;
    else if (name === 'domain') {
      if (value.startsWith('.')) {
        problems.push({
          level: 'info',
          message: 'Domain has a leading dot, which browsers ignore.',
        });
      }

      attributes.domain = value.replace(/^\./, '');
    } else if (name === 'max-age') {
      if (/^-?\d+$/.test(value)) attributes.maxAge = Number(value);
      else problems.push({ level: 'medium', message: 'Max-Age is not an integer.' });
    } else if (name === 'expires') {
      const date = parseExpires(value);

      if (date) {
        attributes.expires = date.toISOString();
      } else {
        problems.push({
          level: 'medium',
          message: `Expires "${value}" is not a date, so browsers ignore it.`,
        });
      }
    } else problems.push({ level: 'medium', message: `Unknown attribute "${rawName}".` });
  }

  // Max-Age wins over Expires, so the cookie only counts as expired without it.
  if (attributes.expires !== undefined && attributes.maxAge === undefined) {
    attributes.expired = Date.parse(attributes.expires) < now.getTime();
  }

  return attributes;
}

function prefixFindings(name: string, attributes: CookieAttributes): Finding[] {
  const issues: string[] = [];

  if (!attributes.secure) issues.push('Secure');
  if (name.startsWith('__Host-')) {
    if (attributes.domain !== undefined) issues.push('no Domain');
    if (attributes.path !== '/') issues.push('Path=/');
  }

  const prefix = ['__Host-', '__Secure-'].find((item) => name.startsWith(item));

  return prefix && issues.length > 0
    ? [{ level: 'high', message: `${prefix} cookies require ${issues.join(', ')}.` }]
    : [];
}

export function cookieFindings(cookie: ParsedCookie, _now: Date): Finding[] {
  const { kind, name, value } = cookie;
  const findings: Finding[] = [];

  if (!tokenPattern.test(name)) {
    findings.push({ level: 'medium', message: 'Cookie name is not an RFC 6265 token.' });
  }

  if (hasBadValueChars(value)) {
    findings.push({
      level: 'medium',
      message:
        'Cookie value contains a space, control or non-ASCII character, comma, semicolon, backslash or unquoted quote.',
    });
  }

  if (cookie.size > maxCookieBytes) {
    findings.push({ level: 'medium', message: 'Cookie is over 4,096 bytes; browsers drop it.' });
  }

  if (kind === 'set-cookie') {
    findings.push(...setCookieFindings(cookie));
  }

  return sortFindings(findings);
}

function flagFindings({ attributes, name }: ParsedCookie): Finding[] {
  const isDeletion = attributes.expired === true || (attributes.maxAge ?? 1) <= 0;
  const hasStricterSecureFinding =
    attributes.sameSite?.toLowerCase() === 'none' ||
    attributes.partitioned ||
    name.startsWith('__Host-') ||
    name.startsWith('__Secure-');

  if (isDeletion) return [];

  return [
    ...(attributes.secure || hasStricterSecureFinding
      ? []
      : [
          {
            level: 'medium' as const,
            message: 'No Secure attribute; the cookie is also sent over plain HTTP.',
          },
        ]),
    ...(attributes.httpOnly
      ? []
      : [
          {
            level: 'medium' as const,
            message: 'No HttpOnly attribute; scripts can read the cookie. Add it unless they must.',
          },
        ]),
  ];
}

function setCookieFindings(cookie: ParsedCookie): Finding[] {
  const { attributes, name } = cookie;
  const findings: Finding[] = flagFindings(cookie);
  const sameSite = attributes.sameSite?.toLowerCase();

  if (sameSite === 'none' && !attributes.secure) {
    findings.push({ level: 'high', message: 'SameSite=None requires Secure.' });
  }

  if (attributes.partitioned && !attributes.secure) {
    findings.push({ level: 'high', message: 'Partitioned requires Secure.' });
  }

  if (name.startsWith('__Host-') || name.startsWith('__Secure-')) {
    findings.push(...prefixFindings(name, attributes));
  }

  if (attributes.expired) {
    findings.push({ level: 'info', message: 'Expires is in the past, which deletes the cookie.' });
  }

  if (attributes.maxAge !== undefined && attributes.expires !== undefined) {
    findings.push({ level: 'info', message: 'Both Max-Age and Expires are set; Max-Age wins.' });
  }

  if (attributes.sameSite === undefined) {
    findings.push({ level: 'low', message: 'No SameSite attribute; browsers default to Lax.' });
  } else if (!sameSiteValues.some((item) => item.toLowerCase() === sameSite)) {
    findings.push({
      level: 'medium',
      message: `SameSite "${attributes.sameSite}" is not Lax, Strict or None; browsers fall back to their default.`,
    });
  }

  return findings;
}

function looksLikeSetCookie(segments: string[]): boolean {
  const rest = segments.slice(1).filter(Boolean);

  return (
    rest.length > 0 &&
    rest.every((segment) => knownAttributes.includes(splitPair(segment)[0].toLowerCase()))
  );
}

function parseLine(line: string, lineNumber: number, now: Date): ParsedCookie[] {
  const prefix = prefixPattern.exec(line);
  const body = prefix ? line.slice(prefix[0].length) : line;
  const segments = body.split(';').map((segment) => segment.trim());
  const isRequest = prefix ? prefix[1]?.toLowerCase() === 'cookie' : !looksLikeSetCookie(segments);
  const pairs = isRequest ? segments.filter(Boolean) : segments.slice(0, 1);
  const problems: Finding[] = [];
  const parsedAttributes = isRequest
    ? undefined
    : readAttributes(segments.slice(1).filter(Boolean), now, problems);

  return pairs.map((pair) => {
    const [name, value, hasEquals] = splitPair(pair);

    if (!hasEquals || !name) throw cookieError(`Line ${lineNumber}: expected name=value.`);

    const cookie: ParsedCookie = {
      attributes: parsedAttributes ?? { httpOnly: false, partitioned: false, secure: false },
      findings: [],
      kind: isRequest ? 'cookie' : 'set-cookie',
      name,
      size: bytes(`${name}=${value}`),
      value,
    };

    cookie.findings = sortFindings([...problems, ...cookieFindings(cookie, now)]);

    return cookie;
  });
}

export function parseCookies(value: string, options: { now?: Date } = {}): CookieReport {
  const now = options.now ?? new Date();

  if (!value.trim()) throw cookieError('Cookie input is required.');
  if (value.length > maxChars) throw cookieError('Cookie input exceeds 65,536 characters.');

  const cookies: ParsedCookie[] = [];
  const lines = value.split(/\r?\n/);

  lines.forEach((raw, index) => {
    const line = raw.trim();

    if (!line) return;

    cookies.push(...parseLine(line, index + 1, now));

    if (cookies.length > maxCookies) throw cookieError('Cookie input exceeds 1,000 cookies.');
  });

  return {
    cookies,
    findingCount: cookies.reduce((total, cookie) => total + cookie.findings.length, 0),
  };
}

function formatExpires(text: string): string {
  const date = parseExpires(text) ?? new Date(/^\d{4}-\d{2}-\d{2}/.test(text) ? text : Number.NaN);

  if (Number.isNaN(date.getTime())) throw cookieError('Expires must be a date.');

  return date.toUTCString();
}

export function buildSetCookie(
  options: SetCookieOptions,
  now: Date = new Date(),
): { findings: Finding[]; header: string } {
  const { name, value } = options;
  const maxAge = options.maxAge?.trim();
  const sameSite = options.sameSite?.trim();
  const expires = options.expires?.trim();
  const domain = options.domain?.trim();
  const path = options.path?.trim();

  if (!tokenPattern.test(name)) throw cookieError('Cookie name must be an RFC 6265 token.');
  if (hasBadValueChars(value)) {
    throw cookieError(
      'Cookie value must not contain spaces, control or non-ASCII characters, commas, semicolons, backslashes or unquoted double quotes.',
    );
  }

  if (maxAge && !/^-?\d+$/.test(maxAge)) throw cookieError('Max-Age must be a whole number.');

  const matchedSameSite = sameSiteValues.find(
    (item) => item.toLowerCase() === sameSite?.toLowerCase(),
  );

  if (sameSite && !matchedSameSite) throw cookieError('SameSite must be Lax, Strict or None.');
  if ([domain, path].some((item) => item && hasControlOrSemicolon(item))) {
    throw cookieError('Domain and Path must not contain semicolons or control characters.');
  }

  const parts = [
    `${name}=${value}`,
    domain && `Domain=${domain}`,
    path && `Path=${path}`,
    expires && `Expires=${formatExpires(expires)}`,
    maxAge && `Max-Age=${maxAge}`,
    options.secure && 'Secure',
    options.httpOnly && 'HttpOnly',
    matchedSameSite && `SameSite=${matchedSameSite}`,
    options.partitioned && 'Partitioned',
  ].filter(Boolean);
  const header = `Set-Cookie: ${parts.join('; ')}`;

  return { findings: parseCookies(header, { now }).cookies[0]?.findings ?? [], header };
}
