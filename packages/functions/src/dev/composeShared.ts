import type { JsonValue } from '../format/json';
import { composeEnums, composePatterns, composeRanges, type ComposeKind } from './composeSpec';
import { isDuration, isInterpolated } from './composeValues';

export interface ComposeIssue {
  message: string;
  path: string;
}

export interface Declared {
  configs: ReadonlySet<string>;
  models: ReadonlySet<string>;
  networks: ReadonlySet<string>;
  secrets: ReadonlySet<string>;
  services: ReadonlySet<string>;
  volumes: ReadonlySet<string>;
}

export interface Walk {
  declared: Declared;
  edges: Map<string, string[]>;
  errors: ComposeIssue[];
  interpolated: number;
  published: Map<string, { end: number; owner: string; start: number }[]>;
  warnings: ComposeIssue[];
}

export type JsonMap = { [key: string]: JsonValue };

const PLAIN_KEY = /^[A-Za-z0-9_-]+$/;
const MAX_SUGGESTED_KEY = 64;
const BOOLEAN_TEXT = /^(?:true|false|y|yes|on|n|no|off)$/i;
const INTEGER_TEXT = /^[+-]?\d+$/;
const NUMBER_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const SIZE_TEXT = /^(?:\d+(?:\.\d*)?|\.\d+) ?(?:b|[kmgtp](?:i?b)?)?$/i;

export function isMap(value: JsonValue | undefined): value is JsonMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function childPath(base: string, key: string): string {
  if (!PLAIN_KEY.test(key)) {
    return `${base}[${JSON.stringify(key)}]`;
  }

  return base === '' ? key : `${base}.${key}`;
}

export function indexPath(base: string, index: number): string {
  return `${base}[${index}]`;
}

export function addError(walk: Walk, path: string, message: string): void {
  walk.errors.push({ message, path });
}

export function addWarning(walk: Walk, path: string, message: string): void {
  walk.warnings.push({ message, path });
}

export function skipInterpolated(walk: Walk, value: JsonValue | undefined): boolean {
  if (typeof value !== 'string' || !isInterpolated(value)) {
    return false;
  }

  walk.interpolated += 1;

  return true;
}

function distanceWithinTwo(first: string, second: string): number {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    let best = row;

    for (let column = 1; column <= second.length; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      const value = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + cost,
      );

      current.push(value);
      best = Math.min(best, value);
    }

    if (best > 2) {
      return 3;
    }

    previous = current;
  }

  return previous[second.length] ?? 3;
}

function suggestKey(key: string, allowed: ReadonlySet<string>): string | undefined {
  if (key.length > MAX_SUGGESTED_KEY) {
    return undefined;
  }

  let found: string | undefined;
  let foundDistance = 3;

  for (const candidate of allowed) {
    const distance =
      Math.abs(candidate.length - key.length) > 2 ? 3 : distanceWithinTwo(key, candidate);
    const closer = distance < foundDistance;
    const tie = distance === foundDistance && found !== undefined && candidate < found;

    if (closer || tie) {
      found = candidate;
      foundDistance = distance;
    }
  }

  return found;
}

export function checkKey(
  walk: Walk,
  key: string,
  path: string,
  allowed: ReadonlySet<string>,
): void {
  if (allowed.has(key) || key.startsWith('x-')) {
    return;
  }

  const hint = suggestKey(key, allowed);

  addError(
    walk,
    childPath(path, key),
    hint === undefined ? 'unknown key.' : `unknown key; did you mean "${hint}"?`,
  );
}

export function checkKeys(
  walk: Walk,
  map: JsonMap,
  path: string,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Object.keys(map)) {
    checkKey(walk, key, path, allowed);
  }
}

function enumMessage(specKey: string, value: JsonValue): string | undefined {
  const values = composeEnums.get(specKey) ?? [];

  return typeof value === 'string' && values.includes(value)
    ? undefined
    : `expected one of: ${values.join(', ')}.`;
}

function patternMessage(specKey: string, value: JsonValue): string | undefined {
  const rule = composePatterns.get(specKey);

  return typeof value === 'string' && rule?.pattern.test(value) === true
    ? undefined
    : (rule?.message ?? 'expected a string.');
}

function kindMessage(kind: ComposeKind, value: JsonValue, specKey: string): string | undefined {
  const text = typeof value === 'string';

  switch (kind) {
    case 'string':
      return text ? undefined : 'expected a string.';
    case 'boolean':
      return typeof value === 'boolean' || (text && BOOLEAN_TEXT.test(value))
        ? undefined
        : 'expected a boolean.';
    case 'integer':
      return Number.isInteger(value) || (text && INTEGER_TEXT.test(value))
        ? undefined
        : 'expected an integer.';
    case 'integerOrText':
      return text || Number.isInteger(value) ? undefined : 'expected an integer.';
    case 'number':
      return typeof value === 'number' || (text && NUMBER_TEXT.test(value))
        ? undefined
        : 'expected a number.';
    case 'numberOrText':
      return text || typeof value === 'number' ? undefined : 'expected a number.';
    case 'bytes':
      return typeof value === 'number' || (text && SIZE_TEXT.test(value))
        ? undefined
        : 'expected a size such as 512m or 1g.';
    case 'pattern':
      return patternMessage(specKey, value);
    case 'duration':
      return text && isDuration(value) ? undefined : 'expected a duration such as 30s or 1m30s.';
    case 'enum':
      return enumMessage(specKey, value);
    case 'mapping':
      return isMap(value) ? undefined : 'expected a mapping.';
    case 'listOfStrings':
      return Array.isArray(value) ? undefined : 'expected a list.';
    case 'stringOrList':
      return text || Array.isArray(value) ? undefined : 'expected a string or a list.';
    case 'command':
      return value === null || text || Array.isArray(value)
        ? undefined
        : 'expected a string or a list.';
    case 'listOrDict':
      return Array.isArray(value) || isMap(value) ? undefined : 'expected a list or a mapping.';
    default:
      return undefined;
  }
}

function checkItems(walk: Walk, kind: ComposeKind, value: JsonValue, path: string): void {
  const entries: Array<[string, JsonValue]> = Array.isArray(value)
    ? value.map((item, index) => [indexPath(path, index), item])
    : Object.entries(isMap(value) ? value : {}).map(([key, item]) => [childPath(path, key), item]);
  const lenient = kind === 'listOfStrings' || kind === 'listOrDict';

  for (const [itemPath, item] of entries) {
    const loose =
      lenient && (typeof item === 'number' || typeof item === 'boolean' || item === null);

    if (!loose && !skipInterpolated(walk, item) && typeof item !== 'string') {
      addError(walk, itemPath, 'expected a string.');
    }
  }
}

function rangeMessage(specKey: string, value: JsonValue): string | undefined {
  const range = composeRanges.get(specKey);

  return range !== undefined && typeof value === 'number' && (value < range[0] || value > range[1])
    ? `expected a number from ${range[0]} to ${range[1]}.`
    : undefined;
}

export function checkKind(
  walk: Walk,
  kind: ComposeKind,
  value: JsonValue,
  path: string,
  specKey = '',
): void {
  if (skipInterpolated(walk, value)) {
    return;
  }

  const message = kindMessage(kind, value, specKey) ?? rangeMessage(specKey, value);

  if (message !== undefined) {
    addError(walk, path, message);
  } else if (
    kind === 'listOfStrings' ||
    kind === 'stringOrList' ||
    kind === 'listOrDict' ||
    kind === 'command'
  ) {
    checkItems(walk, kind, value, path);
  } else if (kind === 'boolean' && typeof value === 'string' && !/^(?:true|false)$/i.test(value)) {
    addWarning(walk, path, `"${value}" is not a boolean in YAML 1.2; write true or false.`);
  }
}
