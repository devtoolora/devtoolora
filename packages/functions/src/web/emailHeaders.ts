import { FunctionError } from '../errors';
import { decodeMimeHeader } from '../encoding/quotedPrintable';
import { parseRfc5322Date } from './emailDate';
import { collectEmailFindings, type EmailHeaderField } from './emailFindings';
import { sortFindings, type Finding } from './findings';

export type EmailHop = {
  by?: string;
  delaySeconds?: number;
  for?: string;
  from?: string;
  id?: string;
  timestamp?: string;
  with?: string;
};

export type EmailAuthentication = {
  details: string[];
  dkim?: string;
  dmarc?: string;
  spf?: string;
};

export type EmailHeaderReport = {
  authentication: EmailAuthentication;
  date?: string;
  dkimSignatures: Array<{ algorithm?: string; domain?: string; selector?: string }>;
  findings: Finding[];
  from?: string;
  headerCount: number;
  messageId?: string;
  received: EmailHop[];
  replyTo?: string;
  returnPath?: string;
  subject?: string;
  to?: string;
  totalTransitSeconds?: number;
};

const maxChars = 1_048_576;
const maxHops = 500;
const keywords = ['from', 'by', 'via', 'with', 'id', 'for'];

function unfold(value: string): EmailHeaderField[] {
  const lines = (value.charCodeAt(0) === 0xfeff ? value.slice(1) : value)
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const fields: EmailHeaderField[] = [];
  const parts: string[][] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    if (line.trim() === '' && !/^[ \t]/.test(line)) break;
    if (index === 0 && line.startsWith('From ')) continue;

    if (/^[ \t]/.test(line) && parts.length > 0) {
      parts[parts.length - 1]?.push(line.trim());

      continue;
    }

    const match = /^([^\s:]+):\s*(.*)$/.exec(line);

    if (!match) {
      throw new FunctionError(
        'INVALID_WEB_INPUT',
        `Line ${index + 1} is not a "Name: value" header.`,
      );
    }

    fields.push({ name: match[1] ?? '', value: '' });
    parts.push([(match[2] ?? '').trim()]);
  }

  fields.forEach((field, index) => {
    field.value = (parts[index] ?? []).join(' ').trim();
  });

  return fields;
}

function lastTopLevelSemicolon(value: string): number {
  let depth = 0;
  let found = -1;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === '(') depth += 1;
    else if (char === ')' && depth > 0) depth -= 1;
    else if (char === ';' && depth === 0) found = index;
  }

  return found;
}

function parseReceived(value: string): { hop: EmailHop; time?: number } {
  const semicolon = lastTopLevelSemicolon(value);
  const clauses = semicolon < 0 ? value : value.slice(0, semicolon);
  const dateText = semicolon < 0 ? '' : value.slice(semicolon + 1).trim();
  const found: Record<string, string[]> = {};
  let key: string | undefined;
  let depth = 0;

  for (const token of clauses.split(/\s+/).filter(Boolean)) {
    const word = token.toLowerCase();

    if (depth === 0 && keywords.includes(word) && found[word] === undefined) {
      key = word;
      found[word] = [];
    } else if (key !== undefined) {
      found[key]?.push(token);
    }

    depth += (token.match(/\(/g) ?? []).length - (token.match(/\)/g) ?? []).length;
  }

  const read = (name: string) => (found[name]?.length ? found[name].join(' ') : undefined);
  const time = dateText === '' ? undefined : parseRfc5322Date(dateText);
  const hop: EmailHop = {
    by: read('by'),
    for: read('for'),
    from: read('from'),
    id: read('id'),
    with: read('with'),
  };

  if (time !== undefined) hop.timestamp = new Date(time).toISOString();

  return { hop, time };
}

function parseAuthentication(fields: EmailHeaderField[]): EmailAuthentication {
  const header = fields.find((field) => field.name.toLowerCase() === 'authentication-results');
  const authentication: EmailAuthentication = { details: [] };

  for (const clause of (header?.value ?? '').split(';').slice(1)) {
    const text = clause.trim();
    const match = /^(spf|dkim|dmarc)=([a-z]+)/i.exec(text);

    if (!/^[\w-]+=/.test(text)) continue;

    authentication.details.push(text);

    const method = match?.[1]?.toLowerCase() as 'dkim' | 'dmarc' | 'spf' | undefined;

    const result = (match?.[2] ?? '').toLowerCase();

    if (
      method &&
      (authentication[method] === undefined || (method === 'dkim' && result === 'pass'))
    ) {
      authentication[method] = result;
    }
  }

  const received = fields.find((field) => field.name.toLowerCase() === 'received-spf');
  const word = /^([a-z]+)/i.exec(received?.value ?? '')?.[1]?.toLowerCase();

  if (authentication.spf === undefined && word) authentication.spf = word;

  return authentication;
}

function parseDkim(fields: EmailHeaderField[]): EmailHeaderReport['dkimSignatures'] {
  return fields
    .filter((field) => field.name.toLowerCase() === 'dkim-signature')
    .map((field) => {
      const tags = new Map(
        field.value.split(';').map((part) => {
          const [name = '', ...rest] = part.split('=');

          return [name.trim(), rest.join('=').trim()] as const;
        }),
      );

      return { algorithm: tags.get('a'), domain: tags.get('d'), selector: tags.get('s') };
    });
}

function addDelays(parsed: Array<{ hop: EmailHop; time?: number }>): void {
  parsed.forEach((entry, index) => {
    const before = parsed[index - 1]?.time;

    if (before !== undefined && entry.time !== undefined) {
      entry.hop.delaySeconds = (entry.time - before) / 1000;
    }
  });
}

function displayed(value: string | undefined): string | undefined {
  try {
    return value === undefined ? undefined : decodeMimeHeader(value);
  } catch {
    return value;
  }
}

export function analyzeEmailHeaders(value: string): EmailHeaderReport {
  if (value.length > maxChars) {
    throw new FunctionError(
      'INVALID_WEB_INPUT',
      'Email headers input exceeds 1,048,576 characters.',
    );
  }

  if (value.trim() === '')
    throw new FunctionError('INVALID_WEB_INPUT', 'Email headers input is required.');

  const fields = unfold(value);
  const receivedValues = fields.filter((field) => field.name.toLowerCase() === 'received');

  if (receivedValues.length > maxHops) {
    throw new FunctionError('INVALID_WEB_INPUT', 'Email headers input exceeds 500 Received hops.');
  }

  const parsed = receivedValues.reverse().map((field) => parseReceived(field.value));

  addDelays(parsed);

  const first = parsed[0]?.time;
  const last = parsed[parsed.length - 1]?.time;
  const get = (name: string) => fields.find((field) => field.name.toLowerCase() === name)?.value;
  const dateText = get('date');
  const date = dateText === undefined ? undefined : parseRfc5322Date(dateText);
  const authentication = parseAuthentication(fields);

  return {
    authentication,
    date: date === undefined ? undefined : new Date(date).toISOString(),
    dkimSignatures: parseDkim(fields),
    findings: sortFindings(
      collectEmailFindings({
        auth: authentication,
        authPresent: get('authentication-results') !== undefined,
        date,
        dateText,
        fields,
        firstHop: first,
        from: get('from'),
        hops: parsed.map(({ hop, time }) => ({
          by: hop.by,
          delaySeconds: hop.delaySeconds,
          timestamp: time,
        })),
        replyTo: get('reply-to'),
        returnPath: get('return-path'),
      }),
    ),
    from: displayed(get('from')),
    headerCount: fields.length,
    messageId: get('message-id'),
    received: parsed.map(({ hop }) => hop),
    replyTo: displayed(get('reply-to')),
    returnPath: get('return-path'),
    subject: displayed(get('subject')),
    to: displayed(get('to')),
    totalTransitSeconds:
      first !== undefined && last !== undefined && parsed.length > 1
        ? (last - first) / 1000
        : undefined,
  };
}
