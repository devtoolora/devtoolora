import { FunctionError } from '../errors';
import { MAX_BOUND, parseRegex, type RegexNode } from './regexParse';
import {
  describeFlags,
  describeNode,
  openerLength,
  quantifierSuffix,
  show,
} from './regexExplainWords';

type RegexJsonNode = {
  children: RegexJsonNode[];
  end: number;
  explanation: string;
  start: number;
  type: string;
};

export type RegexExplanation = {
  json: { flags: string; nodes: RegexJsonNode[]; warnings: string[] };
  summary: string;
  text: string;
};

type Line = { depth: number; explanation?: string; slice: string };
type Context = {
  captures: number;
  flags: string;
  length: number;
  lines: Line[];
  source: string;
  warnings: string[];
};

const MAX_OUTPUT = 500_000;
const COLUMN_CAP = 32;
const FLAGS_MESSAGE =
  'Flags must be unique JavaScript flags d g i m s u v y; u and v cannot be combined.';
const ENGINE_MESSAGE =
  "This runtime's regex engine rejects the pattern; it may use syntax newer than this runtime.";

export function explainRegex(input: string, flagsField: string): RegexExplanation {
  const literal = splitLiteral(input);
  const source = literal ? literal.source : input;
  const fromLiteral = literal !== null && literal.flags !== '';
  const flags = fromLiteral ? literal.flags : flagsField;

  assertFlags(flags);

  const parsed = parseChecked(source, flags);
  const context: Context = { captures: 0, flags, length: 0, lines: [], source, warnings: [] };
  const nodes = mergeRuns(source, parsed).map((node) => explainNode(context, node, 0));
  const header = `Flags: ${describeFlags(flags)}`;
  const warningLines = context.warnings.map((warning) => `Warning: ${warning}\n`).join('');
  const text = `${layout(context.lines, header)}${warningLines === '' ? '' : `\n${warningLines}`}`;

  if (text.length > MAX_OUTPUT) throw outputLimit();

  const count = countNodes(nodes);
  const warnings = context.warnings;
  const warningText = warnings.length === 0 ? 'no warnings' : plural(warnings.length, 'warning');
  const origin = fromLiteral && flagsField !== '' ? ' · flags from the /…/ literal' : '';

  return {
    json: { flags, nodes, warnings },
    summary: `Explained ${plural(count, 'node')} · ${warningText}${origin}.`,
    text,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function outputLimit(): FunctionError {
  return new FunctionError(
    'REGEX_LIMIT',
    'Regex Explainer output is longer than 500,000 characters.',
  );
}

function splitLiteral(input: string): { flags: string; source: string } | null {
  const last = input.lastIndexOf('/');

  if (!input.startsWith('/') || last < 1) return null;

  const flags = input.slice(last + 1);

  return /^[dgimsuvy]*$/.test(flags) ? { flags, source: input.slice(1, last) } : null;
}

function assertFlags(flags: string): void {
  if (
    !/^[dgimsuvy]*$/.test(flags) ||
    new Set(flags).size !== flags.length ||
    (flags.includes('u') && flags.includes('v'))
  )
    throw new FunctionError('INVALID_REGEX', FLAGS_MESSAGE);
}

function parseChecked(source: string, flags: string): RegexNode[] {
  let nodes: RegexNode[] = [];
  let failure: FunctionError | null = null;

  try {
    nodes = parseRegex(source, flags);
  } catch (error) {
    if (!(error instanceof FunctionError) || error.code === 'REGEX_LIMIT') throw error;

    failure = error;
  }

  let engineAccepts = true;

  try {
    new RegExp(source, flags);
  } catch {
    engineAccepts = false;
  }

  if (!failure) {
    if (!engineAccepts) throw new FunctionError('INVALID_REGEX', ENGINE_MESSAGE);

    return nodes;
  }

  const position = /index (\d+)\.$/.exec(failure.message);

  if (engineAccepts && position)
    throw new FunctionError('INVALID_REGEX', `Unsupported construct at index ${position[1]}.`);

  throw failure;
}

function explainNode(context: Context, node: RegexNode, depth: number): RegexJsonNode {
  const { source } = context;
  const isContainer = node.type === 'group' || node.type === 'class';
  const suffix = quantifierSuffix(source, node);
  const explanation = `${describeNode(context, node)}${suffix}`;
  const json: RegexJsonNode = {
    children: [],
    end: node.end,
    explanation,
    start: node.start,
    type: node.type,
  };

  if (!isContainer) {
    addLine(context, { depth, explanation, slice: show(source.slice(node.start, node.end)) });

    return json;
  }

  const opener = openerLength(source, node);

  addLine(context, {
    depth,
    explanation,
    slice: show(source.slice(node.start, node.start + opener)),
  });

  const members = node.type === 'group' ? mergeRuns(source, node.children) : node.children;

  json.children = members.map((child) => explainNode(context, child, depth + 1));

  const closer = node.type === 'group' ? ')' : ']';
  const quantifierStart =
    node.min === undefined ? node.end : source.lastIndexOf(closer, node.end - 1) + 1;

  addLine(context, { depth, slice: `${closer}${source.slice(quantifierStart, node.end)}` });
  checkNesting(context, node, quantifierStart);

  return json;
}

function mergeRuns(source: string, nodes: RegexNode[]): RegexNode[] {
  const merged: RegexNode[] = [];
  let run: RegexNode[] = [];

  const flush = (): void => {
    const first = run[0];
    const last = run.at(-1);

    if (first && last && run.length > 1)
      merged.push({
        children: [],
        end: last.end,
        start: first.start,
        type: 'literal',
        value: run.map((member) => member.value ?? '').join(''),
      });
    else merged.push(...run);

    run = [];
  };

  for (const node of nodes) {
    if (isPlainCharacter(source, node)) run.push(node);
    else {
      flush();
      merged.push(node);
    }
  }

  flush();

  return merged;
}

function isPlainCharacter(source: string, node: RegexNode): boolean {
  if (node.min !== undefined) return false;
  if (node.type === 'literal') return true;

  return (
    node.type === 'escape' &&
    node.end - node.start === 2 &&
    node.value !== undefined &&
    '^$\\.*+?()[]{}|/'.includes(node.value) &&
    source[node.start + 1] === node.value
  );
}

function addLine(context: Context, line: Line): void {
  context.length += line.depth * 2 + line.slice.length + (line.explanation?.length ?? 0) + 3;

  if (context.length > MAX_OUTPUT) throw outputLimit();

  context.lines.push(line);
}

function checkNesting(context: Context, node: RegexNode, quantifierStart: number): void {
  if (isUnbounded(node) && node.children.some(hasUnbounded))
    context.warnings.push(
      `Nested unbounded quantifier at index ${quantifierStart} may backtrack heavily on input that does not match.`,
    );
}

// V8 runs a bound at its clamp as unbounded, so it warns like `*` does.
function isUnbounded(node: RegexNode): boolean {
  return (node.max ?? 0) >= MAX_BOUND;
}

function hasUnbounded(node: RegexNode): boolean {
  return isUnbounded(node) || node.children.some(hasUnbounded);
}

function countNodes(nodes: RegexJsonNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

function layout(lines: Line[], header: string): string {
  if (lines.length === 0) return `${header}\n(empty)  Matches an empty string at every position\n`;

  const indented = lines.map((line) => `${'  '.repeat(line.depth)}${line.slice}`);
  const column = Math.min(Math.max(...indented.map((entry) => entry.length)), COLUMN_CAP) + 2;
  const rows = lines.map((line, index) => {
    const label = indented[index] ?? '';

    if (line.explanation === undefined) return label;

    return `${label.padEnd(Math.max(column, label.length + 2))}${line.explanation}`;
  });

  return `${header}\n${rows.join('\n')}\n`;
}
