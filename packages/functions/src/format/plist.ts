import { XmlCdata, XmlElement, XmlText } from '@rgrove/parse-xml';
import type { XmlNode } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import { JsonNumberToken, parseLosslessJsonData, type LosslessJsonValue } from './jsonDocument';
import { requiredText } from './shared';
import { parseXmlDocument } from './xmlDocument';

const maxCharacters = 5_000_000;
const appleDoctype =
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">';
const appleDoctypePattern =
  /^((?:<\?xml[^>]*>)?[ \t\r\n]*)<!DOCTYPE[ \t\r\n]+plist[ \t\r\n]+PUBLIC[ \t\r\n]+"-\/\/Apple\/\/DTD PLIST 1\.0\/\/EN"[ \t\r\n]+"http:\/\/www\.apple\.com\/DTDs\/PropertyList-1\.0\.dtd"[ \t\r\n]*>/;
const nestingMessage = 'Plists are limited to 100 nested element levels and 100,000 XML nodes.';
const forbiddenCharacters =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const writerLimitMessage =
  'The plist written from this JSON is limited to 5,000,000 characters, 100 nested element levels and 100,000 XML nodes.';

export type PlistJsonValue =
  | boolean
  | number
  | string
  | JsonNumberToken
  | PlistJsonValue[]
  | { [key: string]: PlistJsonValue };

type PlistObject = { [key: string]: PlistJsonValue };

function checkCharacters(source: string, label: string): void {
  if (source.length > maxCharacters)
    throw new FunctionError('PLIST_LIMIT', `${label} input is limited to 5,000,000 characters.`);
}

function fail(source: string, node: XmlNode, message: string): never {
  const lineStart = source.lastIndexOf('\n', node.start - 1) + 1;
  const line = source.slice(0, lineStart).split('\n').length;

  throw new FunctionError(
    'INVALID_PLIST',
    `${message} at line ${line}, column ${node.start - lineStart + 1}.`,
  );
}

function doctypeError(): FunctionError {
  return new FunctionError(
    'UNSUPPORTED_PLIST_DTD',
    `Only the Apple plist DOCTYPE is allowed: ${appleDoctype}. Other DTDs and entities are never loaded.`,
  );
}

function plistXmlError(error: unknown): unknown {
  if (!(error instanceof FunctionError)) return error;
  if (error.code === 'UNSUPPORTED_XML_DTD') return doctypeError();
  // The XML helper reports a parser stack overflow without naming the limit.
  if (error.code === 'XML_LIMIT' || error.message.includes('nesting exceeds'))
    return new FunctionError('PLIST_LIMIT', nestingMessage);

  return error;
}

function parsePlistXml(input: string): { root: XmlElement | null; source: string } {
  checkCharacters(input, 'Plist');

  const source = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  requiredText(source, 'Plist');

  if (source.startsWith('bplist'))
    throw new FunctionError(
      'UNSUPPORTED_PLIST',
      'Binary plists are not supported; convert the file to XML first, for example with plutil -convert xml1.',
    );

  const blanked = source.replace(
    appleDoctypePattern,
    (match: string, prolog: string) => prolog + match.slice(prolog.length).replace(/[^\r\n]/g, ' '),
  );

  // Any other prolog DOCTYPE, such as one with an internal subset, fails before entity errors do.
  if (/^(?:<\?xml[^>]*>)?[ \t\r\n]*<!DOCTYPE/.test(blanked)) throw doctypeError();

  try {
    return { root: parseXmlDocument(blanked).root, source };
  } catch (error) {
    throw plistXmlError(error);
  }
}

function elementChildren(element: XmlElement, source: string): XmlElement[] {
  const elements: XmlElement[] = [];

  for (const node of element.children) {
    if (node instanceof XmlElement) elements.push(node);
    else if (node instanceof XmlCdata || (node instanceof XmlText && /[^ \t\r\n]/.test(node.text)))
      fail(source, node, `Text is not allowed inside <${element.name}>`);
  }

  return elements;
}

function textOf(element: XmlElement, source: string): string {
  return element.children
    .map((node: XmlNode) => {
      if (node instanceof XmlElement)
        fail(source, node, `<${element.name}> cannot contain elements`);

      return node instanceof XmlText || node instanceof XmlCdata ? node.text : '';
    })
    .join('');
}

function readInteger(text: string): PlistJsonValue | undefined {
  // plutil and plistlib also read hexadecimal integers.
  const hex = /^([+-]?)0[xX]([0-9a-fA-F]+)$/.exec(text);
  const decimal = hex ? `${hex[1]}${BigInt(`0x${hex[2]}`)}` : text;

  if (!/^[+-]?\d+$/.test(decimal)) return undefined;

  const value = Number(decimal);

  return Number.isSafeInteger(value) ? value : new JsonNumberToken(BigInt(decimal).toString());
}

function readReal(text: string): PlistJsonValue | undefined {
  const value = Number(text);

  return /^[+-]?(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(text) && Number.isFinite(value)
    ? value
    : undefined;
}

function readDate(text: string): PlistJsonValue | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(text)) return undefined;

  const time = Date.parse(text);

  // The round trip rejects dates such as February 30 that Date.parse would roll over.
  return !Number.isNaN(time) && new Date(time).toISOString() === `${text.slice(0, -1)}.000Z`
    ? text
    : undefined;
}

const scalarReaders: Record<string, (text: string) => PlistJsonValue | undefined> = {
  data: (text) => {
    const base64 = text.replace(/[ \t\r\n]/g, '');

    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
      ? base64
      : undefined;
  },
  date: readDate,
  false: (text) => (text ? undefined : false),
  integer: readInteger,
  real: readReal,
  string: (text) => text,
  true: (text) => (text ? undefined : true),
};

function readScalar(element: XmlElement, source: string): PlistJsonValue {
  const reader = Object.hasOwn(scalarReaders, element.name)
    ? scalarReaders[element.name]
    : undefined;

  if (!reader) fail(source, element, `Unknown plist element <${element.name}>`);

  const raw = textOf(element, source);
  const text = element.name === 'string' ? raw : raw.trim();

  if (element.name === 'real' && /^[+-]?(nan|inf(inity)?)$/i.test(text))
    fail(source, element, `<real> ${text} has no JSON form; NaN and infinity are not supported`);

  const value = reader(text);

  if (value === undefined)
    fail(source, element, `Invalid <${element.name}> value ${JSON.stringify(text)}`);

  return value;
}

function readDict(element: XmlElement, source: string): PlistObject {
  const children = elementChildren(element, source);
  const result: PlistObject = {};

  for (let index = 0; index < children.length; index += 2) {
    const keyElement = children[index] as XmlElement;
    const valueElement = children[index + 1];

    if (keyElement.name !== 'key')
      fail(source, keyElement, `Expected <key> in <dict>, found <${keyElement.name}>`);

    const key = textOf(keyElement, source);

    if (!valueElement || valueElement.name === 'key')
      fail(source, keyElement, `Key ${JSON.stringify(key)} has no value`);
    if (Object.hasOwn(result, key))
      fail(source, keyElement, `Duplicate key ${JSON.stringify(key)}`);

    // defineProperty keeps a key such as "__proto__" as plain data.
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: readValue(valueElement, source),
      writable: true,
    });
  }

  return result;
}

// Recursion depth is bounded by the 100-level check in parseXmlDocument.
function readValue(element: XmlElement, source: string): PlistJsonValue {
  if (element.name === 'dict') return readDict(element, source);
  if (element.name === 'array')
    return elementChildren(element, source).map((child) => readValue(child, source));

  return readScalar(element, source);
}

export function plistToJson(input: string): PlistJsonValue {
  const { root, source } = parsePlistXml(input);

  if (root?.name !== 'plist')
    throw new FunctionError('INVALID_PLIST', 'The root element must be <plist>.');

  const [value, ...rest] = elementChildren(root, source);

  if (!value || rest.length) fail(source, root, '<plist> must contain exactly one value');

  return readValue(value, source);
}

function stringifyPlistJson(value: PlistJsonValue, indent: string): string {
  if (value instanceof JsonNumberToken) return value.text;
  if (typeof value !== 'object') return JSON.stringify(value);

  const inner = `${indent}  `;
  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((entry) => stringifyPlistJson(entry, inner))
    : Object.entries(value).map(
        ([key, entry]) => `${JSON.stringify(key)}: ${stringifyPlistJson(entry, inner)}`,
      );
  const [open, close] = isArray ? ['[', ']'] : ['{', '}'];

  return entries.length
    ? `${open}\n${inner}${entries.join(`,\n${inner}`)}\n${indent}${close}`
    : `${open}${close}`;
}

export function plistDocumentToJson(input: string): string {
  return stringifyPlistJson(plistToJson(input), '');
}

function pointerOf(pointer: string): string {
  return JSON.stringify(pointer);
}

function escapeText(text: string, what: string, pointer: string): string {
  if (forbiddenCharacters.test(text))
    throw new FunctionError(
      'PLIST_CHARACTER',
      `The ${what} at JSON Pointer ${pointerOf(pointer)} contains a character that XML 1.0 forbids.`,
    );

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#13;');
}

function scalarElement(value: LosslessJsonValue, pointer: string): string {
  if (value === null)
    throw new FunctionError(
      'PLIST_NULL',
      `The value at JSON Pointer ${pointerOf(pointer)} is null; null has no plist type.`,
    );
  if (typeof value === 'boolean') return value ? '<true/>' : '<false/>';
  if (typeof value === 'string') return `<string>${escapeText(value, 'string', pointer)}</string>`;
  if (/^-?\d+$/.test((value as JsonNumberToken).text))
    return `<integer>${(value as JsonNumberToken).text}</integer>`;
  if (!Number.isFinite(Number((value as JsonNumberToken).text)))
    throw new FunctionError(
      'PLIST_REAL',
      `The number at JSON Pointer ${pointerOf(pointer)} is outside the finite range of <real>.`,
    );

  return `<real>${(value as JsonNumberToken).text}</real>`;
}

function writeValue(
  value: LosslessJsonValue,
  indent: string,
  pointer: string,
  lines: string[],
): void {
  if (!(value instanceof Map) && !Array.isArray(value)) {
    lines.push(`${indent}${scalarElement(value, pointer)}`);

    return;
  }

  const tag = value instanceof Map ? 'dict' : 'array';
  const inner = `${indent}  `;

  if (!(value instanceof Map ? value.size : value.length)) {
    lines.push(`${indent}<${tag}/>`);

    return;
  }

  lines.push(`${indent}<${tag}>`);

  for (const [key, entry] of value instanceof Map ? value : value.entries()) {
    const child = `${pointer}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

    if (typeof key === 'string') lines.push(`${inner}<key>${escapeText(key, 'key', child)}</key>`);

    writeValue(entry, inner, child, lines);
  }

  lines.push(`${indent}</${tag}>`);
}

export function jsonDocumentToPlist(source: string): string {
  checkCharacters(source, 'JSON');
  requiredText(source, 'JSON');

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', appleDoctype, '<plist version="1.0">'];

  writeValue(parseLosslessJsonData(source, { depth: 100, values: 100_000 }).value, '', '', lines);

  const output = `${[...lines, '</plist>'].join('\n')}\n`;

  try {
    plistToJson(output);
  } catch (error) {
    if (error instanceof FunctionError && error.code === 'PLIST_LIMIT')
      throw new FunctionError('PLIST_LIMIT', writerLimitMessage);

    throw error;
  }

  return output;
}
