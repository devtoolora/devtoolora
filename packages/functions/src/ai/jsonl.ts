import { FunctionError } from '../errors';
import { canonicalizeJson } from '../format/canonical';
import type { JsonValue } from '../format/json';
import { JsonSyntaxError, parseLosslessJson } from '../format/jsonDocument';
import {
  checkExample,
  detectFormat,
  exampleMessages,
  exampleTexts,
  isRecord,
  type JsonlFormat,
  type LineFindings,
} from './jsonlRules';
import { aiLimits } from './limits';
import { estimateTokens } from './tokens';

export type { JsonlFormat } from './jsonlRules';

export type JsonlIssue = { line: number; message: string; severity: 'error' | 'warning' };

type Spread = { max: number; median: number; min: number };

export type JsonlReport = {
  format: JsonlFormat;
  issueCount: { errors: number; warnings: number };
  issues: JsonlIssue[];
  stats: {
    duplicates: number;
    invalid: number;
    lines: number;
    messages: Spread;
    roles: Record<string, number>;
    tokens: Spread & { total: number };
    valid: number;
  };
};

type Parsed = { error: string; value?: undefined } | { error?: undefined; value: unknown };

const limits = aiLimits.jsonl;
const numbers = new Intl.NumberFormat('en-US');

const fail = (code: string, message: string): never => {
  throw new FunctionError(code, message);
};

function decode(input: string | Uint8Array): string {
  const size = typeof input === 'string' ? input.length : input.byteLength;

  if (size > limits.fileBytes) fail('LIMIT', 'The dataset must be at most 50 MiB.');
  if (typeof input === 'string') return input;

  try {
    // The BOM is kept so the shared path below can warn about it.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
  } catch {
    return fail('INVALID_UTF8', 'The file is not valid UTF-8.');
  }
}

function splitLines(text: string): string[] {
  const lines = text.split('\n');

  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) fail('REQUIRED', 'The dataset is empty.');
  if (lines.length > limits.lines)
    fail('LIMIT', `The dataset must have at most ${numbers.format(limits.lines)} lines.`);

  return lines.map((line, index) => {
    const bare = line.endsWith('\r') ? line.slice(0, -1) : line;

    if (bare.length > limits.lineChars)
      fail(
        'LIMIT',
        `Line ${index + 1} must be at most ${numbers.format(limits.lineChars)} characters.`,
      );

    return bare;
  });
}

function parseLine(line: string): Parsed {
  if (line.trim() === '') return { error: 'Empty line.' };

  try {
    return { value: JSON.parse(line) };
  } catch {
    try {
      parseLosslessJson(line);
    } catch (error: unknown) {
      // Its reasons are written by the project and never echo the input.
      if (error instanceof JsonSyntaxError)
        return { error: `Not valid JSON at column ${error.offset + 1}: ${error.reason}` };
    }

    return { error: 'Not valid JSON.' };
  }
}

function resolveFormat(lines: string[], format: JsonlFormat | 'auto'): JsonlFormat {
  if (format !== 'auto') return format;

  const unknown = (line: number): never =>
    fail(
      'UNKNOWN_FORMAT',
      `Could not detect the format from line ${numbers.format(line)}; choose one.`,
    );

  for (const [index, line] of lines.entries()) {
    const { error, value } = parseLine(line);

    if (error === undefined) return detectFormat(value) ?? unknown(index + 1);
  }

  return unknown(1);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonical(value: unknown): { error: string } | { text: string } {
  try {
    // JSON.parse output is plain JSON data.
    return { text: canonicalizeJson(value as JsonValue) };
  } catch (error: unknown) {
    // canonicalizeJson only throws FunctionErrors with fixed messages that never echo the input.
    return { error: error instanceof Error ? error.message : 'Not valid JSON.' };
  }
}

const spread = (values: number[]): Spread => {
  if (values.length === 0) return { max: 0, median: 0, min: 0 };

  const sorted = [...values].sort((left, right) => left - right);
  const at = (index: number): number => sorted[index] ?? 0;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? at(middle) : (at(middle - 1) + at(middle)) / 2;

  return { max: at(sorted.length - 1), median, min: at(0) };
};

class Collector {
  readonly counts = { errors: 0, warnings: 0 };
  readonly hashes = new Map<string, number>();
  readonly issues: JsonlIssue[] = [];
  readonly messageCounts: number[] = [];
  readonly roles = new Map<string, number>();
  readonly tokenCounts: number[] = [];
  duplicates = 0;
  invalid = 0;

  add(line: number, severity: JsonlIssue['severity'], message: string): void {
    this.counts[severity === 'error' ? 'errors' : 'warnings'] += 1;

    if (this.issues.length < limits.issues) this.issues.push({ line, message, severity });
  }

  reject(line: number, message: string): void {
    this.invalid += 1;
    this.add(line, 'error', message);
  }

  addAll(line: number, { errors, warnings }: LineFindings): void {
    for (const message of errors) this.add(line, 'error', message);
    for (const message of warnings) this.add(line, 'warning', message);
  }

  countExample(messages: unknown[], texts: string[]): void {
    this.messageCounts.push(messages.length);
    this.tokenCounts.push(texts.reduce((total, text) => total + estimateTokens(text), 0));

    for (const message of messages) {
      const role = isRecord(message) ? String(message.role) : '';

      this.roles.set(role, (this.roles.get(role) ?? 0) + 1);
    }
  }

  async checkDuplicate(line: number, text: string): Promise<void> {
    const hash = await sha256(text);
    const first = this.hashes.get(hash);

    if (first === undefined) {
      this.hashes.set(hash, line);

      return;
    }

    this.duplicates += 1;
    this.add(line, 'warning', `Duplicate of line ${numbers.format(first)}.`);
  }
}

async function checkLine(
  collector: Collector,
  line: string,
  number: number,
  format: JsonlFormat,
): Promise<void> {
  const { error, value } = parseLine(line);

  if (error !== undefined) return collector.reject(number, error);

  const canonicalLine = canonical(value);

  if ('error' in canonicalLine) return collector.reject(number, canonicalLine.error);
  if (!isRecord(value)) return collector.reject(number, 'Each line must be a JSON object.');

  const findings = checkExample(value, format);

  collector.addAll(number, findings);

  if (findings.errors.length > 0) {
    collector.invalid += 1;

    return;
  }

  await collector.checkDuplicate(number, canonicalLine.text);
  collector.countExample(exampleMessages(value, format), exampleTexts(value, format));
}

export async function validateJsonlDataset(
  input: string | Uint8Array,
  format: JsonlFormat | 'auto',
): Promise<JsonlReport> {
  const decoded = decode(input);
  const bom = decoded.startsWith('\uFEFF');
  const lines = splitLines(bom ? decoded.slice(1) : decoded);
  const resolved = resolveFormat(lines, format);
  const collector = new Collector();

  if (bom) collector.add(1, 'warning', 'The byte order mark at the start was skipped.');

  for (const [index, line] of lines.entries())
    await checkLine(collector, line, index + 1, resolved);

  const { counts, duplicates, invalid, issues, messageCounts, roles, tokenCounts } = collector;

  return {
    format: resolved,
    issueCount: counts,
    issues,
    stats: {
      duplicates,
      invalid,
      lines: lines.length,
      messages: spread(messageCounts),
      // Object.fromEntries defines own properties, so a key like __proto__ stays ordinary.
      roles: Object.fromEntries([...roles].sort(([left], [right]) => (left < right ? -1 : 1))),
      tokens: { ...spread(tokenCounts), total: tokenCounts.reduce((sum, count) => sum + count, 0) },
      valid: lines.length - invalid,
    },
  };
}

const formatNames: { [format in JsonlFormat]: string } = {
  'bedrock-claude': 'Amazon Bedrock (Claude)',
  'openai-chat': 'OpenAI chat',
  'openai-preference': 'OpenAI preference',
};
const plural = (count: number, noun: string): string =>
  `${numbers.format(count)} ${noun}${count === 1 ? '' : 's'}`;
const spreadText = ({ max, median, min }: Spread): string =>
  `min ${numbers.format(min)}, median ${numbers.format(median)}, max ${numbers.format(max)}`;

function summarize({ format, issueCount, stats }: JsonlReport): string {
  const issues = [
    ...(issueCount.errors > 0 ? [plural(issueCount.errors, 'error')] : []),
    ...(issueCount.warnings > 0 ? [plural(issueCount.warnings, 'warning')] : []),
  ];

  return [
    formatNames[format],
    plural(stats.lines, 'line'),
    `${numbers.format(stats.valid)} valid`,
    `${numbers.format(stats.invalid)} invalid`,
    issues.length > 0 ? issues.join(' · ') : 'no issues',
  ].join(' · ');
}

export function formatJsonlReport(report: JsonlReport): { report: string; summary: string } {
  const { format, issueCount, issues, stats } = report;
  const total = issueCount.errors + issueCount.warnings;
  const shown = issues.slice(0, limits.displayedIssues);
  const roles = Object.entries(stats.roles).map(
    ([role, count]) => `${role} ${numbers.format(count)}`,
  );
  const rows = [
    ...(total > shown.length
      ? [`Showing ${numbers.format(shown.length)} of ${numbers.format(total)} issues.`, '']
      : []),
    `Format: ${formatNames[format]}`,
    `Lines: ${numbers.format(stats.lines)} (${numbers.format(stats.valid)} valid, ${numbers.format(stats.invalid)} invalid)`,
    `Duplicates: ${numbers.format(stats.duplicates)}`,
    `Messages per example: ${spreadText(stats.messages)}`,
    `Estimated tokens per example: ${spreadText(stats.tokens)} (total ${numbers.format(stats.tokens.total)})`,
    `Roles: ${roles.length > 0 ? roles.join(', ') : 'none'}`,
    '',
    ...(total === 0
      ? ['No issues found.']
      : [
          shown
            .map(
              ({ line, message, severity }) =>
                `Line ${numbers.format(line)} · ${severity}\n${message}`,
            )
            .join('\n\n'),
        ]),
  ];

  return { report: rows.join('\n'), summary: summarize(report) };
}
