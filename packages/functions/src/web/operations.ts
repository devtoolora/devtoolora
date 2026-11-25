import { JsonNumberToken, type ExactJsonValue } from '../format';
import { required, webError } from './webInput';

export { curlToFetch, fetchToCurl } from './curl';

const HTTP_STATUSES: Record<string, string> = {
  '200': 'OK',
  '201': 'Created',
  '204': 'No Content',
  '301': 'Moved Permanently',
  '302': 'Found',
  '304': 'Not Modified',
  '400': 'Bad Request',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'Not Found',
  '409': 'Conflict',
  '422': 'Unprocessable Content',
  '300': 'Multiple Choices',
  '402': 'Payment Required',
  '406': 'Not Acceptable',
  '407': 'Proxy Authentication Required',
  '411': 'Length Required',
  '412': 'Precondition Failed',
  '414': 'URI Too Long',
  '416': 'Range Not Satisfiable',
  '421': 'Misdirected Request',
  '423': 'Locked',
  '426': 'Upgrade Required',
  '428': 'Precondition Required',
  '429': 'Too Many Requests',
  '500': 'Internal Server Error',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '100': 'Continue',
  '101': 'Switching Protocols',
  '103': 'Early Hints',
  '202': 'Accepted',
  '206': 'Partial Content',
  '303': 'See Other',
  '307': 'Temporary Redirect',
  '308': 'Permanent Redirect',
  '405': 'Method Not Allowed',
  '408': 'Request Timeout',
  '410': 'Gone',
  '413': 'Content Too Large',
  '415': 'Unsupported Media Type',
  '418': "(Unused; historically I'm a teapot)",
  '425': 'Too Early',
  '431': 'Request Header Fields Too Large',
  '451': 'Unavailable For Legal Reasons',
  '501': 'Not Implemented',
  '504': 'Gateway Timeout',
  '505': 'HTTP Version Not Supported',
  '511': 'Network Authentication Required',
};

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.zip': 'application/zip',
};

export function inspectUrl(value: string): Record<string, unknown> {
  if (value.length > 65536) throw webError('URL input exceeds 65,536 characters.');

  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    throw webError(
      /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value.trim())
        ? 'This URL has a scheme, but its host or port is invalid.'
        : 'Enter an absolute URL with a scheme; relative paths require a base and are unsupported.',
    );
  }

  return {
    protocol: parsed.protocol,
    username: parsed.username,
    password: parsed.password ? '<redacted>' : '',
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
    params: parsed.search ? parseQueryString(parsed.search) : {},
    hash: parsed.hash,
  };
}

export function lookupHttpStatus(value: string): string[] {
  if (value.length > 32) throw webError('Status lookup input exceeds 32 characters.');

  const query = value.trim();

  if (query) {
    if (!/^[1-5][0-9]{2}$/.test(query))
      throw webError('Enter a three-digit HTTP status code from 100 through 599.');

    return Object.hasOwn(HTTP_STATUSES, query)
      ? [`${query} ${HTTP_STATUSES[query]}`]
      : [`${query}: Not in the bundled status reference.`];
  }

  const classes = ['Informational', 'Success', 'Redirection', 'Client Error', 'Server Error'];

  return classes.flatMap((label, index) => [
    `${index + 1}xx ${label}`,
    ...Object.entries(HTTP_STATUSES)
      .filter(([code]) => code.startsWith(String(index + 1)))
      .map(([code, description]) => `${code} ${description}`),
    '',
  ]);
}

export function lookupMimeType(value: string): string[] {
  if (value.length > 4096) throw webError('MIME lookup input exceeds 4,096 characters.');

  const input = value.trim();

  if (!input) return Object.entries(MIME_TYPES).map(([extension, mime]) => `${extension}: ${mime}`);

  const mime = (input.split(';')[0] ?? '').trim().toLowerCase();
  const matching = Object.entries(MIME_TYPES).filter(([, type]) => type === mime);

  if (matching.length) return matching.map(([extension, type]) => `${extension.slice(1)}: ${type}`);

  let path = input;

  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(input)) {
    try {
      path = new URL(input).pathname;
    } catch {
      throw webError('The URL supplied to MIME lookup is invalid.');
    }
  }

  const fileName = path.split(/[\\/]/).at(-1) ?? '';
  // A bare word is an extension; the last segment of `foo/png` or a URL path is not.
  const extension = path === fileName ? fileName : '';
  const query = normalizeExtension(
    fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : extension,
  );

  return Object.hasOwn(MIME_TYPES, query)
    ? [`${query.slice(1)}: ${MIME_TYPES[query]}`]
    : ['No MIME mapping found in the bundled reference.'];
}

const USER_AGENT_BOTS: Array<[RegExp, string]> = [
  [/Googlebot(?:\/([\d.]+))?/i, 'Googlebot'],
  [/bingbot(?:\/([\d.]+))?/i, 'Bingbot'],
  [/DuckDuckBot(?:\/([\d.]+))?/i, 'DuckDuckBot'],
  [/YandexBot(?:\/([\d.]+))?/i, 'YandexBot'],
  [/Baiduspider(?:\/([\d.]+))?/i, 'Baiduspider'],
  [/facebookexternalhit(?:\/([\d.]+))?/i, 'Facebook link preview'],
  [/Twitterbot(?:\/([\d.]+))?/i, 'Twitterbot'],
  [/Slackbot/i, 'Slackbot'],
  [/^curl\/([\d.]+)?/i, 'curl'],
  [/^Wget\/([\d.]+)?/i, 'Wget'],
  [/python-requests\/([\d.]+)?/i, 'python-requests'],
  [/PostmanRuntime\/([\d.]+)?/i, 'Postman'],
];

const USER_AGENT_BROWSERS: Array<[RegExp, string]> = [
  [/(?:Edg|EdgA|EdgiOS)\/([\d.]+)/, 'Edge'],
  [/(?:OPR|OPT)\/([\d.]+)/, 'Opera'],
  [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
  [/Vivaldi\/([\d.]+)/, 'Vivaldi'],
  [/YaBrowser\/([\d.]+)/, 'Yandex Browser'],
  [/FxiOS\/([\d.]+)/, 'Firefox'],
  [/CriOS\/([\d.]+)/, 'Chrome'],
  [/Firefox\/([\d.]+)/, 'Firefox'],
  [/(?:Chrome|Chromium)\/([\d.]+)/, 'Chrome'],
  [/Version\/([\d.]+).*Safari/, 'Safari'],
  [/(?:MSIE |rv:)([\d.]+).*Trident|Trident.*rv:([\d.]+)/, 'Internet Explorer'],
];

const WINDOWS_VERSIONS: Record<string, string> = {
  '10.0': '10 or 11',
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7',
  '6.0': 'Vista',
  '5.2': 'XP',
  '5.1': 'XP',
};

function userAgentDevice(userAgent: string, isBot: boolean, isTablet: boolean): string {
  if (isBot) return 'bot';
  if (isTablet) return 'tablet';

  return /Mobile|iPhone|iPod/i.test(userAgent) ? 'mobile' : 'desktop';
}

export function parseUserAgent(value: string): Record<string, unknown> {
  if (value.length > 4096) throw webError('User-Agent input exceeds 4,096 characters.');

  const userAgent = required(value, 'User-Agent');
  const bot = USER_AGENT_BOTS.find(([pattern]) => pattern.test(userAgent));
  const os = userAgentOs(userAgent);
  const browser = bot
    ? { name: bot[1], version: bot[0].exec(userAgent)?.[1] ?? '' }
    : userAgentBrowser(userAgent);
  const isTablet =
    /iPad|Tablet/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));
  const device = userAgentDevice(userAgent, Boolean(bot), isTablet);

  return {
    browser,
    engine: bot ? 'Unknown' : userAgentEngine(userAgent, os.name),
    os: os.name,
    osVersion: os.version,
    device,
    raw: userAgent,
  };
}

function userAgentBrowser(userAgent: string): { name: string; version: string } {
  for (const [pattern, name] of USER_AGENT_BROWSERS) {
    const match = userAgent.match(pattern);

    if (match) return { name, version: match[1] ?? match[2] ?? '' };
  }

  return { name: 'Unknown', version: '' };
}

function userAgentOs(userAgent: string): { name: string; version: string } {
  const appleVersion = (pattern: RegExp): string =>
    userAgent.match(pattern)?.[1]?.replace(/_/g, '.') ?? '';

  if (/iPhone|iPod/.test(userAgent))
    return { name: 'iOS', version: appleVersion(/OS (\d+(?:_\d+)*) like Mac OS X/) };
  if (/iPad/.test(userAgent))
    return { name: 'iPadOS', version: appleVersion(/OS (\d+(?:_\d+)*) like Mac OS X/) };
  if (/Android/.test(userAgent))
    return { name: 'Android', version: userAgent.match(/Android (\d+(?:\.\d+)*)/)?.[1] ?? '' };

  if (/Windows/.test(userAgent)) {
    const version = userAgent.match(/Windows NT (\d+\.\d+)/)?.[1] ?? '';

    return { name: 'Windows', version: WINDOWS_VERSIONS[version] ?? version };
  }

  if (/CrOS/.test(userAgent)) return { name: 'ChromeOS', version: '' };
  if (/Mac OS X|Macintosh/.test(userAgent))
    return { name: 'macOS', version: appleVersion(/Mac OS X (\d+(?:[_.]\d+)*)/) };
  if (/Linux/.test(userAgent)) return { name: 'Linux', version: '' };

  return { name: 'Unknown', version: '' };
}

function userAgentEngine(userAgent: string, os: string): string {
  if (os === 'iOS' || os === 'iPadOS') return 'WebKit';
  if (/Trident\//.test(userAgent)) return 'Trident';
  if (/Chrome\/|Chromium\//.test(userAgent)) return 'Blink';
  if (/Gecko\/\d/.test(userAgent) && /Firefox\//.test(userAgent)) return 'Gecko';
  if (/AppleWebKit\//.test(userAgent)) return 'WebKit';

  return 'Unknown';
}

export function normalizeEmail(value: string): Record<string, string | boolean> {
  if (value.length > 1024) throw webError('Email input exceeds 1,024 characters.');

  const email = required(value, 'Email');
  const match = email.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);

  if (!match) throw webError('Email address is invalid.');

  let local = match[1]!;
  const domain = match[2]!.toLowerCase();

  if (
    email.length > 254 ||
    local.length > 64 ||
    !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    domain.length > 253 ||
    domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw webError(
      'Use a common ASCII address with valid dot-separated local and domain labels; quoted/internationalized addresses are unsupported.',
    );

  const provider = domain === 'googlemail.com' ? 'gmail.com' : domain;

  if (provider === 'gmail.com') {
    local = (local.toLowerCase().split('+')[0] ?? '').replace(/\./g, '');
    if (!local) throw webError('Gmail alias has no base username.');
  }

  return {
    original: value.trim(),
    normalized: `${local}@${provider}`,
    domain: provider,
    hasPlusAlias: match[1]!.includes('+'),
  };
}

export function parseQueryString(value: string): Record<string, string | string[]> {
  if (value.length > 1_048_576) throw webError('Query input exceeds 1,048,576 characters.');

  const input = required(value, 'Query string');
  const params = new URLSearchParams(queryTextOf(input));
  const grouped = new Map<string, string[]>();

  for (const [key, item] of params) {
    const values = grouped.get(key) ?? [];

    values.push(item);
    grouped.set(key, values);
  }

  return Object.fromEntries(
    [...grouped].map(([key, values]) => [key, values.length > 1 ? values : (values[0] ?? '')]),
  );
}

function queryTextOf(input: string): string {
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(input))
    return (input.split('#')[0] ?? '').replace(/^[^=&?]*\?/, '');

  try {
    return new URL(input).search.slice(1);
  } catch {
    throw webError('The URL is invalid. Check its host, or paste only the query string.');
  }
}

export function stringifyQueryString(value: ExactJsonValue): string {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value instanceof JsonNumberToken
  )
    throw webError('JSON input must be an object.');

  const params = new URLSearchParams();

  for (const [key, raw] of Object.entries(value)) {
    for (const item of Array.isArray(raw) ? raw : [raw]) {
      if (item === null) continue;
      if (
        (typeof item === 'object' && !(item instanceof JsonNumberToken)) ||
        (typeof item === 'number' && !Number.isFinite(item))
      )
        throw webError(
          'Query values must be finite scalar values or arrays of scalars; nested objects/arrays are unsupported.',
        );

      params.append(key, String(item));
    }
  }

  return params.toString();
}

export type ParsedHttpHeaders = {
  headers: Record<string, string | string[]>;
  rawHeaders: Array<{ name: string; value: string }>;
  startLine?: string;
};

export function parseHttpHeaders(value: string): ParsedHttpHeaders {
  if (value.length > 1_048_576) throw webError('HTTP headers input exceeds 1,048,576 characters.');

  required(value, 'HTTP headers');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value))
    throw webError('HTTP headers contain an invalid control character.');

  const input = value.replace(/^\uFEFF/, '').replace(/(?<![\r\n])[\r\n]+$/, '');
  const lines = input.split(/\r\n?|\n/);
  const [first = ''] = lines;
  const version = 'HTTP/(?:1\\.[01]|2(?:\\.0)?|3(?:\\.0)?)';
  const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
  const requestParts = first.split(' ');
  const isRequestLine =
    requestParts.length === 3 &&
    token.test(requestParts[0]!) &&
    Boolean(requestParts[1]) &&
    !/\s/.test(requestParts[1]!) &&
    new RegExp(`^${version}$`).test(requestParts[2]!);
  const isStartLine =
    new RegExp(`^${version} [1-5][0-9]{2}(?:[ \\t]+[^\\x00-\\x1f\\x7f]*)?$`).test(first) ||
    isRequestLine;
  const startLine = isStartLine ? lines.shift() : undefined;
  const grouped = new Map<string, string[]>();
  const rawHeaders: Array<{ name: string; value: string }> = [];

  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      if (lines.slice(index + 1).some((remaining) => remaining.trim()))
        throw webError(
          'Input contains a body or another message after the header terminator; paste headers only.',
        );

      break;
    }

    // HTTP/2 copies start with pseudo-headers such as `:status: 200`.
    const separator = line.indexOf(':', line.startsWith(':') ? 1 : 0);
    const name = line.slice(0, separator);

    if (separator <= 0 || !token.test(name.replace(/^:/, '')))
      throw webError(`Invalid header name or line at line ${index + (startLine ? 2 : 1)}.`);

    const headerValue = line.slice(separator + 1).trim();

    if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(headerValue))
      throw webError(
        `Invalid control character in header value at line ${index + (startLine ? 2 : 1)}.`,
      );

    const key = name.toLowerCase();

    rawHeaders.push({ name, value: headerValue });
    const values = grouped.get(key) ?? [];

    values.push(headerValue);
    grouped.set(key, values);
  }

  const headers = Object.fromEntries(
    [...grouped].map(([name, values]) => [name, values.length > 1 ? values : values[0]!]),
  );

  return { ...(startLine ? { startLine } : {}), headers, rawHeaders };
}

function normalizeExtension(value: string): string {
  if (!value) return '';

  const extension = value.toLowerCase();

  return extension.startsWith('.') ? extension : `.${extension}`;
}
