import {
  parseXml,
  XmlCdata,
  XmlComment,
  XmlDeclaration,
  XmlElement,
  XmlProcessingInstruction,
  XmlText,
} from '@rgrove/parse-xml';
import type { XmlNode } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import type { JsonValue } from './json';
import { JsonNumberToken, parseLosslessJsonData, type LosslessJsonValue } from './jsonDocument';
import { parseXmlDocument, xmlMaxLength } from './xmlDocument';

export interface XmlJsonOptions {
  preserveOrder?: boolean;
}

type MappedJson =
  null | boolean | number | string | JsonNumberToken | MappedJson[] | { [key: string]: MappedJson };

interface JsonState {
  ancestors: WeakSet<object>;
  characters: number;
  nodes: number;
}

export function xmlToJson(text: string, options: XmlJsonOptions = {}): JsonValue {
  const document = parseXmlDocument(text);
  const [root] = document.children;

  if (options.preserveOrder || !root || document.children.length !== 1) {
    return {
      '#document': document.children.map((node: XmlNode) =>
        nodeToJson(node, options.preserveOrder ?? false),
      ),
    };
  }

  return nodeToJson(root, false);
}

export function jsonDocumentToXml(source: string, root = 'root'): string {
  return writeXml(mappedJson(parseLosslessJsonData(source).value), root);
}

function mappedJson(value: LosslessJsonValue): MappedJson {
  if (value instanceof Map)
    return Object.fromEntries([...value].map(([key, entry]) => [key, mappedJson(entry)]));

  return Array.isArray(value) ? value.map(mappedJson) : value;
}

function writeXml(value: MappedJson, root: string): string {
  validateJson(value, 0, { ancestors: new WeakSet(), characters: 0, nodes: 0 });
  const names = new Set<string>();
  const entries = isRecord(value) ? Object.entries(value) : [];
  const [single] = entries;
  let output: string;

  if (isRecord(value) && Object.hasOwn(value, '#document')) {
    if (Object.keys(value).length !== 1 || !Array.isArray(value['#document']))
      throw mappingError('#document must be the only top-level key and contain an array.');

    output = value['#document'].map((node: MappedJson) => jsonNode(node, names)).join('');
  } else if (
    single &&
    entries.length === 1 &&
    !single[0].startsWith('#') &&
    !single[0].startsWith('@')
  ) {
    output = jsonElement(single[0], single[1], names);
  } else {
    output = jsonElement(root, value, names);
  }

  parseXmlDocument(output);

  return output;
}

function nodeToJson(node: XmlNode, preserveOrder: boolean): JsonValue {
  if (node instanceof XmlElement) return { [node.name]: elementToJson(node, preserveOrder) };
  if (node instanceof XmlCdata) return { '#cdata': node.text };
  if (node instanceof XmlText) return node.text;
  if (node instanceof XmlComment) return { '#comment': node.content };
  if (node instanceof XmlProcessingInstruction)
    return { '#instruction': { content: node.content, name: node.name } };

  if (node instanceof XmlDeclaration) {
    const declaration: Record<string, JsonValue> = { version: node.version };

    if (node.encoding) declaration.encoding = node.encoding;
    if (node.standalone) declaration.standalone = node.standalone;

    return { '#declaration': declaration };
  }

  throw mappingError('Unsupported XML node type.');
}

function elementToJson(element: XmlElement, preserveOrder: boolean): JsonValue {
  const attributes = Object.fromEntries(Object.entries(element.attributes));
  const hasAttributes = Object.keys(attributes).length > 0;
  const children = element.children;
  const elements = children.filter((node: XmlNode) => node instanceof XmlElement);
  const hasSpecialContent = children.some(
    (node: XmlNode) =>
      node instanceof XmlCdata || (!(node instanceof XmlText) && !(node instanceof XmlElement)),
  );
  const hasMixedText =
    elements.length > 0 &&
    children.some(
      (node: XmlNode) =>
        node instanceof XmlText &&
        (element.preserveWhitespace || !/^[\x20\t\r\n]*$/.test(node.text)),
    );

  if (preserveOrder || hasSpecialContent || hasMixedText) {
    return {
      ...(hasAttributes ? { '@attributes': attributes } : {}),
      '#content': children.map((node: XmlNode) => nodeToJson(node, preserveOrder)),
    };
  }

  if (elements.length === 0) {
    const text = children
      .map((node: XmlNode) => (node instanceof XmlText ? node.text : ''))
      .join('');

    return hasAttributes ? { '@attributes': attributes, '#text': text } : text;
  }

  const grouped = new Map<string, JsonValue[]>();

  for (const child of elements) {
    const entries = grouped.get(child.name) ?? [];

    entries.push(elementToJson(child, false));
    grouped.set(child.name, entries);
  }

  return Object.fromEntries([
    ...(hasAttributes ? [['@attributes', attributes]] : []),
    ...[...grouped].map(([name, entries]: [string, JsonValue[]]) => [
      name,
      entries.length === 1 ? entries[0] : entries,
    ]),
  ]);
}

function jsonElement(name: string, content: MappedJson, names: Set<string>): string {
  validateName(name, names);
  let attributes = '';
  let body: string;

  if (Array.isArray(content)) {
    body = content.map((entry: MappedJson) => jsonElement('item', entry, names)).join('');
  } else if (isRecord(content)) {
    const attributeValues = content['@attributes'];

    if (attributeValues !== undefined) {
      if (!isRecord(attributeValues))
        throw mappingError('@attributes must be an object of scalar values.');

      attributes = Object.entries(attributeValues)
        .map(([key, entry]: [string, MappedJson]) => {
          validateName(key, names);

          return ` ${key}="${escapeAttribute(scalar(entry))}"`;
        })
        .join('');
    }

    const children = Object.entries(content).filter(
      ([key]: [string, MappedJson]) => key !== '@attributes',
    );

    if (Object.hasOwn(content, '#content')) {
      if (children.length !== 1 || !Array.isArray(content['#content']))
        throw mappingError(
          '#content must be an array and cannot be combined with #text or named children.',
        );

      body = content['#content'].map((node: MappedJson) => jsonNode(node, names)).join('');
    } else if (Object.hasOwn(content, '#text')) {
      const [textEntry] = children;

      if (!textEntry || children.length !== 1)
        throw mappingError('Use #content to specify the order of text and child elements.');

      body = escapeText(scalar(textEntry[1]));
    } else {
      body = children
        .map(([key, entry]: [string, MappedJson]) => {
          if (key.startsWith('#') || key.startsWith('@'))
            throw mappingError(`Unknown XML mapping key: ${key}.`);
          if (Array.isArray(entry) && entry.length > 0)
            return entry.map((child: MappedJson) => jsonElement(key, child, names)).join('');

          return jsonElement(key, entry, names);
        })
        .join('');
    }
  } else {
    body = escapeText(scalar(content));
  }

  return body ? `<${name}${attributes}>${body}</${name}>` : `<${name}${attributes}/>`;
}

function jsonNode(node: MappedJson, names: Set<string>): string {
  if (typeof node === 'string') return escapeText(node);

  const entries = isRecord(node) ? Object.entries(node) : [];
  const [entry] = entries;

  if (!entry || entries.length !== 1)
    throw mappingError(
      'Each #content or #document node must be text or an object with one node key.',
    );

  const [key, content] = entry;

  if (key === '#comment') {
    const text = requiredString(content, '#comment');

    if (text.includes('--') || text.endsWith('-'))
      throw mappingError('XML comments cannot contain -- or end with a hyphen.');

    return `<!--${text}-->`;
  }

  if (key === '#cdata')
    return `<![CDATA[${requiredString(content, '#cdata').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;

  if (key === '#instruction') {
    if (
      !isRecord(content) ||
      Object.keys(content).some((name: string) => name !== 'name' && name !== 'content')
    )
      throw mappingError('#instruction requires name and optional content strings.');

    const name = requiredString(content.name, '#instruction.name');

    validateName(name, names);
    const body =
      content.content === undefined ? '' : requiredString(content.content, '#instruction.content');

    if (body.includes('?>'))
      throw mappingError('Processing instruction content cannot contain ?>.');

    return `<?${name}${body ? ` ${body}` : ''}?>`;
  }

  if (key === '#declaration') {
    if (
      !isRecord(content) ||
      Object.keys(content).some(
        (name: string) => !['version', 'encoding', 'standalone'].includes(name),
      )
    )
      throw mappingError('#declaration requires version and optional encoding/standalone strings.');

    const version = requiredString(content.version, '#declaration.version');
    const encoding =
      content.encoding === undefined
        ? ''
        : ` encoding="${escapeAttribute(requiredString(content.encoding, '#declaration.encoding'))}"`;
    const standalone =
      content.standalone === undefined
        ? ''
        : ` standalone="${escapeAttribute(requiredString(content.standalone, '#declaration.standalone'))}"`;

    return `<?xml version="${escapeAttribute(version)}"${encoding}${standalone}?>`;
  }

  if (key.startsWith('#') || key.startsWith('@'))
    throw mappingError(`Unknown XML node key: ${key}.`);

  return jsonElement(key, content, names);
}

function validateName(name: string, names: Set<string>): void {
  if (names.has(name)) return;

  try {
    const root = parseXml(`<${name}/>`).root;

    if (root?.name !== name || Object.keys(root.attributes).length !== 0)
      throw new Error('Invalid name');
  } catch {
    throw new FunctionError(
      'INVALID_XML_NAME',
      `Not a valid XML element or attribute name: ${JSON.stringify(name)}.`,
    );
  }

  names.add(name);
}

function validateJson(value: MappedJson, depth: number, state: JsonState): void {
  state.nodes += 1;
  if (depth > 600 || state.nodes > 100_000)
    throw new FunctionError(
      'XML_LIMIT',
      'The JSON mapping exceeds the supported nesting or 100,000-value limit.',
    );
  if (typeof value === 'string') state.characters += value.length;
  if (state.characters > xmlMaxLength)
    throw new FunctionError('XML_LIMIT', 'XML input is limited to 5,000,000 characters.');

  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
  ) {
    throw mappingError(
      'Use finite JSON numbers and quote integers outside ±9,007,199,254,740,991 to retain their digits.',
    );
  }

  if (value === null || typeof value !== 'object' || value instanceof JsonNumberToken) return;
  if (state.ancestors.has(value))
    throw mappingError('Cyclic JSON values cannot be converted to XML.');

  state.ancestors.add(value);

  for (const [key, child] of Object.entries(value)) {
    state.characters += key.length;
    validateJson(child, depth + 1, state);
  }

  state.ancestors.delete(value);
}

function scalar(value: MappedJson): string {
  if (value instanceof JsonNumberToken) return value.text;
  if (value !== null && typeof value === 'object')
    throw mappingError('XML text and attributes require scalar values, not objects or arrays.');

  return value === null ? '' : String(value);
}

function isRecord(value: MappedJson | undefined): value is { [key: string]: MappedJson } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof JsonNumberToken)
  );
}

function requiredString(value: MappedJson | undefined, name: string): string {
  if (typeof value !== 'string') throw mappingError(`${name} must be a string.`);

  return value;
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#13;');
}

function escapeAttribute(text: string): string {
  return escapeText(text).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

function mappingError(message: string): FunctionError {
  return new FunctionError('INVALID_XML_MAPPING', message);
}
