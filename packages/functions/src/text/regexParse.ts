import { FunctionError } from '../errors';
import {
  checkDepth,
  createNode,
  fail,
  isAnyOf,
  isDigit,
  isUnicode,
  parseClass,
  readCharacterEscape,
  readClassEscape,
  readSourceCharacter,
  readUnicodeEscapeAt,
  type RegexNode,
  type RegexParseState,
} from './regexClass';

export type { RegexNode, RegexNodeType } from './regexClass';

type Quantifier = { lazy?: boolean; max: number; min: number };
type GroupOpening = { name?: string; value: string };

const MAX_SOURCE_LENGTH = 10_000;

export const MAX_BOUND = 2 ** 31 - 1;
const SIMPLE_QUANTIFIERS: Record<string, Quantifier> = {
  '*': { max: Infinity, min: 0 },
  '+': { max: Infinity, min: 1 },
  '?': { max: 1, min: 0 },
};
const SIMPLE_GROUPS: Record<string, string> = {
  '!': 'negativeLookahead',
  ':': 'nonCapture',
  '=': 'lookahead',
};
const IDENTIFIER_NAME = new RegExp('^[\\p{ID_Start}$_][\\p{ID_Continue}$\\u200C\\u200D]*$', 'u');

export function parseRegex(source: string, flags: string): RegexNode[] {
  if (source.length > MAX_SOURCE_LENGTH)
    throw new FunctionError(
      'REGEX_LIMIT',
      'Regex Explainer supports patterns of at most 10,000 UTF-16 units.',
    );

  const groups = scanGroups(source, flags.includes('v'));
  const state: RegexParseState = {
    active: new Set(),
    declared: [],
    flags,
    groupNames: new Set(),
    index: 0,
    namedGroups: groups.named || flags.includes('u') || flags.includes('v'),
    nodes: 0,
    references: [],
    source,
    totalCaptures: groups.captures,
  };
  const nodes = parseDisjunction(state, 0);

  if (state.index < source.length) fail('Unmatched ")"', state.index);

  for (const reference of state.references)
    if (!state.groupNames.has(reference.name))
      fail(`Unknown group name "${reference.name}"`, reference.index);

  return nodes;
}

/** Counts capture groups and finds named ones before parsing: `\N` and `\k` depend on both. */
function scanGroups(source: string, unicodeSets: boolean): { captures: number; named: boolean } {
  let captures = 0;
  let named = false;
  let classDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '\\') {
      index += 1;
    } else if (classDepth > 0) {
      if (character === ']') classDepth -= 1;
      if (character === '[' && unicodeSets) classDepth += 1;
    } else if (character === '[') {
      classDepth = 1;
    } else if (character === '(' && source[index + 1] !== '?') {
      captures += 1;
    } else if (
      character === '(' &&
      source[index + 2] === '<' &&
      !isAnyOf('=!', source[index + 3])
    ) {
      captures += 1;
      named = true;
    }
  }

  return { captures, named };
}

function parseDisjunction(state: RegexParseState, depth: number): RegexNode[] {
  const nodes: RegexNode[] = [];
  const base = state.declared.length;
  const alternativeNames: string[] = [];

  parseAlternative(state, depth, nodes, base, alternativeNames);

  while (state.source[state.index] === '|') {
    nodes.push(createNode(state, 'alternation', state.index, state.index + 1));
    state.index += 1;
    parseAlternative(state, depth, nodes, base, alternativeNames);
  }

  for (const name of alternativeNames) {
    if (state.active.has(name)) continue;

    state.active.add(name);
    state.declared.push(name);
  }

  return nodes;
}

function parseAlternative(
  state: RegexParseState,
  depth: number,
  nodes: RegexNode[],
  base: number,
  alternativeNames: string[],
): void {
  const { source } = state;

  while (state.index < source.length && !isAnyOf('|)', source[state.index]))
    parseTerm(state, depth, nodes);

  // The next alternative may reuse these names (ES2025 duplicate named groups).
  for (const name of state.declared.splice(base)) {
    state.active.delete(name);
    alternativeNames.push(name);
  }
}

function parseTerm(state: RegexParseState, depth: number, nodes: RegexNode[]): void {
  const start = state.index;
  const character = state.source.charAt(start);

  if (character === '^' || character === '$') {
    nodes.push(createNode(state, 'anchor', start, start + 1, { value: character }));
    state.index += 1;
    assertNoQuantifier(state);

    return;
  }

  if (character === '(') return pushAtom(state, nodes, parseGroup(state, depth));
  if (character === '[') return pushAtom(state, nodes, parseClass(state, depth));
  if (character === '\\') return parseAtomEscape(state, nodes);

  if (character === '.') {
    state.index += 1;

    return pushAtom(state, nodes, createNode(state, 'any', start, start + 1));
  }

  if (isAnyOf('*+?', character) || (character === '{' && readBraces(state.source, start)))
    fail('Nothing to repeat', start);

  if (isAnyOf('{}]', character) && isUnicode(state)) fail('Lone quantifier bracket', start);

  pushLiteral(state, nodes, start, readSourceCharacter(state));
}

function pushAtom(state: RegexParseState, nodes: RegexNode[], node: RegexNode): void {
  nodes.push(node);

  if (!isQuantifiable(state, node)) {
    assertNoQuantifier(state);

    return;
  }

  const quantifier = readQuantifier(state);

  if (quantifier) Object.assign(node, quantifier, { end: state.index });
}

function pushLiteral(
  state: RegexParseState,
  nodes: RegexNode[],
  start: number,
  value: string,
): void {
  const end = state.index;
  const quantifier = readQuantifier(state);
  const previous = nodes.at(-1);

  if (!quantifier && previous?.type === 'literal' && previous.min === undefined) {
    previous.value = `${previous.value ?? ''}${value}`;
    previous.end = end;

    return;
  }

  const node = createNode(state, 'literal', start, end, { value });

  if (quantifier) Object.assign(node, quantifier, { end: state.index });

  nodes.push(node);
}

function isQuantifiable(state: RegexParseState, node: RegexNode): boolean {
  if (node.type === 'anchor') return false;
  if (node.type !== 'group') return true;
  if (node.value === 'lookbehind' || node.value === 'negativeLookbehind') return false;

  // Annex B lets lookaheads take a quantifier when neither u nor v is set.
  return !isUnicode(state) || (node.value !== 'lookahead' && node.value !== 'negativeLookahead');
}

function assertNoQuantifier(state: RegexParseState): void {
  const character = state.source[state.index];

  if (isAnyOf('*+?', character) || (character === '{' && readBraces(state.source, state.index)))
    fail('Nothing to repeat', state.index);
}

function readQuantifier(state: RegexParseState): Quantifier | null {
  const { source } = state;
  const start = state.index;
  const character = source.charAt(start);
  let quantifier = Object.hasOwn(SIMPLE_QUANTIFIERS, character)
    ? SIMPLE_QUANTIFIERS[character]
    : undefined;
  let end = start + 1;

  if (character === '{') {
    const braces = readBraces(source, start);

    if (!braces && isUnicode(state)) fail('Incomplete quantifier', start);
    if (braces && braces.max < braces.min) fail('Quantifier {n,m} is out of order', start);

    quantifier = braces ? { max: braces.max, min: braces.min } : undefined;
    end = braces?.end ?? end;
  }

  if (!quantifier) return null;

  state.index = end;
  if (source[end] !== '?') return { ...quantifier };

  state.index += 1;

  return { ...quantifier, lazy: true };
}

function readBraces(
  source: string,
  start: number,
): { end: number; max: number; min: number } | null {
  let index = start + 1;

  while (isDigit(source[index])) index += 1;
  if (index === start + 1) return null;

  const min = clampBound(source.slice(start + 1, index));
  let max = min;

  if (source[index] === ',') {
    const maxStart = index + 1;

    index = maxStart;
    while (isDigit(source[index])) index += 1;
    max = index === maxStart ? Infinity : clampBound(source.slice(maxStart, index));
  }

  return source[index] === '}' ? { end: index + 1, max, min } : null;
}

/** V8 clamps `{n,m}` bounds to 2^31-1, so `a{2147483648,2147483647}` is in order. */
function clampBound(digits: string): number {
  return Math.min(Number(digits), MAX_BOUND);
}

function parseAtomEscape(state: RegexParseState, nodes: RegexNode[]): void {
  const start = state.index;
  const letter = state.source[start + 1];

  if (letter === 'b' || letter === 'B') {
    nodes.push(createNode(state, 'anchor', start, start + 2, { value: letter }));
    state.index += 2;
    assertNoQuantifier(state);

    return;
  }

  const special = readBackreference(state) ?? readClassEscape(state);

  if (special) return pushAtom(state, nodes, special);

  const value = readCharacterEscape(state, 'atom');

  // Annex B: `\c` without a control letter is a literal backslash.
  if (value === null) return pushLiteral(state, nodes, start, '\\');

  pushAtom(state, nodes, createNode(state, 'escape', start, state.index, { value }));
}

function readBackreference(state: RegexParseState): RegexNode | null {
  const { source } = state;
  const start = state.index;

  if (source[start + 1] === 'k' && state.namedGroups) {
    if (source[start + 2] !== '<') fail('Invalid escape', start);

    const { end, name } = readGroupName(state, start + 3);

    state.references.push({ index: start, name });
    state.index = end;

    return createNode(state, 'backreference', start, end, { name });
  }

  if (!isDigit(source[start + 1]) || source[start + 1] === '0') return null;

  let end = start + 2;

  while (isDigit(source[end])) end += 1;
  const digits = source.slice(start + 1, end);

  if (Number(digits) > state.totalCaptures) {
    if (isUnicode(state)) fail('Invalid escape', start);

    // Annex B: no such group, so it is a legacy octal or identity escape.
    return null;
  }

  state.index = end;

  return createNode(state, 'backreference', start, end, { value: digits });
}

function parseGroup(state: RegexParseState, depth: number): RegexNode {
  const start = state.index;

  checkDepth(depth + 1);
  const node = createNode(state, 'group', start, start, readGroupOpening(state));

  node.children = parseDisjunction(state, depth + 1);
  if (state.source[state.index] !== ')') fail('Unterminated group opened', start);

  state.index += 1;
  node.end = state.index;

  return node;
}

function readGroupOpening(state: RegexParseState): GroupOpening {
  const { source } = state;
  const start = state.index;
  const kind = source.charAt(start + 2);

  if (source[start + 1] !== '?') {
    state.index = start + 1;

    return { value: 'capture' };
  }

  if (kind === '<' && isAnyOf('=!', source[start + 3])) {
    state.index = start + 4;

    return { value: source[start + 3] === '=' ? 'lookbehind' : 'negativeLookbehind' };
  }

  if (kind === '<') return readNamedOpening(state, start);

  if (Object.hasOwn(SIMPLE_GROUPS, kind)) {
    state.index = start + 3;

    return { value: SIMPLE_GROUPS[kind] ?? '' };
  }

  if (isAnyOf('ims-', kind)) return readModifiers(state, start);

  return fail('Invalid group', start);
}

function readNamedOpening(state: RegexParseState, start: number): GroupOpening {
  const { end, name } = readGroupName(state, start + 3);

  if (state.active.has(name)) fail(`Duplicate group name "${name}"`, start + 3);

  state.active.add(name);
  state.declared.push(name);
  state.groupNames.add(name);
  state.index = end;

  return { name, value: 'named' };
}

function readModifiers(state: RegexParseState, start: number): GroupOpening {
  const { source } = state;
  const seen = new Set<string>();
  let index = readModifierFlags(source, start + 2, seen);

  if (source[index] === '-') {
    const dash = index;

    index = readModifierFlags(source, dash + 1, seen);
    if (seen.size === 0) fail('Invalid modifiers', dash);
  }

  if (source[index] !== ':') fail('Invalid group', start);

  state.index = index + 1;

  return { name: source.slice(start + 2, index), value: 'modifiers' };
}

function readModifierFlags(source: string, from: number, seen: Set<string>): number {
  let index = from;

  for (let flag = source.charAt(index); isAnyOf('ims', flag); flag = source.charAt(index)) {
    if (seen.has(flag)) fail('Invalid modifiers', index);

    seen.add(flag);
    index += 1;
  }

  return index;
}

function readGroupName(state: RegexParseState, nameStart: number): { end: number; name: string } {
  const close = state.source.indexOf('>', nameStart);
  const raw = state.source.slice(nameStart, Math.max(close, nameStart));
  let name = '';

  for (let index = 0; close >= 0 && index < raw.length;) {
    const escape =
      raw[index] === '\\' && raw[index + 1] === 'u' ? readUnicodeEscapeAt(raw, index, true) : null;

    if (raw[index] === '\\' && !escape) fail('Invalid group name', nameStart);

    name += escape?.value ?? raw.charAt(index);
    index = escape?.end ?? index + 1;
  }

  if (close < 0 || !IDENTIFIER_NAME.test(name)) fail('Invalid group name', nameStart);

  return { end: close + 1, name };
}
