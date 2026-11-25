import type { RegexNode } from './regexParse';

export type WordContext = { captures: number; flags: string; source: string };

const FLAG_WORDS: Record<string, string> = {
  d: 'indices',
  g: 'global',
  i: 'ignore case',
  m: 'multiline',
  s: 'dot matches newlines',
  u: 'unicode',
  v: 'unicode sets',
  y: 'sticky',
};
const CLASS_ESCAPES: Record<string, string> = {
  D: 'Not a digit',
  S: 'Not a whitespace character',
  W: 'Not a word character',
  d: 'A digit (0-9)',
  s: 'A whitespace character',
  w: 'A word character (A-Z, a-z, 0-9, _)',
};
const GROUP_WORDS: Record<string, string> = {
  lookahead: 'Followed by',
  lookbehind: 'Preceded by',
  negativeLookahead: 'Not followed by',
  negativeLookbehind: 'Not preceded by',
  nonCapture: 'Non-capturing group',
};
const OPENER_LENGTHS: Record<string, number> = {
  capture: 1,
  lookahead: 3,
  lookbehind: 4,
  negativeLookahead: 3,
  negativeLookbehind: 4,
  nonCapture: 3,
};

export function describeFlags(flags: string): string {
  if (flags === '') return 'none';

  return Array.from(flags, (flag) => `${flag} (${FLAG_WORDS[flag]})`).join(', ');
}

export function openerLength(source: string, node: RegexNode): number {
  if (node.type === 'class') return node.value === 'negated' ? 2 : 1;
  if (node.value === 'named') return source.indexOf('>', node.start) + 1 - node.start;
  if (node.value === 'modifiers') return (node.name?.length ?? 0) + 3;

  return OPENER_LENGTHS[node.value ?? 'capture'] ?? 1;
}

export function describeNode(context: WordContext, node: RegexNode): string {
  const multiline = context.flags.includes('m');

  switch (node.type) {
    case 'alternation':
      return 'Or';
    case 'anchor':
      return describeAnchor(node.value ?? '', multiline);
    case 'any':
      return context.flags.includes('s') ? 'Any character' : 'Any character except line breaks';
    case 'backreference':
      return `The text matched by group ${node.name === undefined ? node.value : `"${node.name}"`}`;
    case 'class':
      return node.value === 'negated'
        ? 'One character not in the set'
        : 'One character from the set';
    case 'classOperator':
      return node.value === '--' ? 'Minus' : 'Intersected with';
    case 'classRange':
      return `A character from "${show(literalText(node.children[0]))}" to "${show(literalText(node.children[1]))}"`;
    case 'classString':
      return `One of the strings ${node.children.map((child) => `"${show(child.value ?? '')}"`).join(', ')}`;
    case 'escape':
      return describeEscape(context.source, node);
    case 'group':
      return describeGroup(context, node);
    case 'literal':
      return describeLiteral(node.value ?? '');
    default:
      return describeProperty(context.source, node);
  }
}

function literalText(node: RegexNode | undefined): string {
  if (!node) return '';

  return node.value ?? '';
}

function describeAnchor(value: string, multiline: boolean): string {
  if (value === 'b') return 'A word boundary';
  if (value === 'B') return 'Not a word boundary';
  if (value === '^') return multiline ? 'Start of a line' : 'Start of input';

  return multiline ? 'End of a line' : 'End of input';
}

function describeLiteral(value: string): string {
  const single = Array.from(value).length === 1;

  return `The character${single ? '' : 's'} "${show(value)}"`;
}

function describeEscape(source: string, node: RegexNode): string {
  const value = node.value ?? '';

  if (value.length === 1 && Object.hasOwn(CLASS_ESCAPES, value) && source[node.start + 1] === value)
    return CLASS_ESCAPES[value] ?? '';

  if (source[node.start + 1] === value) return describeLiteral(value);

  const codePoint = value.codePointAt(0) ?? 0;
  const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
  const printable = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u.test(String.fromCodePoint(codePoint));
  const shown = printable ? ` ("${String.fromCodePoint(codePoint)}")` : '';
  const digit = source[node.start + 1] ?? '';
  const isOctal = /^[1-7]$/.test(digit) || (digit === '0' && node.end - node.start > 2);
  const octal = isOctal ? ' (legacy octal escape)' : '';

  return `The character U+${hex}${shown}${octal}`;
}

function describeProperty(source: string, node: RegexNode): string {
  const negated = source[node.start + 1] === 'P';

  return `A character ${negated ? 'without' : 'with'} Unicode property ${node.value ?? ''}`;
}

function describeGroup(context: WordContext, node: RegexNode): string {
  const kind = node.value ?? 'capture';

  if (kind === 'capture') {
    context.captures += 1;

    return `Capture group ${context.captures}`;
  }

  if (kind === 'named') {
    context.captures += 1;

    return `Named capture group "${show(node.name ?? '')}" (group ${context.captures})`;
  }

  if (kind === 'modifiers') return describeModifiers(node.name ?? '');

  return GROUP_WORDS[kind] ?? 'Group';
}

function describeModifiers(raw: string): string {
  const dash = raw.indexOf('-');
  const on = dash === -1 ? raw : raw.slice(0, dash);
  const off = dash === -1 ? '' : raw.slice(dash + 1);
  const parts = [
    ...Array.from(on, (flag) => `${flag} on`),
    ...Array.from(off, (flag) => `${flag} off`),
  ];

  return `Group with flags ${parts.join(', ')}`;
}

export function show(value: string): string {
  return value.replace(
    /\p{Cc}/gu,
    (character) => `\\x${(character.codePointAt(0) ?? 0).toString(16).padStart(2, '0')}`,
  );
}

export function quantifierSuffix(source: string, node: RegexNode): string {
  if (node.min === undefined || node.max === undefined) return '';

  const lazy = node.lazy ? ', as few times as possible' : '';

  return `${countWords(node.min, node.max, writtenBounds(source, node))}${lazy}`;
}

function writtenBounds(source: string, node: RegexNode): [string, string] {
  const braces = /\{(\d+)(?:(,)(\d*))?\}\??$/.exec(source.slice(node.start, node.end));

  if (!braces) return [String(node.min), String(node.max)];

  const min = trimZeros(braces[1] ?? '');

  return [min, braces[2] === undefined ? min : trimZeros(braces[3] ?? '')];
}

function trimZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, '');
}

function countWords(min: number, max: number, [minText, maxText]: [string, string]): string {
  if (min === 0 && max === Infinity) return ', zero or more times';
  if (min === 1 && max === Infinity) return ', one or more times';
  if (min === 0 && max === 1) return ', optionally';
  if (minText === maxText) return `, exactly ${minText} times`;
  if (max === Infinity) return `, ${minText} or more times`;

  return `, ${minText} to ${maxText} times`;
}
