import { FunctionError } from '../errors';
import { sortFindings, type Finding } from './findings';

export type UtmOptions = {
  campaign?: string;
  content?: string;
  id?: string;
  lowercase?: boolean;
  medium?: string;
  source: string;
  term?: string;
  url: string;
};

export type UtmReport = {
  findings: Finding[];
  parameters: Array<{ name: string; value: string }>;
  url: string;
};

const maxUrlChars = 8_192;
const maxValueChars = 500;

const fields = [
  ['source', 'utm_source', 'Source'],
  ['medium', 'utm_medium', 'Medium'],
  ['campaign', 'utm_campaign', 'Campaign'],
  ['term', 'utm_term', 'Term'],
  ['content', 'utm_content', 'Content'],
  ['id', 'utm_id', 'Campaign ID'],
] as const;

function utmError(message: string): FunctionError {
  return new FunctionError('INVALID_UTM', message);
}

function parseUrl(text: string): URL {
  if (text.length > maxUrlChars) {
    throw utmError(`URL exceeds ${maxUrlChars.toLocaleString('en-US')} characters.`);
  }

  try {
    const url = new URL(text.trim());

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url;
    }
  } catch {
    // Falls through to the shared message below.
  }

  throw utmError('URL must be an absolute http(s) URL.');
}

function decodeKey(pair: string): string {
  const key = pair.split('=')[0] ?? '';

  try {
    return decodeURIComponent(key.replace(/\+/g, ' ')).toLowerCase();
  } catch {
    return key.toLowerCase();
  }
}

function decodeValue(pair: string): string {
  const value = pair.slice(pair.indexOf('=') + 1);

  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

export function buildUtmLink(options: UtmOptions): UtmReport {
  const url = parseUrl(options.url);
  const lowercase = options.lowercase ?? true;
  const findings: Finding[] = [];
  const parameters: UtmReport['parameters'] = [];
  const rawPairs = url.search.slice(1).split('&').filter(Boolean);
  const existing = new Map<string, string>();
  const added = new URLSearchParams();

  for (const pair of rawPairs) {
    if (!existing.has(decodeKey(pair))) {
      existing.set(decodeKey(pair), pair.includes('=') ? decodeValue(pair) : '');
    }
  }

  for (const [key, name, label] of fields) {
    const raw = (options[key] ?? '').trim();

    if (raw.length > maxValueChars) {
      throw utmError(`${label} exceeds ${maxValueChars} characters.`);
    }

    if (key === 'source' && !raw) {
      throw utmError('Source is required.');
    }

    if (!raw) {
      const kept = existing.get(name);

      if (kept !== undefined) {
        parameters.push({ name, value: kept });
      } else if (key === 'medium' || key === 'campaign') {
        findings.push({ level: 'low', message: `${name} is recommended.` });
      }

      continue;
    }

    const value = lowercase ? raw.toLowerCase() : raw;

    if (value !== value.toLowerCase()) {
      findings.push({
        level: 'low',
        message: `${name} "${value}" has uppercase letters; UTM values are case-sensitive in analytics.`,
      });
    }

    if (value.includes(' ')) {
      findings.push({ level: 'info', message: `Spaces in ${name} are encoded as "+".` });
    }

    if (existing.has(name)) {
      findings.push({ level: 'info', message: `Replaced the existing ${name}.` });
    }

    added.append(name, value);
    parameters.push({ name, value });
  }

  const kept = rawPairs.filter((pair) => !added.has(decodeKey(pair)));

  url.search = [...kept, added.toString()].filter(Boolean).join('&');

  return { findings: sortFindings(findings), parameters, url: url.href };
}

export function renderUtmReport(report: UtmReport): string {
  const findings = report.findings.length
    ? report.findings.map(({ level, message }) => `[${level.toUpperCase()}] ${message}`)
    : ['No findings.'];

  return [
    report.url,
    '',
    ...report.parameters.map(({ name, value }) => `${name} = ${value}`),
    '',
    '# Findings',
    ...findings,
  ].join('\n');
}
