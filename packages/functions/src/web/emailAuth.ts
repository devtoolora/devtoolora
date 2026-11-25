import { FunctionError } from '../errors';
import { parseDkim } from './dkim';
import { parseDmarc } from './dmarc';
import { summarizeFindings, type Finding } from './findings';
import { parseSpf } from './spf';

export type EmailAuthKind = 'dkim' | 'dmarc' | 'spf';

const maxRecordLength = 4_096;

export function unquoteTxtRecord(value: string): string {
  const quoted = [...value.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) =>
    (match[1] ?? '').replace(/\\(.)/g, '$1'),
  );

  if (quoted.length > 0) return quoted.join('').trim();

  return value.replace(/^(?!v=)[^"]*?\bTXT\s+/i, '').trim();
}

export function detectEmailAuthKind(record: string): EmailAuthKind {
  const start = record.trim().toLowerCase();

  if (/^v=spf1(?:\s|$)/.test(start)) return 'spf';
  if (/^v=dmarc1\b/.test(start)) return 'dmarc';
  if (/^v=dkim1\b/.test(start)) return 'dkim';

  // RFC 6376 makes v= optional for DKIM keys.
  if (/(?:^|;)\s*p=/.test(start) && !/(?:^|;)\s*v=/.test(start)) return 'dkim';

  throw new FunctionError('UNKNOWN_RECORD', 'Record must start with v=spf1, v=DMARC1 or v=DKIM1.');
}

function table(headers: string[], rows: string[][]): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];
}

function findingLines(findings: Finding[]): string[] {
  return findings.length === 0
    ? ['None']
    : findings.map(({ level, message }) => `- ${level}: ${message}`);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function parseEmailAuthRecord(value: string): {
  kind: EmailAuthKind;
  summary: string;
  text: string;
} {
  if (value.trim() === '') throw new FunctionError('EMPTY_RECORD', 'Record input is required.');
  if (value.length > maxRecordLength)
    throw new FunctionError('INPUT_TOO_LARGE', 'Record exceeds 4,096 characters.');

  const record = unquoteTxtRecord(value);
  const kind = detectEmailAuthKind(record);
  let findings: Finding[];
  let section: string[];
  let summary: string;

  if (kind === 'spf') {
    const spf = parseSpf(record);

    findings = spf.findings;

    section = [
      '# Terms',
      ...table(
        ['Qualifier', 'Term', 'Value', 'Lookup', 'Explanation'],
        spf.terms.map((term) => [
          term.qualifier ?? '',
          term.name,
          term.value ?? '',
          term.lookup ? 'yes' : 'no',
          term.explanation,
        ]),
      ),
    ];

    summary = `SPF · ${plural(spf.terms.length, 'term')} · ${spf.lookups} of 10 lookups`;
  } else {
    const parsed = kind === 'dmarc' ? parseDmarc(record) : parseDkim(record);
    const keyBits = 'keyBits' in parsed ? Number(parsed.keyBits ?? 0) : 0;
    const keyType = 'keyType' in parsed ? parsed.keyType : '';

    findings = parsed.findings;

    section = [
      '# Tags',
      ...table(
        ['Tag', 'Value', 'Explanation'],
        parsed.tags.map((tag) => [tag.name, tag.value, tag.explanation]),
      ),
    ];

    if (kind === 'dmarc')
      summary = `DMARC · p=${parsed.tags.find((tag) => tag.name === 'p')?.value ?? 'missing'}`;
    else if (keyBits > 0) summary = `DKIM · ${keyType} ${keyBits.toLocaleString('en-US')}-bit`;
    else summary = 'DKIM · no key';
  }

  const text = [
    '# Record',
    record,
    '',
    ...section,
    '',
    '# Findings',
    ...findingLines(findings),
  ].join('\n');

  return { kind, summary: `${summary} · ${summarizeFindings(findings)}`, text };
}
