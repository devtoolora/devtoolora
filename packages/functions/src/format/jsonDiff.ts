import { FunctionError } from '../errors';
import {
  processJsonDocument,
  type JsonDocumentNode,
  type JsonDocumentOptions,
  type JsonDocumentResult,
} from './jsonDocument';

export interface JsonDiffChange {
  after?: string;
  before?: string;
  kind: 'added' | 'changed' | 'removed';
  pointer: string;
}

export interface JsonDiffReport {
  added: number;
  changed: number;
  changes: JsonDiffChange[];
  equal: boolean;
  numberComparison: 'value' | 'token';
  removed: number;
}

function comparableScalar(node: JsonDocumentNode, numberComparison: 'value' | 'token'): string {
  if (node.type === 'string') return JSON.parse(node.token);
  if (node.type === 'number' && numberComparison === 'value') return canonicalNumber(node.token);

  return node.token;
}

export function canonicalNumber(token: string): string {
  const [coefficient = '', exponent = '0'] = token.toLowerCase().split('e');

  if (exponent.replace(/^[+-]/, '').length > 1_000)
    throw new FunctionError(
      'JSON_DIFF_LIMIT',
      'Numeric exponents are limited to 1,000 digits in value-comparison mode.',
    );

  const negative = coefficient.startsWith('-');
  const [integer, fraction = ''] = coefficient.replace(/^-/, '').split('.');
  let digits = (integer + fraction).replace(/^0+/, '');

  if (!digits) return '0';

  const trailing = digits.match(/(?<!0)0+$/)?.[0].length ?? 0;

  if (trailing) digits = digits.slice(0, -trailing);

  const power = BigInt(exponent) - BigInt(fraction.length) + BigInt(trailing);

  return `${negative ? '-' : ''}${digits}e${power}`;
}

function parseSide(
  source: string,
  side: string,
  limits: JsonDocumentOptions['limits'],
): JsonDocumentResult {
  try {
    const document = processJsonDocument(source, { collectTree: true, limits, mode: 'minify' });

    if (document.report.duplicateKeys)
      throw new FunctionError(
        'AMBIGUOUS_JSON_DIFF',
        'Duplicate object keys make structural comparison ambiguous. Use JSON Validate to locate them.',
      );

    return document;
  } catch (error) {
    if (error instanceof FunctionError)
      throw new FunctionError(error.code, `${side} JSON: ${error.message}`);

    throw error;
  }
}

export function compareJsonDocuments(
  left: string,
  right: string,
  numberComparison: 'value' | 'token' = 'value',
  limits?: JsonDocumentOptions['limits'],
  sides: readonly [string, string] = ['Left', 'Right'],
): JsonDiffReport {
  if (numberComparison !== 'value' && numberComparison !== 'token')
    throw new FunctionError(
      'INVALID_JSON_DIFF_OPTIONS',
      'Choose numeric value or exact number token comparison.',
    );

  const before = parseSide(left, sides[0], limits);
  const after = parseSide(right, sides[1], limits);
  const context: DiffContext = {
    changes: [],
    children: new Map(),
    numberComparison,
    reportCharacters: 0,
  };

  for (const document of [before, after]) {
    for (const node of document.nodes) {
      if (node.parentId === null) continue;

      const parent = document.nodes[node.parentId];

      if (!parent) continue;

      const siblings = context.children.get(parent) ?? [];

      siblings.push(node);
      context.children.set(parent, siblings);
    }
  }

  const [beforeRoot] = before.nodes;
  const [afterRoot] = after.nodes;

  if (!beforeRoot || !afterRoot)
    throw new FunctionError('INVALID_JSON', 'JSON input has no value.');

  walkNodes(context, beforeRoot, afterRoot);

  const { changes } = context;

  return {
    added: changes.filter((entry) => entry.kind === 'added').length,
    changed: changes.filter((entry) => entry.kind === 'changed').length,
    changes,
    equal: changes.length === 0,
    numberComparison,
    removed: changes.filter((entry) => entry.kind === 'removed').length,
  };
}

type DiffContext = {
  changes: JsonDiffChange[];
  children: Map<JsonDocumentNode, JsonDocumentNode[]>;
  numberComparison: 'value' | 'token';
  reportCharacters: number;
};

function serializeNode(context: DiffContext, node: JsonDocumentNode): string {
  const children = context.children.get(node) ?? [];

  if (node.type === 'array')
    return `[${children.map((child) => serializeNode(context, child)).join(',')}]`;
  if (node.type === 'object')
    return `{${children.map((child) => `${child.label}:${serializeNode(context, child)}`).join(',')}}`;

  return node.token;
}

function recordChange(
  context: DiffContext,
  kind: JsonDiffChange['kind'],
  oldNode?: JsonDocumentNode,
  newNode?: JsonDocumentNode,
): void {
  const pointer = newNode?.pointer ?? oldNode?.pointer ?? '';
  const oldText = oldNode ? serializeNode(context, oldNode) : undefined;
  const newText = newNode ? serializeNode(context, newNode) : undefined;

  context.reportCharacters += pointer.length + (oldText?.length ?? 0) + (newText?.length ?? 0);
  if (context.reportCharacters > 8_000_000)
    throw new FunctionError(
      'JSON_DIFF_LIMIT',
      'JSON diff report is limited to 8,000,000 value/path characters.',
    );

  context.changes.push({
    ...(newText !== undefined ? { after: newText } : {}),
    ...(oldText !== undefined ? { before: oldText } : {}),
    kind,
    pointer,
  });
}

function walkNodes(context: DiffContext, oldNode: JsonDocumentNode, newNode: JsonDocumentNode) {
  if (oldNode.type !== newNode.type) recordChange(context, 'changed', oldNode, newNode);
  else if (oldNode.type === 'object') walkObjects(context, oldNode, newNode);
  else if (oldNode.type === 'array') walkArrays(context, oldNode, newNode);
  else if (
    comparableScalar(oldNode, context.numberComparison) !==
    comparableScalar(newNode, context.numberComparison)
  )
    recordChange(context, 'changed', oldNode, newNode);
}

function walkObjects(context: DiffContext, oldNode: JsonDocumentNode, newNode: JsonDocumentNode) {
  const byLabel = (node: JsonDocumentNode) =>
    new Map((context.children.get(node) ?? []).map((child) => [child.label, child]));
  const oldChildren = byLabel(oldNode);
  const newChildren = byLabel(newNode);

  for (const key of [...new Set([...oldChildren.keys(), ...newChildren.keys()])].sort()) {
    const oldChild = oldChildren.get(key);
    const newChild = newChildren.get(key);

    if (!oldChild && newChild) recordChange(context, 'added', undefined, newChild);
    else if (oldChild && !newChild) recordChange(context, 'removed', oldChild);
    else if (oldChild && newChild) walkNodes(context, oldChild, newChild);
  }
}

function walkArrays(context: DiffContext, oldNode: JsonDocumentNode, newNode: JsonDocumentNode) {
  const oldChildren = context.children.get(oldNode) ?? [];
  const newChildren = context.children.get(newNode) ?? [];

  for (let index = 0; index < Math.max(oldChildren.length, newChildren.length); index += 1) {
    const oldChild = oldChildren[index];
    const newChild = newChildren[index];

    if (!oldChild) recordChange(context, 'added', undefined, newChild);
    else if (!newChild) recordChange(context, 'removed', oldChild);
    else walkNodes(context, oldChild, newChild);
  }
}
