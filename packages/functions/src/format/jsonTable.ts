import { FunctionError } from '../errors';
import { processJsonDocument, type JsonDocumentNode } from './jsonDocument';

export interface JsonTableDocument {
  columns: string[];
  markdown: string;
  rows: Array<Array<string | null>>;
}

export function tabulateJsonDocument(source: string): JsonTableDocument {
  const document = processJsonDocument(source, { collectTree: true, mode: 'minify' });
  const [root] = document.nodes;

  if (root?.type !== 'array')
    throw new FunctionError(
      'INVALID_JSON_TABLE',
      'JSON Table requires a root array of objects. Use JSON Query to extract a nested array first.',
    );

  const children = new Map<number, JsonDocumentNode[]>();

  for (const node of document.nodes) {
    if (node.parentId === null) continue;

    const siblings = children.get(node.parentId) ?? [];

    siblings.push(node);
    children.set(node.parentId, siblings);
  }

  const records = children.get(root.id) ?? [];

  if (records.length > 2_000)
    throw new FunctionError('JSON_TABLE_LIMIT', 'JSON Table supports up to 2,000 rows.');

  const columnSet = new Set<string>();
  const values = records.map((record, index) =>
    readTableRow({ children, columnSet, index, record, source }),
  );
  const columns = [...columnSet];

  if (records.length * columns.length > 100_000)
    throw new FunctionError('JSON_TABLE_LIMIT', 'JSON Table supports up to 100,000 cells.');

  const rows = values.map((row) => columns.map((column) => row.get(column) ?? null));

  return { columns, markdown: markdownTable(columns, rows), rows };
}

function readTableRow(context: {
  children: Map<number, JsonDocumentNode[]>;
  columnSet: Set<string>;
  index: number;
  record: JsonDocumentNode;
  source: string;
}): Map<string, string> {
  const { children, columnSet, index, record, source } = context;

  if (record.type !== 'object')
    throw new FunctionError(
      'INVALID_JSON_TABLE',
      `Row ${index + 1} must be an object, not ${record.type}.`,
    );

  const row = new Map<string, string>();

  for (const member of children.get(record.id) ?? []) {
    const key: string = JSON.parse(member.label);

    if (row.has(key))
      throw new FunctionError(
        'AMBIGUOUS_JSON_TABLE',
        `Row ${index + 1} has duplicate key ${JSON.stringify(key)}. Remove duplicates before making a table.`,
      );

    if (!columnSet.has(key)) {
      columnSet.add(key);
      if (columnSet.size > 100)
        throw new FunctionError(
          'JSON_TABLE_LIMIT',
          'JSON Table supports up to 100 distinct columns.',
        );
    }

    const token = source.slice(member.start, member.end);

    row.set(
      key,
      member.type === 'array' || member.type === 'object'
        ? processJsonDocument(token, { mode: 'minify' }).text
        : token,
    );
  }

  return row;
}

function markdownTable(columns: string[], rows: Array<Array<string | null>>): string {
  const lines = [
    `| # |${columns.map((column) => ` ${markdownCell(JSON.stringify(column))} |`).join('')}`,
    `| --- |${columns.map(() => ' --- |').join('')}`,
  ];
  let characters = lines.join('\n').length;

  for (const [index, row] of rows.entries()) {
    const line = `| ${index + 1} |${row.map((cell) => ` ${cell === null ? 'Missing' : markdownCell(cell)} |`).join('')}`;

    characters += line.length + 1;
    if (characters > 8_000_000)
      throw new FunctionError(
        'JSON_TABLE_LIMIT',
        'JSON Table Markdown export is limited to 8,000,000 characters.',
      );

    lines.push(line);
  }

  return lines.join('\n');
}

export function markdownCell(text: string): string {
  return text
    .replace(/[&<>|\\`*_\[\]{}]/g, (character) => `&#${character.charCodeAt(0)};`)
    .replace(/\r\n|\r|\n/g, '<br>');
}
