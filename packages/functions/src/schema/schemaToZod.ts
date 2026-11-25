import type { JsonValue } from '../format';
import { schemaError } from './jsonSchemaShared';
import { ignoredComments } from './schemaToCode';
import { identifier, quote } from './schemaToTypeScript';
import type { CompiledSchema, SchemaConstraints, SchemaNode } from './schemaToCode';
import { typeInferenceLimits } from './typeInference';

type ZodOptions = { exportType?: boolean; version?: 3 | 4 };
type Declaration = CompiledSchema['declarations'][number];
type PrimitiveNode = Extract<SchemaNode, { kind: 'primitive' }>;

// Zod's time helpers reject the UTC offset that an RFC 3339 full-time requires.
const rfc3339Time =
  'z.string().regex(/^(?:[01]\\d|2[0-3]):[0-5]\\d:(?:[0-5]\\d|60)(?:\\.\\d+)?(?:[zZ]|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)$/)';
const zod4Formats = new Map([
  ['date', 'z.iso.date()'],
  ['date-time', 'z.iso.datetime({ offset: true })'],
  ['email', 'z.email()'],
  ['ipv4', 'z.ipv4()'],
  ['ipv6', 'z.ipv6()'],
  ['time', rfc3339Time],
  ['uri', 'z.url()'],
  ['url', 'z.url()'],
  ['uuid', 'z.uuid()'],
]);
const zod3Formats = new Map([
  ['date', 'z.string().date()'],
  ['date-time', 'z.string().datetime({ offset: true })'],
  ['email', 'z.string().email()'],
  ['ipv4', "z.string().ip({ version: 'v4' })"],
  ['ipv6', "z.string().ip({ version: 'v6' })"],
  ['time', rfc3339Time],
  ['uri', 'z.string().url()'],
  ['url', 'z.string().url()'],
  ['uuid', 'z.string().uuid()'],
]);

export function renderSchemaZod(compiled: CompiledSchema, options: ZodOptions): string {
  const version = options.version ?? 4;
  const blocks = orderDeclarations(compiled).map(({ name, node }) => {
    const description =
      node.description === undefined ? '' : `.describe(${quote(node.description)})`;
    const schema = `export const ${name}Schema = ${renderNode(node, 0, version)}${description};`;

    return options.exportType === false
      ? schema
      : `${schema}\n\nexport type ${name} = z.infer<typeof ${name}Schema>;`;
  });

  const ignored = ignoredComments(compiled);

  if (ignored.length > 0) blocks.push(ignored.join('\n'));

  const output = `import { z } from 'zod';\n\n${blocks.join('\n\n')}`;

  if (output.length > typeInferenceLimits.outputCharacters)
    throw schemaError(
      `Generated code exceeds ${typeInferenceLimits.outputCharacters.toLocaleString('en-US')} characters.`,
    );

  return output;
}

function referencesOf(node: SchemaNode, found: Set<string>): Set<string> {
  switch (node.kind) {
    case 'ref':
      found.add(node.name);

      break;
    case 'array':
      referencesOf(node.items, found);

      break;
    case 'tuple':
      node.items.forEach((item) => referencesOf(item, found));
      if (node.rest) referencesOf(node.rest, found);

      break;
    case 'object':
      node.properties.forEach((property) => referencesOf(property.node, found));
      if (typeof node.additional !== 'boolean') referencesOf(node.additional, found);

      break;
    case 'union':
    case 'intersection':
      node.members.forEach((member) => referencesOf(member, found));

      break;
    default:
  }

  return found;
}

function orderDeclarations(compiled: CompiledSchema): Declaration[] {
  const pending = compiled.declarations.map((declaration) => ({
    declaration,
    needs: referencesOf(declaration.node, new Set()),
  }));
  const ordered: Declaration[] = [];
  const done = new Set<string>();

  while (pending.length > 0) {
    const index = pending.findIndex(({ needs }) => [...needs].every((name) => done.has(name)));
    const [next] = index === -1 ? [] : pending.splice(index, 1);

    if (next === undefined) throw schemaError('Recursive schemas are not supported in Zod output.');

    done.add(next.declaration.name);
    ordered.push(next.declaration);
  }

  return ordered;
}

function exactLiteral(value: JsonValue): SchemaNode {
  return { kind: 'literal', values: [value] };
}

// An array or object constant has no z.literal, so it is spelled out as an exact shape.
function literal(value: JsonValue, level: number, version: 3 | 4): string {
  if (value === null) return 'z.null()';
  if (typeof value === 'string') return `z.literal(${quote(value)})`;
  if (Array.isArray(value))
    return renderNode({ items: value.map(exactLiteral), kind: 'tuple' }, level, version);

  if (typeof value === 'object') {
    const properties = Object.entries(value).map(([name, child]) => ({
      name,
      node: exactLiteral(child),
      optional: false,
    }));

    return renderObject({ additional: false, kind: 'object', properties }, level, version);
  }

  return `z.literal(${JSON.stringify(value)})`;
}

function renderNode(node: SchemaNode, level: number, version: 3 | 4): string {
  const render = (child: SchemaNode): string => renderNode(child, level, version);

  switch (node.kind) {
    case 'primitive':
      return renderPrimitive(node, version);
    case 'literal':
      return renderLiteral(node.values, level, version);
    case 'ref':
      return `${node.name}Schema`;

    case 'array': {
      const bounds = `${node.minItems === undefined ? '' : `.min(${node.minItems})`}${node.maxItems === undefined ? '' : `.max(${node.maxItems})`}`;

      return `z.array(${render(node.items)})${bounds}`;
    }

    case 'tuple':
      return `z.tuple([${node.items.map(render).join(', ')}])${node.rest ? `.rest(${render(node.rest)})` : ''}`;

    case 'union': {
      const members = node.members.filter(
        (member) => !(member.kind === 'primitive' && member.name === 'null'),
      );
      const nullable = members.length < node.members.length ? '.nullable()' : '';
      const [only] = members;
      const base =
        members.length === 1 && only
          ? render(only)
          : `z.union([${members.map(render).join(', ')}])`;

      return members.length === 0 ? 'z.null()' : `${base}${nullable}`;
    }

    case 'intersection': {
      const [first, ...rest] = node.members.map(render);

      return [first, ...rest.map((member) => `.and(${member})`)].join('');
    }

    case 'object':
      return renderObject(node, level, version);
  }
}

function renderLiteral(values: JsonValue[], level: number, version: 3 | 4): string {
  const unique = [...new Set(values.map((value) => JSON.stringify(value)))].map((text): JsonValue =>
    JSON.parse(text),
  );
  const [only] = unique;

  if (only === undefined) return 'z.never()';
  if (unique.length === 1) return literal(only, level, version);
  if (unique.every((value): value is string => typeof value === 'string'))
    return `z.enum([${unique.map(quote).join(', ')}])`;

  return `z.union([${unique.map((value) => literal(value, level, version)).join(', ')}])`;
}

function renderPrimitive(node: PrimitiveNode, version: 3 | 4): string {
  switch (node.name) {
    case 'string':
      return renderString(node.constraints, version);
    case 'integer':
    case 'number':
      return `z.number()${node.name === 'integer' ? '.int()' : ''}${numberChecks(node.constraints)}`;
    default:
      return `z.${node.name}()`;
  }
}

function renderString(constraints: SchemaConstraints, version: 3 | 4): string {
  const formats = version === 4 ? zod4Formats : zod3Formats;
  const base =
    (constraints.format === undefined ? undefined : formats.get(constraints.format)) ??
    'z.string()';
  const { maxLength, minLength, pattern } = constraints;

  return `${base}${minLength === undefined ? '' : `.min(${minLength})`}${maxLength === undefined ? '' : `.max(${maxLength})`}${pattern === undefined ? '' : `.regex(${patternLiteral(pattern)})`}`;
}

// JSON Schema patterns are Unicode-aware; one that only compiles without the flag keeps working.
function patternLiteral(pattern: string): string {
  try {
    return `/${new RegExp(pattern, 'u').source}/u`;
  } catch {
    return `/${new RegExp(pattern).source}/`;
  }
}

function numberChecks(constraints: SchemaConstraints): string {
  const checks: Array<[string, number | undefined]> = [
    ['min', constraints.minimum],
    ['gt', constraints.exclusiveMinimum],
    ['max', constraints.maximum],
    ['lt', constraints.exclusiveMaximum],
    ['multipleOf', constraints.multipleOf],
  ];

  return checks
    .map(([method, value]) => (value === undefined ? '' : `.${method}(${value})`))
    .join('');
}

function renderObject(
  node: Extract<SchemaNode, { kind: 'object' }>,
  level: number,
  version: 3 | 4,
): string {
  const indent = '  '.repeat(level + 1);
  const lines = node.properties.map(({ name, node: child, optional }) => {
    const key = propertyKey(name);

    return `${indent}${key}: ${renderNode(child, level + 1, version)}${optional ? '.optional()' : ''},`;
  });
  const body = lines.length === 0 ? '{}' : `{\n${lines.join('\n')}\n${'  '.repeat(level)}}`;

  if (node.additional === false)
    return version === 4 ? `z.strictObject(${body})` : `z.object(${body}).strict()`;

  return typeof node.additional === 'boolean'
    ? `z.object(${body})`
    : `z.object(${body}).catchall(${renderNode(node.additional, level, version)})`;
}

function propertyKey(name: string): string {
  // a literal __proto__ key would set the prototype instead of defining a property
  if (name === '__proto__') return `[${quote(name)}]`;

  return identifier.test(name) ? name : quote(name);
}
