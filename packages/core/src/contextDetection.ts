export type DetectedContextKind =
  | 'curl'
  | 'http'
  | 'jwt'
  | 'stackTrace'
  | 'jsonl'
  | 'json'
  | 'xml'
  | 'csv'
  | 'url'
  | 'query'
  | 'yaml';

export type DetectedContext = {
  kind: DetectedContextKind;
  label: string;
  toolIds: string[];
};

const contextDefinitions: Record<DetectedContextKind, Omit<DetectedContext, 'kind'>> = {
  curl: { label: 'cURL command', toolIds: ['curl-to-fetch'] },
  http: { label: 'HTTP request', toolIds: ['raw-http-request-inspector', 'http-headers-parser'] },
  jwt: { label: 'JWT', toolIds: ['jwt-parse'] },
  stackTrace: { label: 'stack trace', toolIds: ['stack-trace-cleaner'] },
  jsonl: {
    label: 'JSON Lines',
    toolIds: ['json-lines-inspector', 'log-filter', 'raw-log-redactor'],
  },
  json: { label: 'JSON', toolIds: ['json-format', 'json-tree', 'json-to-typescript'] },
  xml: { label: 'XML', toolIds: ['xml-format', 'xml-to-json'] },
  csv: { label: 'CSV', toolIds: ['csv-profiler', 'csv-to-json'] },
  url: { label: 'URL', toolIds: ['url-parse', 'query-string-parser'] },
  query: { label: 'query string', toolIds: ['query-string-parser'] },
  yaml: { label: 'YAML', toolIds: ['yaml-to-json'] },
};

export function detectContext(text: string): DetectedContext | undefined {
  const value = text.trim();

  if (!value) {
    return undefined;
  }

  const kind =
    (looksLikeCurl(value) && 'curl') ||
    (looksLikeRawHttpRequest(value) && 'http') ||
    (looksLikeJwt(value) && 'jwt') ||
    (looksLikeStackTrace(value) && 'stackTrace') ||
    (looksLikeJsonLines(value) && 'jsonl') ||
    (looksLikeJson(value) && 'json') ||
    (looksLikeXml(value) && 'xml') ||
    (looksLikeCsv(value) && 'csv') ||
    (looksLikeAbsoluteUrl(value) && 'url') ||
    (looksLikeQueryString(value) && 'query') ||
    (looksLikeYaml(value) && 'yaml');

  if (!kind) {
    return undefined;
  }

  const definition = contextDefinitions[kind];

  return { kind, label: definition.label, toolIds: [...definition.toolIds] };
}

function looksLikeCurl(value: string): boolean {
  return /^curl\s+[^\r\n]*https?:\/\//i.test(value);
}

function looksLikeRawHttpRequest(value: string): boolean {
  return /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(?:https?:\/\/\S+|\/\S*|\*)\s+HTTP\/1\.[01]\r?\n(?:[^\r\n]+:\s*[^\r\n]*\r?\n)+/i.test(
    value,
  );
}

function looksLikeJwt(value: string): boolean {
  const parts = value.split('.');
  const [headerPart] = parts;

  if (
    headerPart === undefined ||
    parts.length !== 3 ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    return false;
  }

  try {
    const header = JSON.parse(decodeBase64Url(headerPart));

    return Boolean(header && typeof header === 'object' && typeof header.alg === 'string');
  } catch {
    return false;
  }
}

function decodeBase64Url(value: string): string {
  const paddedValue = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(paddedValue);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function looksLikeJson(value: string): boolean {
  try {
    JSON.parse(value);

    return true;
  } catch {
    return false;
  }
}

function looksLikeJsonLines(value: string): boolean {
  const lines = value.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (lines.length < 2) {
    return false;
  }

  return lines.every((line) => {
    try {
      const parsed = JSON.parse(line);

      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  });
}

function looksLikeStackTrace(value: string): boolean {
  const javascriptFrame = /^\s*at\s+.+(?:\(|\s)\S+:\d+(?::\d+)?\)?$/m;
  const pythonTraceback =
    /^Traceback \(most recent call last\):\r?\n[\s\S]*^\s*File "[^"]+", line \d+/m;

  return javascriptFrame.test(value) || pythonTraceback.test(value);
}

function looksLikeXml(value: string): boolean {
  return /^<([A-Za-z_][\w:.-]*)(?:\s[^>]*)?>[\s\S]*<\/\1>$/i.test(value);
}

function looksLikeCsv(value: string): boolean {
  const lines = value.split(/\r?\n/).filter((line) => line.trim() !== '');
  const [firstLine] = lines;

  if (firstLine === undefined || lines.length < 2) {
    return false;
  }

  const firstRow = parseCsvRow(firstLine);

  if (!firstRow || firstRow.length < 2) {
    return false;
  }

  return lines.every((line) => parseCsvRow(line)?.length === firstRow.length);
}

function parseCsvRow(row: string): string[] | undefined {
  const values: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (inQuotes && row[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  if (inQuotes) {
    return undefined;
  }

  values.push(value);

  return values;
}

function looksLikeAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeQueryString(value: string): boolean {
  return !/\s/.test(value) && /^(?:[^=&]+=[^&]*)(?:&[^=&]+=[^&]*)*$/.test(value);
}

function looksLikeYaml(value: string): boolean {
  const lines = value.split(/\r?\n/).filter((line) => line.trim() !== '');

  return (
    lines.length >= 2 && lines.every((line) => /^\s*(?:-\s+)?[A-Za-z_][\w.-]*\s*:\s*.*$/.test(line))
  );
}
