import { FunctionError } from '../errors';
import {
  Cursor,
  fail,
  findClose,
  isAnPlusB,
  isCombinator,
  isDelim,
  isTypeName,
  nthParts,
  SelectorSyntaxError,
  splitSelectorList,
  tokenizeSelector,
  unexpected,
} from './specificityTokens';
import { parseAttribute, skipNamespace } from './specificityAttribute';
import { canFollowPseudoElement, isKnownPseudo, legacyPseudoElements } from './specificityNames';

export type Specificity = [number, number, number];

export const specificityLimits = {
  maxDepth: 32,
  maxInput: 100_000,
  maxSelectorLength: 2_000,
  maxSelectors: 200,
};

type Context = { depth: number; inHas: boolean; nested: boolean };
type ListKind = 'complex' | 'forgiving' | 'relative';

const ZERO: Specificity = [0, 0, 0];
const ID: Specificity = [1, 0, 0];
const CLASS: Specificity = [0, 1, 0];
const TYPE: Specificity = [0, 0, 1];
const nestingError = '& depends on the parent rule; paste the resolved selector.';

const add = (left: Specificity, right: Specificity): Specificity => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2],
];

export function compareSpecificity(left: Specificity, right: Specificity): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function deeper(context: Context, inHas = context.inHas): Context {
  if (context.depth >= specificityLimits.maxDepth)
    throw new SelectorSyntaxError(
      `Selector nesting is limited to ${specificityLimits.maxDepth} levels of :is(), :not() and :has().`,
      true,
    );

  return { depth: context.depth + 1, inHas, nested: true };
}

function parseList(cursor: Cursor, end: number, context: Context, kind: ListKind): Specificity {
  let best = ZERO;
  let start = cursor.pos;
  let depth = 0;

  for (let index = cursor.pos; index <= end; index += 1) {
    const token = cursor.tokens[index];

    if (index < end && (token?.kind === 'function' || isDelim(token, '('))) depth += 1;
    else if (index < end && isDelim(token, ')')) depth -= 1;
    else if (index === end || (depth === 0 && isDelim(token, ','))) {
      const argument = new Cursor(cursor.source, cursor.tokens, start, index);

      try {
        const value = parseComplex(argument, context, kind === 'relative');

        if (compareSpecificity(value, best) > 0) best = value;
      } catch (error) {
        if (kind !== 'forgiving' || !(error instanceof SelectorSyntaxError) || error.fatal)
          throw error;
      }

      start = index + 1;
    }
  }

  return best;
}

function parseComplex(cursor: Cursor, context: Context, relative: boolean): Specificity {
  cursor.skipSpace();

  if (isCombinator(cursor.peek())) {
    if (!relative) fail('A selector cannot start with a combinator; use :has() for that.');

    cursor.pos += 1;
    cursor.skipSpace();
  }

  let compound = parseCompound(cursor, context);
  let total = compound.total;

  for (;;) {
    const spaced = cursor.skipSpace();
    const token = cursor.peek();

    if (!token) return total;

    if (compound.element) fail(`"::${compound.element}" must end the selector.`);

    if (isCombinator(token)) {
      cursor.pos += 1;
      cursor.skipSpace();

      if (!cursor.peek()) fail('A combinator must be followed by a selector.');
    } else if (!spaced) unexpected(cursor, token);

    compound = parseCompound(cursor, context);
    total = add(total, compound.total);
  }
}

function parseCompound(cursor: Cursor, context: Context): { element: string; total: Specificity } {
  const start = cursor.pos;
  let total = parseTypeSelector(cursor);
  let lastElement = '';

  for (;;) {
    const token = cursor.peek();

    if (isDelim(token, ':')) {
      const [value, element] = parsePseudo(cursor, context);

      if (element && lastElement && !canFollowPseudoElement(lastElement, element))
        fail(`"::${element}" cannot follow "::${lastElement}".`);

      lastElement = element || lastElement;
      total = add(total, value);
    } else if (token?.kind === 'hash' || isDelim(token, '.') || isDelim(token, '[')) {
      if (lastElement) fail('Only pseudo-classes may follow a pseudo-element.');

      total = add(total, parseSubclass(cursor));
    } else break;
  }

  if (cursor.pos === start) {
    const token = cursor.peek();

    return token ? unexpected(cursor, token) : fail('Expected a selector.');
  }

  return { element: lastElement, total };
}

function parseTypeSelector(cursor: Cursor): Specificity {
  skipNamespace(cursor, isTypeName);

  const token = cursor.peek();

  if (!isTypeName(token)) return ZERO;

  cursor.pos += 1;

  return token?.kind === 'ident' ? TYPE : ZERO;
}

function parseSubclass(cursor: Cursor): Specificity {
  const token = cursor.peek();

  if (token?.kind === 'hash') {
    const digit = token.value[0] !== undefined && token.value[0] >= '0' && token.value[0] <= '9';

    if (!token.idStart)
      fail(
        `"#${token.value}" is not a valid id selector${digit ? '; escape a leading digit, e.g. #\\31 23' : ''}.`,
      );

    cursor.pos += 1;

    return ID;
  }

  if (isDelim(token, '[')) return parseAttribute(cursor);

  if (cursor.peek(1)?.kind !== 'ident') fail('Expected a class name after ".".');

  cursor.pos += 2;

  return CLASS;
}

function parsePseudo(cursor: Cursor, context: Context): [Specificity, string] {
  cursor.pos += 1;

  const double = isDelim(cursor.peek(), ':');

  if (double) cursor.pos += 1;

  const token = cursor.peek();
  const name = token?.value.toLowerCase() ?? '';
  const functional = token?.kind === 'function';
  const element = double || (!functional && legacyPseudoElements.has(name));
  const label = `${double ? '::' : ':'}${name}${functional ? '()' : ''}`;

  if (token?.kind !== 'ident' && !functional)
    fail(`Expected a pseudo-${double ? 'element' : 'class'} name after "${double ? '::' : ':'}".`);

  if (!isKnownPseudo(name, element, functional))
    fail(`Unknown pseudo-${element ? 'element' : 'class'} "${label}".`);

  cursor.pos += 1;

  if (!functional) return element ? [pseudoElementBase(context), name] : [CLASS, ''];

  const close = findClose(cursor);

  if (close === -1) fail(`Missing ")" to close ${label}.`);

  const value = element
    ? add(pseudoElementBase(context), pseudoElementArgument(cursor, close, name, context))
    : pseudoClassFunction(cursor, close, name, context);

  cursor.pos = close + 1;

  return [value, element ? name : ''];
}

function pseudoElementArgument(
  cursor: Cursor,
  close: number,
  name: string,
  context: Context,
): Specificity {
  if (name === 'slotted') return compoundArgument(cursor, close, context);

  requireArgument(cursor, close, `::${name}()`);

  return ZERO;
}

function requireArgument(cursor: Cursor, close: number, label: string): void {
  if (cursor.tokens.slice(cursor.pos, close).every((token) => token.kind === 'space'))
    fail(`${label} needs an argument.`);
}

function requireNameList(cursor: Cursor, close: number, label: string): void {
  const items = cursor.tokens.slice(cursor.pos, close).filter((token) => token.kind !== 'space');
  const misplaced = items.some((token, index) =>
    index % 2 === 0 ? token.kind !== 'ident' : !isDelim(token, ','),
  );

  if (items.length % 2 === 0 || misplaced) fail(`${label} needs a comma-separated list of names.`);
}

function pseudoElementBase(context: Context): Specificity {
  if (context.nested) fail('Pseudo-elements are not allowed inside :is(), :not() or :has().');

  return TYPE;
}

function pseudoClassFunction(
  cursor: Cursor,
  close: number,
  name: string,
  context: Context,
): Specificity {
  switch (name) {
    case 'is':
      return parseList(cursor, close, deeper(context), 'forgiving');
    case 'where':
      parseList(cursor, close, deeper(context), 'forgiving');

      return ZERO;
    case 'not':
      return parseList(cursor, close, deeper(context), 'complex');
    case 'has':
      if (context.inHas) fail(':has() cannot be nested inside :has().');

      return parseList(cursor, close, deeper(context, true), 'relative');
    case 'nth-child':
    case 'nth-last-child':
      return add(CLASS, nthArgument(cursor, close, context, true));
    case 'nth-col':
    case 'nth-last-col':
    case 'nth-of-type':
    case 'nth-last-of-type':
      return add(CLASS, nthArgument(cursor, close, context, false));
    case 'host':
    case 'host-context':
      return add(CLASS, compoundArgument(cursor, close, context));
    case 'active-view-transition-type':
      requireNameList(cursor, close, `:${name}()`);

      return CLASS;
    default:
      requireArgument(cursor, close, `:${name}()`);

      return CLASS;
  }
}

function compoundArgument(cursor: Cursor, close: number, context: Context): Specificity {
  const argument = new Cursor(cursor.source, cursor.tokens, cursor.pos, close);

  argument.skipSpace();

  const value = parseCompound(argument, deeper(context)).total;

  argument.skipSpace();

  if (argument.peek()) fail('Only a compound selector (no combinators) is allowed here.');

  return value;
}

function nthArgument(
  cursor: Cursor,
  close: number,
  context: Context,
  allowOf: boolean,
): Specificity {
  const { of, text } = nthParts(cursor, close);

  if (text === '') fail('Expected an An+B value such as 2n+1, odd or even.');

  if (!isAnPlusB(text)) fail(`"${text}" is not a valid An+B value such as 2n+1, odd or even.`);

  if (of === -1) return ZERO;

  if (!allowOf) fail('Only :nth-child() and :nth-last-child() accept "of S".');

  cursor.pos = of + 1;

  return parseList(cursor, close, deeper(context), 'complex');
}

function rowFor(selector: string): SpecificityRow {
  if (selector.length > specificityLimits.maxSelectorLength)
    return {
      error: `Selectors are limited to ${specificityLimits.maxSelectorLength.toLocaleString('en-US')} characters.`,
      selector,
    };

  try {
    const tokens = tokenizeSelector(selector);

    if (tokens.some((token) => isDelim(token, '&'))) return { error: nestingError, selector };

    const cursor = new Cursor(selector, tokens, 0, tokens.length);
    const context: Context = { depth: 0, inHas: false, nested: false };

    return { selector, specificity: parseComplex(cursor, context, false) };
  } catch (error) {
    if (error instanceof SelectorSyntaxError) return { error: error.message, selector };

    throw error;
  }
}

type SpecificityRow = { error?: string; selector: string; specificity?: Specificity };

export function selectorSpecificity(input: string): SpecificityRow[] {
  if (input.length > specificityLimits.maxInput)
    throw new FunctionError(
      'INVALID_CSS',
      `Selector input is limited to ${specificityLimits.maxInput.toLocaleString('en-US')} characters.`,
    );

  return splitSelectorList(input, specificityLimits).map((part) => rowFor(part.trim()));
}
