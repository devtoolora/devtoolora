import type { JsonValue } from '../format';
import { schemaError } from './jsonSchemaShared';
import { ignoredComments } from './schemaToCode';
import type { CompiledSchema, SchemaNode } from './schemaToCode';
import { typeInferenceLimits } from './typeInference';

type RenderOptions = { declaration?: 'interface' | 'type'; exported?: boolean; readonly?: boolean };

export const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const typeScriptReservedNames: ReadonlySet<string> = new Set([
  'Array',
  'Boolean',
  'Date',
  'Error',
  'Function',
  'Map',
  'Number',
  'Object',
  'Omit',
  'Partial',
  'Pick',
  'Promise',
  'Readonly',
  'Record',
  'Set',
  'String',
  'Symbol',
  'Uint8Array',
]);

export function renderSchemaTypeScript(compiled: CompiledSchema, options: RenderOptions): string {
  const readonly = options.readonly ?? false;
  const prefix = options.exported === false ? '' : 'export ';
  const blocks = compiled.declarations.map(({ name, node }) => {
    const comment = docComment(node.description, '');
    const asInterface =
      options.declaration !== 'type' &&
      node.kind === 'object' &&
      typeof node.additional === 'boolean' &&
      node.properties.length > 0;
    const body = asInterface
      ? `${prefix}interface ${name} ${renderBody(node, 0, readonly)}`
      : `${prefix}type ${name} = ${renderNode(node, 0, readonly)};`;

    return `${comment}${body}`;
  });

  const ignored = ignoredComments(compiled);

  if (ignored.length > 0) blocks.push(ignored.join('\n'));

  const output = blocks.join('\n\n');

  if (output.length > typeInferenceLimits.outputCharacters)
    throw schemaError(
      `Generated code exceeds ${typeInferenceLimits.outputCharacters.toLocaleString('en-US')} characters.`,
    );

  return output;
}

function docComment(description: string | undefined, indent: string): string {
  if (description === undefined) return '';

  const text = description.replace(/\s+/g, ' ').trim().replace(/\*\//g, '* /');

  return text ? `${indent}/** ${text} */\n` : '';
}

function renderBody(
  node: Extract<SchemaNode, { kind: 'object' }>,
  level: number,
  readonly: boolean,
): string {
  const indent = '  '.repeat(level + 1);
  const lines = node.properties.map(({ name, node: child, optional }) => {
    const key = identifier.test(name) ? name : quote(name);

    return `${docComment(child.description, indent)}${indent}${readonly ? 'readonly ' : ''}${key}${optional ? '?' : ''}: ${renderNode(child, level + 1, readonly)};`;
  });

  return `{\n${lines.join('\n')}\n${'  '.repeat(level)}}`;
}

export function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

function literal(value: JsonValue): string {
  return typeof value === 'string' ? quote(value) : JSON.stringify(value);
}

function renderNode(node: SchemaNode, level: number, readonly: boolean): string {
  switch (node.kind) {
    case 'primitive':
      return node.name === 'integer' ? 'number' : node.name;
    case 'literal':
      return node.values.length === 0
        ? 'never'
        : [...new Set(node.values.map(literal))].join(' | ');
    case 'ref':
      return node.name;

    case 'array': {
      const item = renderNode(node.items, level, readonly);
      const element = needsParentheses(node.items) ? `(${item})` : item;

      return readonly ? `readonly ${element}[]` : `${element}[]`;
    }

    case 'tuple': {
      const items = node.items.map((item) => renderNode(item, level, readonly));

      if (node.rest) {
        const rest = renderNode(node.rest, level, readonly);

        items.push(`...${needsParentheses(node.rest) ? `(${rest})` : rest}[]`);
      }

      return `${readonly ? 'readonly ' : ''}[${items.join(', ')}]`;
    }

    case 'union':
      return [...new Set(node.members.map((member) => renderNode(member, level, readonly)))].join(
        ' | ',
      );
    case 'intersection':
      return node.members
        .map((member) => {
          const text = renderNode(member, level, readonly);

          return isUnionLike(member) ? `(${text})` : text;
        })
        .join(' & ');
    case 'object':
      return renderObject(node, level, readonly);
  }
}

function isUnionLike(node: SchemaNode): boolean {
  return node.kind === 'union' || (node.kind === 'literal' && node.values.length > 1);
}

function needsParentheses(node: SchemaNode): boolean {
  return node.kind === 'intersection' || isUnionLike(node);
}

function renderObject(
  node: Extract<SchemaNode, { kind: 'object' }>,
  level: number,
  readonly: boolean,
): string {
  const extra =
    typeof node.additional === 'boolean' ? undefined : renderNode(node.additional, level, readonly);

  if (node.properties.length === 0)
    return `Record<string, ${extra ?? (node.additional ? 'unknown' : 'never')}>`;

  const body = renderBody(node, level, readonly);

  return extra === undefined ? body : `${body} & Record<string, ${extra}>`;
}
