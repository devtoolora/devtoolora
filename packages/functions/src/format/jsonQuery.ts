import { FunctionError } from '../errors';
import { processJsonDocument, type JsonDocumentNode } from './jsonDocument';

export interface JsonQueryResult {
  pointer: string;
  text: string;
  type: JsonDocumentNode['type'];
}

type PathCursor = { input: string; offset: number };

function invalidPath(cursor: PathCursor): never {
  throw new FunctionError(
    'INVALID_JSON_PATH',
    `Invalid simple path at offset ${cursor.offset}. Use names, numeric indexes or quoted bracket keys; wildcards and expressions are not supported.`,
  );
}

function readPathName(cursor: PathCursor): string {
  const match = /^(?:[A-Za-z_$][A-Za-z0-9_$]*|0|[1-9][0-9]*)/.exec(
    cursor.input.slice(cursor.offset),
  );

  if (!match) invalidPath(cursor);

  cursor.offset += match[0].length;

  return match[0];
}

function readQuotedKey(cursor: PathCursor, quote: string): string {
  const { input } = cursor;
  let token = '"';
  let closed = false;

  while (cursor.offset < input.length) {
    const character = input[cursor.offset++];

    if (character === quote) {
      closed = true;

      break;
    }

    if (character === '\\') {
      const escaped = input[cursor.offset++];

      if (escaped === undefined) invalidPath(cursor);

      token += quote === "'" && escaped === "'" ? "'" : `\\${escaped}`;
    } else token += character === '"' ? '\\"' : character;
  }

  if (!closed) invalidPath(cursor);

  try {
    const decoded: string = JSON.parse(`${token}"`);

    return decoded;
  } catch {
    return invalidPath(cursor);
  }
}

function readBracketSegment(cursor: PathCursor): string {
  const quote = cursor.input[cursor.offset];
  let segment: string;

  if (quote === '"' || quote === "'") {
    cursor.offset += 1;
    segment = readQuotedKey(cursor, quote);
  } else {
    const index = /^(?:0|[1-9][0-9]*)/.exec(cursor.input.slice(cursor.offset));

    if (!index) invalidPath(cursor);

    segment = index[0];
    cursor.offset += index[0].length;
  }

  if (cursor.input[cursor.offset] !== ']') invalidPath(cursor);

  cursor.offset += 1;

  return segment;
}

function pathSegments(path: string): string[] {
  const input = path.trim();

  if (!input)
    throw new FunctionError(
      'REQUIRED_JSON_PATH',
      'A simple JSON path is required; use $ for the root.',
    );

  const cursor: PathCursor = { input, offset: input.startsWith('$') ? 1 : 0 };
  const segments: string[] = [];

  if (cursor.offset === 0 && input[0] !== '[') segments.push(readPathName(cursor));

  while (cursor.offset < input.length) {
    if (input[cursor.offset] === '.') {
      cursor.offset += 1;
      segments.push(readPathName(cursor));
    } else if (input[cursor.offset] === '[') {
      cursor.offset += 1;
      segments.push(readBracketSegment(cursor));
    } else invalidPath(cursor);
  }

  return segments;
}

function pointerSegments(pointer: string): string[] {
  if (pointer !== '' && !pointer.startsWith('/'))
    throw new FunctionError(
      'INVALID_JSON_POINTER',
      'JSON Pointer must be empty for the root or start with /. URI fragments beginning with # are not supported.',
    );
  if (/~(?:[^01]|$)/.test(pointer))
    throw new FunctionError(
      'INVALID_JSON_POINTER',
      'JSON Pointer only allows ~0 for a tilde and ~1 for a slash.',
    );

  return pointer === ''
    ? []
    : pointer
        .slice(1)
        .split('/')
        .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function matchingChildren(
  current: JsonDocumentNode,
  segment: string,
  children: Map<number, JsonDocumentNode[]>,
): JsonDocumentNode[] {
  if (current.type === 'object')
    return (children.get(current.id) ?? []).filter(
      (node) => node.label === JSON.stringify(segment),
    );
  if (current.type !== 'array') return [];

  if (!/^(?:0|[1-9][0-9]*)$/.test(segment))
    throw new FunctionError(
      'INVALID_JSON_INDEX',
      `Array index ${JSON.stringify(segment)} must be a nonnegative integer without leading zeros.`,
    );

  const index = Number(segment);

  if (!Number.isSafeInteger(index)) return [];

  const child = (children.get(current.id) ?? [])[index];

  return child ? [child] : [];
}

export function queryJsonDocument(
  source: string,
  requestedPath: string,
  syntax: 'path' | 'pointer' = 'path',
): JsonQueryResult {
  if (syntax !== 'path' && syntax !== 'pointer')
    throw new FunctionError('INVALID_JSON_PATH', 'Choose Simple path or JSON Pointer syntax.');
  if (requestedPath.length > 16_384)
    throw new FunctionError('JSON_QUERY_LIMIT', 'The query is limited to 16,384 characters.');

  const segments =
    syntax === 'pointer' ? pointerSegments(requestedPath) : pathSegments(requestedPath);
  const document = processJsonDocument(source, { collectTree: true, mode: 'minify' });
  const [root] = document.nodes;

  if (!root) throw new FunctionError('INVALID_JSON', 'JSON input has no value.');

  let current = root;

  const children = new Map<number, JsonDocumentNode[]>();

  for (const node of document.nodes) {
    if (node.parentId === null) continue;

    const siblings = children.get(node.parentId) ?? [];

    siblings.push(node);
    children.set(node.parentId, siblings);
  }

  for (const segment of segments) {
    const matches = matchingChildren(current, segment, children);
    const [match] = matches;

    if (matches.length > 1)
      throw new FunctionError(
        'AMBIGUOUS_JSON_PATH',
        `Duplicate key ${JSON.stringify(segment)} makes this query ambiguous. Use JSON Validate to locate duplicates.`,
      );
    if (!match)
      throw new FunctionError(
        'JSON_PATH_NOT_FOUND',
        `No value exists at segment ${JSON.stringify(segment)} below pointer ${JSON.stringify(current.pointer)}.`,
      );

    current = match;
  }

  return {
    pointer: current.pointer,
    text: processJsonDocument(source.slice(current.start, current.end)).text,
    type: current.type,
  };
}
