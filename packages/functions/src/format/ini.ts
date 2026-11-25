import { FunctionError } from '../errors';
import type { JsonValue } from './json';
import { JsonNumberToken, parseLosslessJsonData, type LosslessJsonValue } from './jsonDocument';
import { requiredText } from './shared';

const maxCharacters = 5_000_000;
const maxLines = 100_000;
const integerPattern = /^-?(?:0|[1-9]\d*)$/;
const decimalPattern = /^-?(?:0|[1-9]\d*)\.\d+$/;
const quotedKeyPattern = /^("(?:[^"\\]|\\.)*")\s*=(.*)$/;

type IniObject = { [key: string]: JsonValue };

function failAt(line: number, message: string): never {
  throw new FunctionError('INVALID_INI', `${message} at line ${line}.`);
}

function checkLimits(source: string): void {
  if (source.length > maxCharacters)
    throw new FunctionError('INI_LIMIT', 'INI input is limited to 5,000,000 characters.');
}

function checkLineCount(count: number): void {
  if (count > maxLines)
    throw new FunctionError('INI_LIMIT', 'INI input is limited to 100,000 lines.');
}

// defineProperty keeps a key such as "__proto__" as plain data.
function setEntry(target: IniObject, key: string, value: JsonValue): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function isSection(value: JsonValue | undefined): value is IniObject {
  return typeof value === 'object' && value !== null;
}

function unquote(text: string): string {
  if (text.length < 2 || !text.startsWith('"') || !text.endsWith('"')) return text;

  try {
    const parsed: unknown = JSON.parse(text);

    return typeof parsed === 'string' ? parsed : text;
  } catch {
    return text;
  }
}

// Only plain spellings are typed, so 0012, 1e5, .5 and integers beyond the safe range stay text.
function typedValue(text: string): JsonValue {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (integerPattern.test(text))
    return Number.isSafeInteger(Number(text)) && String(Number(text)) === text
      ? Number(text)
      : text;
  if (decimalPattern.test(text) && Number.isFinite(Number(text))) return Number(text);

  return text;
}

function openSection(root: IniObject, header: string, line: number): IniObject {
  const names = header.split('.').map((name) => name.trim());

  if (names.some((name) => !name)) failAt(line, `Invalid section name "${header}"`);
  if (names.length > 100) failAt(line, 'Section nesting is limited to 100 levels');

  let target = root;

  for (const name of names) {
    const existing = Object.hasOwn(target, name) ? target[name] : undefined;

    if (existing === undefined) {
      const created: IniObject = {};

      setEntry(target, name, created);
      target = created;
    } else if (isSection(existing)) target = existing;
    else failAt(line, `Section "${header}" conflicts with the key "${name}"`);
  }

  return target;
}

function splitKeyValue(text: string): [string, string] | undefined {
  const quoted = quotedKeyPattern.exec(text);

  if (quoted) {
    try {
      return [JSON.parse(quoted[1] ?? '""') as string, (quoted[2] ?? '').trim()];
    } catch {
      return undefined;
    }
  }

  const index = text.indexOf('=');

  const key = text.slice(0, index).trim();

  return index < 0 || !key ? undefined : [key, text.slice(index + 1).trim()];
}

function addKey(
  target: IniObject,
  section: string,
  text: string,
  line: number,
  typed: boolean,
): void {
  const pair = splitKeyValue(text);

  if (!pair) failAt(line, 'Expected a key=value pair or a [section] header');

  const [key, raw] = pair;

  if (Object.hasOwn(target, key)) {
    const place = section ? `in section "${section}"` : 'at the top level';

    failAt(
      line,
      isSection(target[key])
        ? `Key "${key}" ${place} conflicts with a subsection of the same name`
        : `Duplicate key "${key}" ${place}`,
    );
  }

  const unquoted = unquote(raw);

  setEntry(target, key, typed && unquoted === raw ? typedValue(raw) : unquoted);
}

export function iniToJson(input: string, options: { typed: boolean }): JsonValue {
  checkLimits(input);

  const source = input.replace(/^\uFEFF/, '');

  requiredText(source, 'INI');

  const lines = source.split(/\r\n|\r|\n/);

  if (lines.at(-1) === '') lines.pop();

  checkLineCount(lines.length);

  const root: IniObject = {};
  let section = '';
  let target = root;

  lines.forEach((raw, index) => {
    const text = raw.trim();
    const line = index + 1;

    if (!text || text.startsWith(';') || text.startsWith('#')) return;

    if (text.startsWith('[')) {
      if (!text.endsWith(']')) failAt(line, `Invalid section header "${text}", expected "[name]"`);

      section = text.slice(1, -1).trim();
      target = openSection(root, section, line);
    } else addKey(target, section, text, line, options.typed);
  });

  return root;
}

const needsQuotes = /^\s|\s$|^"|[\u0000-\u0008\u000b-\u001f\u007f]/;
const keyNeedsQuotes = /^$|^\s|\s$|^[;#["]|=|[\u0000-\u0008\u000b-\u001f\u007f]/;

function typedLooking(text: string): boolean {
  return (
    text === 'true' || text === 'false' || integerPattern.test(text) || decimalPattern.test(text)
  );
}

function iniKey(key: string): string {
  if (/[\r\n]/.test(key))
    throw new FunctionError(
      'INI_NEWLINE',
      `Key ${JSON.stringify(key)} contains a newline, which INI cannot hold.`,
    );

  return keyNeedsQuotes.test(key) ? JSON.stringify(key) : key;
}

function iniValue(key: string, value: LosslessJsonValue): string {
  if (value === null)
    throw new FunctionError(
      'INI_NULL',
      `Key ${JSON.stringify(key)} is null, which INI cannot represent.`,
    );
  if (Array.isArray(value))
    throw new FunctionError(
      'INI_ARRAY',
      `Arrays cannot be written as INI (key ${JSON.stringify(key)}).`,
    );
  if (value instanceof Map)
    throw new FunctionError(
      'INI_DEPTH',
      `INI supports two object levels, but key ${JSON.stringify(key)} nests deeper.`,
    );
  if (value instanceof JsonNumberToken) return value.text;
  if (typeof value === 'boolean') return String(value);
  if (/[\r\n]/.test(value))
    throw new FunctionError(
      'INI_NEWLINE',
      `Key ${JSON.stringify(key)} has a value with a newline, which INI cannot hold.`,
    );

  return needsQuotes.test(value) || typedLooking(value) ? JSON.stringify(value) : value;
}

function iniSectionName(name: string): string {
  if (!name || name !== name.trim() || /[.\r\n]/.test(name))
    throw new FunctionError(
      'INI_SECTION_NAME',
      `Section name ${JSON.stringify(name)} cannot be written: it is empty, padded, multi-line or contains a dot.`,
    );

  return `[${name}]`;
}

export function jsonDocumentToIni(source: string): string {
  if (source.length > maxCharacters)
    throw new FunctionError('INI_LIMIT', 'JSON input is limited to 5,000,000 characters.');

  requiredText(source, 'JSON');

  const root = parseLosslessJsonData(source).value;

  if (Array.isArray(root))
    throw new FunctionError('INI_ARRAY', 'Arrays cannot be written as INI; use a root object.');
  if (!(root instanceof Map))
    throw new FunctionError('INI_ROOT', 'JSON to INI requires a root object.');

  const lines: string[] = [];
  const sections = [...root].filter(([, value]) => value instanceof Map);

  for (const [key, value] of root) {
    if (!(value instanceof Map)) lines.push(`${iniKey(key)}=${iniValue(key, value)}`);
  }

  for (const [name, section] of sections) {
    if (!(section instanceof Map)) continue;
    if (lines.length) lines.push('');

    lines.push(iniSectionName(name));

    for (const [key, value] of section)
      lines.push(`${iniKey(key)}=${iniValue(`${name}.${key}`, value)}`);
  }

  if (lines.length > maxLines)
    throw new FunctionError('INI_LIMIT', 'INI output is limited to 100,000 lines.');

  return lines.length ? `${lines.join('\n')}\n` : '; Empty JSON object\n';
}
