import MarkdownIt, { type Token } from 'markdown-it';
import { assertMarkdownInput, assertTokenBudget } from './markdown';
import {
  markdownLintChecks,
  markdownLintDescriptions,
  markdownLintRules,
  type MarkdownLintRule,
} from './markdownLintRules';
import { frontMatterEnd } from './markdownToc';

export { markdownLintRules };
export type { MarkdownLintRule };

export type MarkdownLintIssue = {
  column: number;
  detail: string;
  line: number;
  rule: MarkdownLintRule;
};

export type MarkdownLintResult = {
  issues: MarkdownLintIssue[];
  lines: number;
  rules: MarkdownLintRule[];
  total: number;
};

const toolName = 'Markdown Linter';
const listLimit = 1_000;

function splitLines(text: string): string[] {
  const lines = text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));

  if (lines[lines.length - 1] === '') lines.pop();

  return lines;
}

function markSkipped(tokens: Token[], skipped: boolean[]): void {
  for (const token of tokens) {
    if ((token.type !== 'fence' && token.type !== 'code_block') || token.map === null) continue;

    for (let row = token.map[0]; row < token.map[1]; row += 1) skipped[row] = true;
  }
}

export function lintMarkdown(
  input: string,
  rules: readonly MarkdownLintRule[],
): MarkdownLintResult {
  assertMarkdownInput(input, toolName);

  const text = input.replace(/^\uFEFF/, '');
  const lines = splitLines(text);
  const frontEnd = frontMatterEnd(lines);
  const skipped = lines.map((_, row) => row <= frontEnd);
  const body = lines.map((line, row) => (row <= frontEnd ? '' : line));
  const parserOptions = { html: true, maxNesting: 64 };
  const tokens = new MarkdownIt('commonmark', parserOptions).parse(body.join('\n'), {});

  assertTokenBudget(tokens, toolName);
  markSkipped(tokens, skipped);

  const context = { lines: body, skipped, text, tokens };
  const issues = rules.flatMap((rule) =>
    markdownLintChecks[rule](context).map((finding) => ({ ...finding, rule })),
  );
  const order = (rule: MarkdownLintRule): number => markdownLintRules.indexOf(rule);

  issues.sort((a, b) => a.line - b.line || a.column - b.column || order(a.rule) - order(b.rule));

  return { issues, lines: lines.length, rules: [...rules], total: issues.length };
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export function formatMarkdownLint(result: MarkdownLintResult): {
  json: { issues: MarkdownLintIssue[]; rules: MarkdownLintRule[]; total: number };
  report: string;
  summary: string;
} {
  const listed = result.issues.slice(0, listLimit);
  const rows = listed.map(
    ({ column, detail, line, rule }) =>
      `${line}:${column} ${rule} ${markdownLintDescriptions[rule]}${detail === '' ? '' : ` ${detail}`}`,
  );
  const json = { issues: listed, rules: result.rules, total: result.total };

  if (result.total === 0)
    return {
      json,
      report: 'No issues found.',
      summary: `No issues from ${plural(result.rules.length, 'rule')}.`,
    };

  if (result.total > listLimit)
    rows.push(`Showing 1,000 of ${result.total.toLocaleString('en-US')} issues.`);

  const distinct = new Set(result.issues.map((issue) => issue.rule)).size;

  return {
    json,
    report: rows.join('\n'),
    summary: `${plural(result.total, 'issue')} from ${plural(distinct, 'rule')} in ${plural(result.lines, 'line')}.`,
  };
}
