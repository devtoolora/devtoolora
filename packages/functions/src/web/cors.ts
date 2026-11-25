import { FunctionError } from '../errors';
import { sortFindings, type Finding } from './findings';
import type { HttpHeader } from './requests';

export type CorsOptions = {
  allowHeaders?: string;
  credentials?: boolean;
  exposeHeaders?: string;
  maxAge?: string;
  methods?: string;
  origins: string;
  privateNetwork?: boolean;
};

export type CorsReport = {
  actual: HttpHeader[];
  findings: Finding[];
  origins: string[];
  preflight: HttpHeader[];
  preflightRequired: boolean;
  text: string;
};

const maxFieldChars = 2048;
const maxOrigins = 100;
const maxAgeLimit = 31_536_000;
const allMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const simpleMethods = ['GET', 'HEAD', 'POST'];
const headerToken = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const safelisted = ['accept', 'accept-language', 'content-language', 'content-type'];

function corsError(message: string): FunctionError {
  return new FunctionError('INVALID_CORS', message);
}

function parseOrigin(raw: string): string {
  const origin = raw.toLowerCase();

  if (origin === '*' || origin === 'null') return origin;
  if (origin.includes('*'))
    throw corsError(
      `Origin "${raw}" has a wildcard. Browsers compare the whole origin, so it never matches; list each origin, or have the server check the pattern and echo the match.`,
    );

  try {
    if (new URL(origin).origin === origin) return origin;
  } catch {
    // falls through to the shared error below
  }

  throw corsError(`Origin "${raw}" must be scheme://host[:port].`);
}

function parseOrigins(value: string): string[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) throw corsError('At least one origin is required.');
  if (lines.length > maxOrigins) throw corsError(`Origins exceed ${maxOrigins} entries.`);

  return [...new Set(lines.map(parseOrigin))];
}

function parseMethods(value: string | undefined): string[] {
  const methods = (value ?? '')
    .split(',')
    .map((method) => method.trim().toUpperCase())
    .filter(Boolean);

  for (const method of methods) {
    if (!allMethods.includes(method)) {
      throw corsError(`Method "${method}" is not one of ${allMethods.join(', ')}.`);
    }
  }

  return methods.length > 0 ? [...new Set(methods)] : ['GET', 'POST'];
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (!headerToken.test(item)) throw corsError(`Header name "${item}" must be an HTTP token.`);

      return item;
    })
    .filter(
      (item, index, all) => all.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index,
    );
}

function assertFieldLength(value: string | undefined, label: string): void {
  if ((value ?? '').length > maxFieldChars) {
    throw corsError(`${label} exceed 2,048 characters.`);
  }
}

function parseMaxAge(value: string | undefined): number | undefined {
  const text = (value ?? '').trim();

  if (text === '') return undefined;

  const age = Number(text);

  if (!/^\d+$/.test(text) || age > maxAgeLimit) {
    throw corsError('Max age must be a whole number from 0 to 31,536,000.');
  }

  return age;
}

function toLines(headers: HttpHeader[]): string {
  return headers.map(({ name, value }) => `${name}: ${value}`).join('\n');
}

type FindingInput = {
  allowHeaders: string[];
  credentials: boolean;
  exposeHeaders: string[];
  maxAge: number | undefined;
  named: string[];
  origins: string[];
};

function corsFindings({
  allowHeaders,
  credentials,
  exposeHeaders,
  maxAge,
  named,
  origins,
}: FindingInput): Finding[] {
  const findings: Finding[] = [];

  if (credentials && origins.includes('*')) {
    findings.push({
      level: 'high',
      message: `* origin cannot be combined with credentials; it was replaced by ${named[0]}.`,
    });
  }

  if (origins.includes('null')) {
    findings.push({
      level: 'high',
      message:
        'The null origin is sent by sandboxed iframes and local files, so any page can claim it.',
    });
  }

  if (credentials && allowHeaders.includes('*')) {
    findings.push({
      level: 'medium',
      message:
        '* in allowed headers does not cover Authorization with credentials; list it explicitly.',
    });
  }

  if (!credentials && allowHeaders.includes('*')) {
    findings.push({
      level: 'info',
      message: '* in allowed headers never covers Authorization; list it explicitly if needed.',
    });
  }

  if (credentials && exposeHeaders.includes('*')) {
    findings.push({
      level: 'medium',
      message: '* in exposed headers is treated as a literal name when credentials are allowed.',
    });
  }

  if (maxAge !== undefined && maxAge > 7200) {
    findings.push({
      level: 'info',
      message: `Max age ${maxAge} is capped by browsers: Chromium at 7,200 s, Firefox at 86,400 s.`,
    });
  }

  return findings;
}

type TextInput = {
  actual: HttpHeader[];
  credentials: boolean;
  origins: string[];
  preflight: HttpHeader[];
  preflightRequired: boolean;
  wildcard: boolean;
};

function renderCorsText({
  actual,
  credentials,
  origins,
  preflight,
  preflightRequired,
  wildcard,
}: TextInput): string {
  const decides = [
    preflightRequired
      ? 'A preflight (OPTIONS) request is needed: a method beyond GET, HEAD, POST or a header beyond Accept, Accept-Language, Content-Language and Content-Type is allowed.'
      : 'No preflight for simple requests: only GET, HEAD, POST and safelisted headers are allowed.',
    'Content-Type only avoids a preflight for form, multipart and text/plain bodies.',
    '* allows any origin, but browsers reject it together with credentials.',
    ...(!wildcard && (origins.length > 1 || credentials)
      ? [
          `The server must echo exactly one allowed origin per request (first listed shown). Allowed set: ${origins.join(', ')}.`,
        ]
      : []),
  ];

  return [
    '## Preflight response (OPTIONS)',
    toLines(preflight),
    '',
    '## Actual response',
    toLines(actual),
    '',
    '## How the browser decides',
    ...decides.map((line) => `- ${line}`),
  ].join('\n');
}

function assertFieldLengths(options: CorsOptions): void {
  assertFieldLength(options.origins, 'Allowed origins');
  assertFieldLength(options.methods, 'Methods');
  assertFieldLength(options.allowHeaders, 'Allowed request headers');
  assertFieldLength(options.exposeHeaders, 'Exposed response headers');
}

export function buildCorsHeaders(options: CorsOptions): CorsReport {
  assertFieldLengths(options);

  const origins = parseOrigins(options.origins);
  const methods = parseMethods(options.methods);
  const allowHeaders = parseList(options.allowHeaders);
  const exposeHeaders = parseList(options.exposeHeaders);
  const maxAge = parseMaxAge(options.maxAge);
  const credentials = options.credentials === true;
  const named = origins.filter((origin) => origin !== '*');

  if (credentials && named.length === 0) throw corsError('* cannot be combined with credentials.');

  const findings = corsFindings({
    allowHeaders,
    credentials,
    exposeHeaders,
    maxAge,
    named,
    origins,
  });

  const wildcard = !credentials && origins.includes('*');
  const origin = wildcard ? '*' : (named[0] ?? '*');
  const vary: HttpHeader[] = wildcard ? [] : [{ name: 'Vary', value: 'Origin' }];
  const allow: HttpHeader[] = [{ name: 'Access-Control-Allow-Origin', value: origin }];
  const creds: HttpHeader[] = credentials
    ? [{ name: 'Access-Control-Allow-Credentials', value: 'true' }]
    : [];
  const preflight: HttpHeader[] = [
    ...allow,
    { name: 'Access-Control-Allow-Methods', value: methods.join(', ') },
    ...(allowHeaders.length > 0
      ? [{ name: 'Access-Control-Allow-Headers', value: allowHeaders.join(', ') }]
      : []),
    ...creds,
    ...(maxAge === undefined ? [] : [{ name: 'Access-Control-Max-Age', value: String(maxAge) }]),
    ...(options.privateNetwork === true
      ? [{ name: 'Access-Control-Allow-Private-Network', value: 'true' }]
      : []),
    ...vary,
  ];
  const actual: HttpHeader[] = [
    ...allow,
    ...creds,
    ...(exposeHeaders.length > 0
      ? [{ name: 'Access-Control-Expose-Headers', value: exposeHeaders.join(', ') }]
      : []),
    ...vary,
  ];
  const preflightRequired =
    methods.some((method) => !simpleMethods.includes(method)) ||
    allowHeaders.some((header) => !safelisted.includes(header.toLowerCase()));
  const text = renderCorsText({
    actual,
    credentials,
    origins,
    preflight,
    preflightRequired,
    wildcard,
  });

  return { actual, findings: sortFindings(findings), origins, preflight, preflightRequired, text };
}
