import { FunctionError } from '../errors';

export type RegexNodeType =
  | 'alternation'
  | 'anchor'
  | 'any'
  | 'backreference'
  | 'class'
  | 'classOperator'
  | 'classRange'
  | 'classString'
  | 'escape'
  | 'group'
  | 'literal'
  | 'property';

export type RegexNode = {
  children: RegexNode[];
  end: number;
  lazy?: boolean;
  max?: number;
  min?: number;
  name?: string;
  start: number;
  type: RegexNodeType;
  value?: string;
};

export type RegexParseState = {
  active: Set<string>;
  declared: string[];
  flags: string;
  groupNames: Set<string>;
  index: number;
  /** The grammar's [N] parameter: `\k` is a named reference, never an identity escape. */
  namedGroups: boolean;
  nodes: number;
  references: Array<{ index: number; name: string }>;
  source: string;
  totalCaptures: number;
};

type EscapeContext = 'atom' | 'class' | 'classSet';
type ClassAtom = { codePoint: number; node: RegexNode };

const MAX_DEPTH = 64;
const MAX_NODES = 10_000;
const CONTROL_ESCAPES: Record<string, number> = { f: 12, n: 10, r: 13, t: 9, v: 11 };
const SYNTAX_CHARACTERS = '^$\\.*+?()[]{}|/';
const SET_RESERVED_PUNCTUATORS = '&-!#%,:;<=>@`~';
const SET_DOUBLE_PUNCTUATORS = '&!#$%*+,.:;<=>?@^`~';
const SET_SYNTAX_CHARACTERS = '()[]{}/-\\|';
const CLASS_ESCAPES = 'dDsSwW';
const PROPERTY_NAME = /^[A-Za-z0-9_]+(?:=[A-Za-z0-9_]+)?$/;
const HEX4 = /^[0-9A-Fa-f]{4}$/;
const PROPERTIES_OF_STRINGS = new Set([
  'Basic_Emoji',
  'Emoji_Keycap_Sequence',
  'RGI_Emoji',
  'RGI_Emoji_Flag_Sequence',
  'RGI_Emoji_Modifier_Sequence',
  'RGI_Emoji_Tag_Sequence',
  'RGI_Emoji_ZWJ_Sequence',
]);

export function fail(message: string, index: number): never {
  throw new FunctionError('INVALID_REGEX', `${message} at index ${index}.`);
}

export function isAnyOf(characters: string, character: string | undefined): boolean {
  return character !== undefined && character !== '' && characters.includes(character);
}

export function isDigit(character: string | undefined): boolean {
  return isAnyOf('0123456789', character);
}

export function isUnicode(state: RegexParseState): boolean {
  return state.flags.includes('u') || state.flags.includes('v');
}

export function checkDepth(depth: number): void {
  if (depth > MAX_DEPTH)
    throw new FunctionError(
      'REGEX_LIMIT',
      'Regex Explainer supports at most 64 nested groups and classes.',
    );
}

export function createNode(
  state: RegexParseState,
  type: RegexNodeType,
  start: number,
  end: number,
  extra: Partial<RegexNode> = {},
): RegexNode {
  state.nodes += 1;
  if (state.nodes > MAX_NODES)
    throw new FunctionError('REGEX_LIMIT', 'Regex Explainer supports at most 10,000 nodes.');

  return { children: [], end, start, type, ...extra };
}

export function readSourceCharacter(state: RegexParseState): string {
  const codePoint = state.source.codePointAt(state.index) ?? 0;
  const value = isUnicode(state)
    ? String.fromCodePoint(codePoint)
    : state.source.charAt(state.index);

  state.index += value.length;

  return value;
}

export function readUnicodeEscapeAt(
  text: string,
  at: number,
  unicode: boolean,
): { end: number; value: string } | null {
  if (unicode && text[at + 2] === '{') {
    let close = at + 3;

    while (isAnyOf('0123456789abcdefABCDEF', text[close])) close += 1;
    const codePoint = Number.parseInt(text.slice(at + 3, close), 16);

    if (close === at + 3 || text[close] !== '}' || codePoint > 0x10ffff) return null;

    return { end: close + 1, value: String.fromCodePoint(codePoint) };
  }

  const lead = readHex4(text, at + 2);

  if (lead < 0) return null;

  const trail = text.startsWith('\\u', at + 6) ? readHex4(text, at + 8) : -1;

  if (unicode && lead >= 0xd800 && lead <= 0xdbff && trail >= 0xdc00 && trail <= 0xdfff)
    return { end: at + 12, value: String.fromCharCode(lead, trail) };

  return { end: at + 6, value: String.fromCharCode(lead) };
}

function readHex4(text: string, at: number): number {
  const digits = text.slice(at, at + 4);

  return HEX4.test(digits) ? Number.parseInt(digits, 16) : -1;
}

export function readCharacterEscape(state: RegexParseState, context: EscapeContext): string | null {
  const start = state.index;
  const letter = state.source[start + 1];

  if (letter === undefined) fail('\\ at end of pattern', start);

  if (Object.hasOwn(CONTROL_ESCAPES, letter)) {
    state.index = start + 2;

    return String.fromCharCode(CONTROL_ESCAPES[letter] ?? 0);
  }

  if (letter === 'c') return readControlEscape(state, context);
  if (isDigit(letter)) return readDecimalCharacter(state);

  if (letter === 'x') return readHexEscape(state);

  if (letter === 'u') {
    const escape = readUnicodeEscapeAt(state.source, start, isUnicode(state));

    if (escape) {
      state.index = escape.end;

      return escape.value;
    }
  }

  if (context !== 'atom' && letter === 'b') {
    state.index = start + 2;

    return String.fromCharCode(8);
  }

  return readIdentityEscape(state, context, letter);
}

function readControlEscape(state: RegexParseState, context: EscapeContext): string | null {
  const start = state.index;
  const next = state.source[start + 2];
  const annexClassLetter = context === 'class' && !isUnicode(state) && isAnyOf('0123456789_', next);

  if ((next !== undefined && /^[A-Za-z]$/.test(next)) || annexClassLetter) {
    state.index = start + 3;

    return String.fromCharCode((next?.charCodeAt(0) ?? 0) % 32);
  }

  if (isUnicode(state)) fail('Invalid escape', start);

  state.index = start + 1;

  return null;
}

function readDecimalCharacter(state: RegexParseState): string {
  const { source } = state;
  const start = state.index;
  const first = source.charAt(start + 1);

  if (first === '0' && !isDigit(source[start + 2])) {
    state.index = start + 2;

    return String.fromCharCode(0);
  }

  if (isUnicode(state)) fail('Invalid escape', start);

  if (first === '8' || first === '9') {
    state.index = start + 2;

    return first;
  }

  // Annex B legacy octal: up to 3 digits, at most \377.
  const length = first <= '3' ? 3 : 2;
  let end = start + 2;

  while (end < start + 1 + length && isAnyOf('01234567', source[end])) end += 1;
  state.index = end;

  return String.fromCharCode(Number.parseInt(source.slice(start + 1, end), 8));
}

function readHexEscape(state: RegexParseState): string {
  const start = state.index;
  const digits = state.source.slice(start + 2, start + 4);

  if (/^[0-9A-Fa-f]{2}$/.test(digits)) {
    state.index = start + 4;

    return String.fromCharCode(Number.parseInt(digits, 16));
  }

  return readIdentityEscape(state, 'atom', 'x');
}

function readIdentityEscape(
  state: RegexParseState,
  context: EscapeContext,
  letter: string,
): string {
  const start = state.index;

  if (isUnicode(state)) {
    const extra = { atom: '', class: '-', classSet: SET_RESERVED_PUNCTUATORS }[context];

    if (!isAnyOf(SYNTAX_CHARACTERS + extra, letter)) fail('Invalid escape', start);
  } else if (letter === 'k' && state.namedGroups) {
    fail('Invalid escape', start);
  }

  state.index = start + 2;

  return letter;
}

export function readClassEscape(state: RegexParseState): RegexNode | null {
  const start = state.index;
  const letter = state.source[start + 1];

  if (isAnyOf(CLASS_ESCAPES, letter)) {
    state.index = start + 2;

    return createNode(state, 'escape', start, start + 2, { value: letter });
  }

  if (!isAnyOf('pP', letter) || !isUnicode(state)) return null;

  const open = start + 2;
  const close = state.source[open] === '{' ? state.source.indexOf('}', open) : -1;
  const name = state.source.slice(open + 1, close);

  if (close < 0 || !PROPERTY_NAME.test(name)) fail('Invalid escape', start);

  try {
    // `\P` too: a property of strings such as RGI_Emoji exists only un-negated.
    new RegExp(`\\${letter}{${name}}`, state.flags.includes('v') ? 'v' : 'u');
  } catch {
    fail(`Unknown Unicode property "${name}"`, start);
  }

  state.index = close + 1;

  return createNode(state, 'property', start, close + 1, { value: name });
}

export function parseClass(state: RegexParseState, depth: number): RegexNode {
  const start = state.index;

  checkDepth(depth + 1);
  state.index += 1;
  const negated = state.source[state.index] === '^';

  if (negated) state.index += 1;

  const node = createNode(state, 'class', start, start, negated ? { value: 'negated' } : {});

  node.children = state.flags.includes('v')
    ? parseClassSet(state, depth + 1)
    : parseClassRanges(state);

  if (state.source[state.index] !== ']') fail('Unterminated character class opened', start);

  if (negated && mayContainStrings(node.children))
    fail('Negated character class may contain strings', start);

  state.index += 1;
  node.end = state.index;

  return node;
}

/** The spec's MayContainStrings: unions if any operand may, `&&` only if all do, `--` its first. */
function mayContainStrings(children: RegexNode[]): boolean {
  const operator = children[1]?.type === 'classOperator' ? children[1].value : undefined;
  const operands = children.filter((child) => child.type !== 'classOperator');

  if (operator === '&&') return operands.every(operandMayContainStrings);
  if (operator === '--') return operandMayContainStrings(operands[0]);

  return operands.some(operandMayContainStrings);
}

function operandMayContainStrings(node: RegexNode | undefined): boolean {
  if (node?.type === 'classString')
    return node.children.some((child) => Array.from(child.value ?? '').length !== 1);
  if (node?.type === 'property') return PROPERTIES_OF_STRINGS.has(node.value ?? '');
  if (node?.type === 'class') return node.value !== 'negated' && mayContainStrings(node.children);

  return false;
}

function parseClassRanges(state: RegexParseState): RegexNode[] {
  const { source } = state;
  const children: RegexNode[] = [];

  while (state.index < source.length && source[state.index] !== ']') {
    const first = parseClassAtom(state);
    const dash = state.index;

    if (source[dash] !== '-' || dash + 1 >= source.length || source[dash + 1] === ']') {
      children.push(first.node);

      continue;
    }

    state.index += 1;
    const second = parseClassAtom(state);

    if (first.codePoint >= 0 && second.codePoint >= 0) {
      children.push(rangeNode(state, first, second));

      continue;
    }

    if (isUnicode(state)) fail('Invalid class range', first.node.start);

    // Annex B: a range with a class escape is three members, the "-" included.
    children.push(first.node, createNode(state, 'literal', dash, dash + 1, { value: '-' }));
    children.push(second.node);
  }

  return children;
}

function parseClassAtom(state: RegexParseState): ClassAtom {
  const start = state.index;

  if (state.source[start] !== '\\') return characterAtom(state, start, readSourceCharacter(state));

  const escape = readClassEscape(state);

  if (escape) return { codePoint: -1, node: escape };

  const value = readCharacterEscape(state, 'class');

  return characterAtom(state, start, value ?? '\\');
}

function characterAtom(state: RegexParseState, start: number, value: string): ClassAtom {
  const type = state.index - start > 1 && state.source[start] === '\\' ? 'escape' : 'literal';

  return {
    codePoint: value.codePointAt(0) ?? 0,
    node: createNode(state, type, start, state.index, { value }),
  };
}

function rangeNode(state: RegexParseState, first: ClassAtom, second: ClassAtom): RegexNode {
  if (first.codePoint > second.codePoint)
    fail('Character class range is out of order', first.node.start);

  return createNode(state, 'classRange', first.node.start, second.node.end, {
    children: [first.node, second.node],
  });
}

function setOperatorAt(state: RegexParseState): string | null {
  const pair = state.source.slice(state.index, state.index + 2);

  return pair === '--' || pair === '&&' ? pair : null;
}

function parseClassSet(state: RegexParseState, depth: number): RegexNode[] {
  if (state.index >= state.source.length || state.source[state.index] === ']') return [];

  const first = parseSetOperand(state, depth, true);
  const children = [first];
  const operator = setOperatorAt(state);

  if (operator && first.type !== 'classRange') {
    parseSetOperation(state, depth, operator, children);

    return children;
  }

  while (state.index < state.source.length && state.source[state.index] !== ']') {
    if (setOperatorAt(state)) fail('Invalid set operation', state.index);

    children.push(parseSetOperand(state, depth, true));
  }

  return children;
}

function parseSetOperation(
  state: RegexParseState,
  depth: number,
  operator: string,
  children: RegexNode[],
): void {
  const { source } = state;

  while (state.index < source.length && source[state.index] !== ']') {
    if (setOperatorAt(state) !== operator) fail('Invalid set operation', state.index);

    children.push(
      createNode(state, 'classOperator', state.index, state.index + 2, { value: operator }),
    );

    state.index += 2;
    if (operator === '&&' && source[state.index] === '&')
      fail('Invalid character in class', state.index);

    if (state.index >= source.length) return;

    children.push(parseSetOperand(state, depth, false));
  }
}

function parseSetOperand(state: RegexParseState, depth: number, allowRange: boolean): RegexNode {
  const { source } = state;

  if (source[state.index] === '[') return parseClass(state, depth);
  if (source.startsWith('\\q', state.index)) return parseClassString(state);

  const escape = source[state.index] === '\\' ? readClassEscape(state) : null;

  if (escape) return escape;

  const first = parseSetCharacter(state);
  const dash = state.index;

  if (!allowRange || source[dash] !== '-' || source[dash + 1] === '-' || dash + 1 >= source.length)
    return first.node;

  state.index += 1;
  const next = source[state.index];

  if (next === '[' || (next === '\\' && isAnyOf(`${CLASS_ESCAPES}pPq`, source[state.index + 1])))
    fail('Invalid class range', first.node.start);

  return rangeNode(state, first, parseSetCharacter(state));
}

function parseSetCharacter(state: RegexParseState): ClassAtom {
  const start = state.index;

  return characterAtom(state, start, readSetCharacter(state));
}

function readSetCharacter(state: RegexParseState): string {
  const { source } = state;
  const character = source[state.index];

  if (character === '\\') return readCharacterEscape(state, 'classSet') ?? '\\';

  if (
    isAnyOf(SET_SYNTAX_CHARACTERS, character) ||
    (isAnyOf(SET_DOUBLE_PUNCTUATORS, character) && source[state.index + 1] === character)
  )
    fail('Invalid character in class', state.index);

  return readSourceCharacter(state);
}

function parseClassString(state: RegexParseState): RegexNode {
  const { source } = state;
  const start = state.index;

  if (source[start + 2] !== '{') fail('Invalid escape', start);

  const node = createNode(state, 'classString', start, start);
  let alternativeStart = start + 3;
  let value = '';

  state.index = alternativeStart;

  while (source[state.index] !== '}') {
    if (state.index >= source.length) fail('Invalid escape', start);

    if (source[state.index] !== '|') {
      value += readSetCharacter(state);

      continue;
    }

    node.children.push(createNode(state, 'literal', alternativeStart, state.index, { value }));
    state.index += 1;
    alternativeStart = state.index;
    value = '';
  }

  node.children.push(createNode(state, 'literal', alternativeStart, state.index, { value }));
  state.index += 1;
  node.end = state.index;

  return node;
}
