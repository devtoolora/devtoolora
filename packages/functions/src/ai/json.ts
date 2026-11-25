import { FunctionError } from '../errors';
import {
  parseExactJson,
  parseJsonExactIntegers,
  type ExactJsonValue,
  type JsonValue,
} from '../format/json';
import { JsonNumberToken, JsonSyntaxError, parseLosslessJson } from '../format/jsonDocument';

type AiJsonLimits = { characters: number; depth: number; nodes?: number };

const format = new Intl.NumberFormat('en-US');

const fail = (message: string): never => {
  throw new FunctionError('INVALID_JSON', message);
};

function checkShape(value: ExactJsonValue, label: string, { depth, nodes }: AiJsonLimits): void {
  const stack: Array<[ExactJsonValue, number]> = [[value, 0]];
  let count = 0;

  for (let entry = stack.pop(); entry; entry = stack.pop()) {
    const [current, level] = entry;

    count += 1;

    if (nodes !== undefined && count > nodes)
      fail(`${label} must have at most ${format.format(nodes)} values.`);

    if (current === null || typeof current !== 'object' || current instanceof JsonNumberToken)
      continue;

    if (level + 1 > depth) fail(`${label} is nested deeper than ${depth} levels.`);

    for (const child of Object.values(current)) stack.push([child, level + 1]);
  }
}

function readAiJson<T extends ExactJsonValue>(
  text: string,
  label: string,
  limits: AiJsonLimits,
  read: (text: string) => T,
): T {
  if (text.length > limits.characters)
    fail(`${label} must be at most ${format.format(limits.characters)} characters.`);

  let value: T;

  try {
    value = read(text);
  } catch (error: unknown) {
    // The exact-number errors say how to fix the value without echoing it.
    if (error instanceof FunctionError) fail(`${label}: ${error.message}`);

    try {
      parseLosslessJson(text);
    } catch (error: unknown) {
      // Its project-written reasons give the position without echoing the input.
      if (error instanceof JsonSyntaxError) fail(`${label}: ${error.message}`);
    }

    return fail(`${label} is not valid JSON.`);
  }

  checkShape(value, label, limits);

  return value;
}

export function parseAiJson(text: string, label: string, limits: AiJsonLimits): JsonValue {
  return readAiJson(text, label, limits, (input) => parseJsonExactIntegers(input) as JsonValue);
}

/** parseAiJson for values that are only printed, so a big number keeps its digits. */
export function parseAiText(text: string, label: string, limits: AiJsonLimits): ExactJsonValue {
  return readAiJson(text, label, limits, (input) => parseExactJson(input).value);
}
