import { FunctionError } from '../errors';
import type { ExactJsonValue } from './json';
import { JsonNumberToken } from './jsonDocument';

export type FlattenOptions = { arrays: 'index' | 'keep'; notation: 'bracket' | 'dot' };

export type PathSegment = { index: boolean; key: string };

type Leaf = { leaf: ExactJsonValue };
type Branch = { children: Map<string, Branch | Leaf>; indexOnly: boolean };

const MAX_DEPTH = 64;
const MAX_KEYS = 100_000;
const NESTING_MESSAGE = `Nesting is limited to ${MAX_DEPTH} levels.`;
const KEYS_MESSAGE = 'Keys are limited to 100,000.';
const INTEGER = /^(?:0|[1-9]\d*)$/;

function isLeaf(node: ExactJsonValue, arrays: FlattenOptions['arrays']): boolean {
  if (typeof node !== 'object' || node === null || node instanceof JsonNumberToken) return true;
  if (Array.isArray(node)) return node.length === 0 || arrays === 'keep';

  return Object.keys(node).length === 0;
}

function plainKey(segment: PathSegment, position: number): string {
  if (/[.[\]]/.test(segment.key) || segment.key === '')
    throw new FunctionError(
      'INVALID_KEY',
      `Key "${segment.key}" contains a separator; use bracket notation.`,
    );

  return position === 0 ? segment.key : `.${segment.key}`;
}

function formatPath(segments: PathSegment[], notation: FlattenOptions['notation']): string {
  return segments
    .map((segment, position) => {
      if (notation === 'dot') return plainKey(segment, position);
      if (segment.index) return `[${segment.key}]`;
      if (/[.[\]"\\]/.test(segment.key) || segment.key === '')
        return `[${JSON.stringify(segment.key)}]`;

      return position === 0 ? segment.key : `.${segment.key}`;
    })
    .join('');
}

export function flattenJson(
  value: ExactJsonValue,
  options: FlattenOptions,
): Record<string, ExactJsonValue> {
  const entries: [string, ExactJsonValue][] = [];

  const walk = (node: ExactJsonValue, segments: PathSegment[]): void => {
    if (segments.length > MAX_DEPTH) throw new FunctionError('LIMIT', NESTING_MESSAGE);

    if (isLeaf(node, options.arrays)) {
      if (entries.length >= MAX_KEYS) throw new FunctionError('LIMIT', KEYS_MESSAGE);

      entries.push([formatPath(segments, options.notation), node]);

      return;
    }

    if (Array.isArray(node))
      node.forEach((item, index) => walk(item, [...segments, { index: true, key: String(index) }]));
    else
      Object.entries(node as object).forEach(([key, item]) =>
        walk(item as ExactJsonValue, [...segments, { index: false, key }]),
      );
  };

  walk(value, []);

  // fromEntries defines own data properties, so a "__proto__" key stays plain data.
  return Object.fromEntries(entries);
}

function readQuoted(path: string, start: number): { end: number; key: string } | undefined {
  for (let i = start + 1; i < path.length; i += 1) {
    if (path[i] === '\\') i += 1;
    else if (path[i] === '"') {
      try {
        return { end: i + 1, key: JSON.parse(path.slice(start, i + 1)) as string };
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function readBracket(
  path: string,
  start: number,
): { end: number; segment: PathSegment } | undefined {
  const quoted = path[start + 1] === '"' ? readQuoted(path, start + 1) : undefined;

  if (quoted && path[quoted.end] === ']')
    return { end: quoted.end + 1, segment: { index: false, key: quoted.key } };

  const close = path.indexOf(']', start);
  const digits = path.slice(start + 1, close);

  if (close < 0 || !INTEGER.test(digits)) return undefined;

  return { end: close + 1, segment: { index: true, key: digits } };
}

function parseBracketPath(path: string): PathSegment[] | undefined {
  const segments: PathSegment[] = [];
  let i = 0;

  while (i < path.length) {
    if (path[i] === '.' && segments.length > 0 && path[i + 1] !== '[') i += 1;

    const bracket = path[i] === '[' ? readBracket(path, i) : undefined;
    const plain = path[i] === '[' ? undefined : /^[^.[\]]+/.exec(path.slice(i));

    if (bracket) {
      segments.push(bracket.segment);
      i = bracket.end;
    } else if (plain) {
      segments.push({ index: false, key: plain[0] });
      i += plain[0].length;
    } else {
      return undefined;
    }
  }

  return segments;
}

function parseDotPath(path: string): PathSegment[] {
  return path === '' ? [] : path.split('.').map((key) => ({ index: INTEGER.test(key), key }));
}

export function parseFlatPath(path: string, notation: FlattenOptions['notation']): PathSegment[] {
  const keys = path.split('.');
  const segments = notation === 'bracket' ? parseBracketPath(path) : parseDotPath(path);

  if (!segments || (notation === 'dot' && keys.includes('') && path !== ''))
    throw new FunctionError('INVALID_KEY', `Invalid key path "${path}".`);

  if (segments.length > MAX_DEPTH) throw new FunctionError('LIMIT', NESTING_MESSAGE);

  return segments;
}

function insert(root: Branch, segments: PathSegment[], leaf: ExactJsonValue, path: string): void {
  const conflict = new FunctionError('CONFLICT', `Conflicting keys at "${path}".`);
  let branch = root;

  segments.forEach((segment, position) => {
    const existing = branch.children.get(segment.key);

    branch.indexOnly = branch.indexOnly && segment.index;

    if (position === segments.length - 1) {
      if (existing) throw conflict;

      branch.children.set(segment.key, { leaf });

      return;
    }

    if (existing && !('children' in existing)) throw conflict;

    const next = existing ?? { children: new Map<string, Branch | Leaf>(), indexOnly: true };

    branch.children.set(segment.key, next);
    branch = next;
  });
}

function build(node: Branch | Leaf): ExactJsonValue {
  if (!('children' in node)) return node.leaf;

  const keys = [...node.children.keys()];
  const dense =
    node.indexOnly &&
    keys
      .map(Number)
      .sort((a, b) => a - b)
      .every((index, position) => index === position);

  if (dense) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => build(node.children.get(key) as Branch | Leaf));
  }

  return Object.fromEntries([...node.children].map(([key, child]) => [key, build(child)]));
}

export function unflattenJson(
  record: Record<string, ExactJsonValue>,
  options: Pick<FlattenOptions, 'notation'>,
): ExactJsonValue {
  const entries = Object.entries(record);

  if (entries.length > MAX_KEYS) throw new FunctionError('LIMIT', KEYS_MESSAGE);

  const root: Branch = { children: new Map(), indexOnly: true };
  let rootLeaf: ExactJsonValue | undefined;

  for (const [path, leaf] of entries) {
    const segments = parseFlatPath(path, options.notation);

    if (segments.length === 0) rootLeaf = leaf;
    else insert(root, segments, leaf, path);
  }

  if (rootLeaf === undefined) return entries.length === 0 ? {} : build(root);
  if (entries.length > 1) throw new FunctionError('CONFLICT', 'Conflicting keys at "".');

  return rootLeaf;
}
