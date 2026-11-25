import { mathError, required } from './shared';

const multiplicativeOperations: Record<'*' | '/' | '%', (left: number, right: number) => number> = {
  '%': (left, right) => left % right,
  '*': (left, right) => left * right,
  '/': (left, right) => left / right,
};

type ExpressionState = { depth: number; index: number; input: string };

export function evaluateExpression(value: string): number {
  if (value.length > 10_000) throw mathError('Expression exceeds 10,000 characters.');

  const state: ExpressionState = { depth: 0, index: 0, input: required(value, 'Expression') };
  const result = parseSum(state);

  skipSpaces(state);
  if (state.index !== state.input.length)
    throw mathError(`Unexpected token near "${state.input.slice(state.index, state.index + 8)}".`);
  if (!Number.isFinite(result)) throw mathError('Expression result is not finite.');

  return result;
}

function skipSpaces(state: ExpressionState) {
  while (/\s/.test(state.input[state.index] ?? '')) state.index += 1;
}

function parseSum(state: ExpressionState): number {
  let result = parseProduct(state);

  while (true) {
    skipSpaces(state);
    const operator = state.input[state.index];

    if (operator !== '+' && operator !== '-') return result;

    state.index += 1;
    const next = parseProduct(state);

    result = operator === '+' ? result + next : result - next;
  }
}

function parseProduct(state: ExpressionState): number {
  let result = parseFactor(state);

  while (true) {
    skipSpaces(state);
    const operator = state.input[state.index];

    if (operator !== '*' && operator !== '/' && operator !== '%') return result;

    state.index += 1;
    const next = parseFactor(state);

    if ((operator === '/' || operator === '%') && next === 0)
      throw mathError('Division by zero is not allowed.');

    result = multiplicativeOperations[operator](result, next);
  }
}

function parseFactor(state: ExpressionState): number {
  if (++state.depth > 129) throw mathError('Expression nesting exceeds 128 levels.');

  try {
    skipSpaces(state);
    const character = state.input[state.index];

    if (character === '+' || character === '-') {
      state.index += 1;
      const result = parseFactor(state);

      return character === '-' ? -result : result;
    }

    if (character === '(') {
      state.index += 1;
      const result = parseSum(state);

      skipSpaces(state);
      if (state.input[state.index] !== ')') throw mathError('Expected closing parenthesis.');

      state.index += 1;

      return result;
    }

    return parseNumber(state);
  } finally {
    state.depth -= 1;
  }
}

function parseNumber(state: ExpressionState): number {
  const match = state.input.slice(state.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);

  if (!match)
    throw mathError(`Unexpected token near "${state.input.slice(state.index, state.index + 8)}".`);

  state.index += match[0].length;
  const number = Number(match[0]);

  if (!Number.isFinite(number)) throw mathError('Expression contains a non-finite number.');

  return number;
}
