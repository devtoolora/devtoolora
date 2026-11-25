import { FunctionError } from '../errors';
import { parseLosslessJsonData, rejectOutOfRangeNumbers } from '../format';
import type { JsonValue } from '../format';

type PrimitiveKind = 'null' | 'boolean' | 'number' | 'string';
type StringFormat = 'date' | 'datetime' | 'datetime-offset' | 'email' | 'url' | 'uuid';
type PropertyShape = { count: number; shape: Shape };
type ObjectShape = { properties: Map<string, PropertyShape>; samples: number };
export type Shape = {
  array?: { item?: Shape };
  format?: StringFormat | null;
  integer?: boolean;
  object?: ObjectShape;
  primitives: Set<PrimitiveKind>;
};

export type TypeScriptGenerationOptions = {
  declaration?: 'interface' | 'type';
  exported?: boolean;
  optionalProperties?: 'observed' | 'all';
  readonly?: boolean;
};

export type ZodGenerationOptions = {
  exportType?: boolean;
  inferFormats?: boolean;
  optionalProperties?: 'observed' | 'all';
  strictObjects?: boolean;
  version?: 3 | 4;
};

export const typeInferenceLimits = {
  depth: 64,
  inputCharacters: 1_000_000,
  outputCharacters: 1_000_000,
  values: 200_000,
} as const;

const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

export function parseTypeSample(text: string): JsonValue {
  if (text.length > typeInferenceLimits.inputCharacters) {
    throw inferenceError(
      `JSON input is limited to ${typeInferenceLimits.inputCharacters.toLocaleString('en-US')} characters.`,
    );
  }

  const input = text.trim();

  if (!input) throw new FunctionError('REQUIRED_JSON', 'JSON input is required.');

  checkSampleSyntax(input);
  rejectOutOfRangeNumbers(input);

  try {
    return JSON.parse(input) as JsonValue;
  } catch {
    throw new FunctionError('INVALID_JSON', 'Input is not valid JSON.');
  }
}

// Its project-written reasons give the position without echoing the input; its limit errors are
// ignored, because the generators apply their own.
function checkSampleSyntax(text: string): void {
  try {
    parseLosslessJsonData(text);
  } catch (error: unknown) {
    if (!(error instanceof FunctionError) || error.code !== 'JSON_LIMIT') throw error;
  }
}

export function generateTypeScriptTypes(
  value: JsonValue,
  rootName: string,
  options: TypeScriptGenerationOptions = {},
): string {
  const context: TypeScriptContext = {
    declaration: options.declaration ?? 'interface',
    declarations: [],
    exported: options.exported ?? true,
    names: new Set(),
    optionalProperties: options.optionalProperties ?? 'observed',
    readonly: options.readonly ?? false,
  };
  const name = sanitizeTypeName(rootName);
  const shape = inferShape(value, 0, { values: 0 });
  let output: string;

  if (isOnlyObject(shape) && shape.object !== undefined && shape.object.properties.size > 0) {
    typeForShape(shape, name, context);
    output = context.declarations.join('\n\n');
  } else {
    context.names.add(name);
    const slot = context.declarations.push('') - 1;
    const memberName = shape.object ? `${name}Object` : name;

    context.declarations[slot] =
      `${context.exported ? 'export ' : ''}type ${name} = ${typeForShape(shape, memberName, context)};`;

    output = context.declarations.join('\n\n');
  }

  return checkedOutput(output);
}

export function generateZodSchema(
  value: JsonValue,
  rootName: string,
  options: ZodGenerationOptions = {},
): string {
  const context: ZodContext = {
    inferFormats: options.inferFormats ?? true,
    optionalProperties: options.optionalProperties ?? 'observed',
    strictObjects: options.strictObjects ?? false,
    version: options.version ?? 4,
  };
  const typeName = sanitizeTypeName(rootName);
  const schemaName = `${typeName}Schema`;
  const lines = [
    "import { z } from 'zod';",
    '',
    `export const ${schemaName} = ${renderZod(zodForShape(inferShape(value, 0, { values: 0 }), 0, context))};`,
  ];

  if (options.exportType ?? true)
    lines.push('', `export type ${typeName} = z.infer<typeof ${schemaName}>;`);

  return checkedOutput(lines.join('\n'));
}

type TypeScriptContext = Required<TypeScriptGenerationOptions> & {
  declarations: string[];
  names: Set<string>;
};
type ZodContext = Required<Omit<ZodGenerationOptions, 'exportType'>>;
type ZodExpression = { base: string; nullable: boolean };

export function inferShape(value: JsonValue, depth: number, budget: { values: number }): Shape {
  budget.values += 1;

  if (budget.values > typeInferenceLimits.values) {
    throw inferenceError(
      `JSON input is limited to ${typeInferenceLimits.values.toLocaleString('en-US')} values and properties.`,
    );
  }

  if (depth > typeInferenceLimits.depth) {
    throw inferenceError(`JSON nesting is limited to ${typeInferenceLimits.depth} levels.`);
  }

  if (Array.isArray(value)) {
    let item: Shape | undefined;

    for (const next of value) {
      const shape = inferShape(next, depth + 1, budget);

      item = item ? mergeShapes(item, shape) : shape;
    }

    return { array: { item }, primitives: new Set() };
  }

  if (isRecord(value)) {
    const properties = new Map<string, PropertyShape>();

    for (const [key, child] of Object.entries(value)) {
      budget.values += 1;
      properties.set(key, { count: 1, shape: inferShape(child, depth + 1, budget) });
    }

    return { object: { properties, samples: 1 }, primitives: new Set() };
  }

  const kind = primitiveKind(value);
  const shape: Shape = { primitives: new Set([kind]) };

  if (kind === 'number') shape.integer = Number.isSafeInteger(value);
  if (kind === 'string') shape.format = stringFormat(value as string);

  return shape;
}

function mergeShapes(left: Shape, right: Shape): Shape {
  const merged: Shape = { primitives: new Set([...left.primitives, ...right.primitives]) };

  if (merged.primitives.has('number'))
    merged.integer = (left.integer ?? true) && (right.integer ?? true);
  if (merged.primitives.has('string')) merged.format = mergeFormats(left.format, right.format);

  if (left.array || right.array) {
    const leftItem = left.array?.item;
    const rightItem = right.array?.item;

    merged.array = {
      item: leftItem && rightItem ? mergeShapes(leftItem, rightItem) : (leftItem ?? rightItem),
    };
  }

  if (left.object && right.object) {
    merged.object = mergeObjectShapes(left.object, right.object);
  } else if (left.object || right.object) {
    merged.object = left.object ?? right.object;
  }

  return merged;
}

function mergeObjectShapes(left: ObjectShape, right: ObjectShape): ObjectShape {
  const properties = new Map<string, PropertyShape>();

  for (const key of new Set([...left.properties.keys(), ...right.properties.keys()])) {
    const leftProperty = left.properties.get(key);
    const rightProperty = right.properties.get(key);

    if (leftProperty && rightProperty) {
      properties.set(key, {
        count: leftProperty.count + rightProperty.count,
        shape: mergeShapes(leftProperty.shape, rightProperty.shape),
      });
    } else {
      const property = leftProperty ?? rightProperty;

      if (property) properties.set(key, property);
    }
  }

  return { properties, samples: left.samples + right.samples };
}

function mergeFormats(
  left: StringFormat | null | undefined,
  right: StringFormat | null | undefined,
): StringFormat | null {
  if (left === undefined) return right ?? null;
  if (right === undefined) return left;
  if (left === right) return left;
  if (left?.startsWith('datetime') && right?.startsWith('datetime')) return 'datetime-offset';

  return null;
}

function typeForShape(shape: Shape, name: string, context: TypeScriptContext): string {
  const members: string[] = [];

  if (shape.object) members.push(interfaceForObject(shape.object, name, context));

  if (shape.array) {
    const item = shape.array.item
      ? typeForShape(shape.array.item, singularTypeName(name), context)
      : 'unknown';
    const list = item.includes(' | ') || item.startsWith('readonly ') ? `(${item})[]` : `${item}[]`;

    members.push(context.readonly ? `readonly ${list}` : list);
  }

  for (const kind of ['string', 'number', 'boolean', 'null'] as const) {
    if (shape.primitives.has(kind)) members.push(kind);
  }

  return members.length ? [...new Set(members)].join(' | ') : 'unknown';
}

function interfaceForObject(shape: ObjectShape, name: string, context: TypeScriptContext): string {
  if (shape.properties.size === 0) return 'Record<string, unknown>';

  const declarationName = reserveTypeName(name, context.names);
  const slot = context.declarations.push('') - 1;
  const members: string[] = [];

  for (const [key, property] of shape.properties) {
    const optional =
      context.optionalProperties === 'all' || property.count !== shape.samples ? '?' : '';
    const type = typeForShape(
      property.shape,
      `${declarationName}${sanitizeTypeName(key)}`,
      context,
    );

    members.push(
      `  ${context.readonly ? 'readonly ' : ''}${formatPropertyName(key)}${optional}: ${type};`,
    );
  }

  const prefix = context.exported ? 'export ' : '';

  context.declarations[slot] =
    context.declaration === 'type'
      ? `${prefix}type ${declarationName} = {\n${members.join('\n')}\n};`
      : `${prefix}interface ${declarationName} {\n${members.join('\n')}\n}`;

  return declarationName;
}

function zodForShape(shape: Shape, depth: number, context: ZodContext): ZodExpression {
  const members: string[] = [];

  if (shape.object) members.push(zodForObject(shape.object, depth, context));
  if (shape.array)
    members.push(
      `z.array(${shape.array.item ? renderZod(zodForShape(shape.array.item, depth, context)) : 'z.unknown()'})`,
    );
  if (shape.primitives.has('string'))
    members.push(zodString(context.inferFormats ? (shape.format ?? null) : null, context.version));
  if (shape.primitives.has('number'))
    members.push(zodNumber(Boolean(context.inferFormats && shape.integer), context.version));
  if (shape.primitives.has('boolean')) members.push('z.boolean()');

  const nullable = shape.primitives.has('null');

  if (members.length === 0) return { base: nullable ? 'z.null()' : 'z.unknown()', nullable: false };

  return {
    base: members.length === 1 ? members[0]! : `z.union([${members.join(', ')}])`,
    nullable,
  };
}

function zodForObject(shape: ObjectShape, depth: number, context: ZodContext): string {
  if (shape.properties.size === 0) return 'z.record(z.string(), z.unknown())';

  const pad = '  '.repeat(depth);
  const childPad = '  '.repeat(depth + 1);
  // Zod drops a __proto__ key from parsed data, so a strict object would reject its own sample.
  const strict = context.strictObjects && !shape.properties.has('__proto__');
  const lines = [strict && context.version === 4 ? 'z.strictObject({' : 'z.object({'];

  for (const [key, property] of shape.properties) {
    if (key === '__proto__') {
      lines.push(
        `${childPad}// "__proto__" omitted: Zod drops this key from parsed data${context.strictObjects ? ', so this object is not strict' : ''}.`,
      );

      continue;
    }

    const expression = zodForShape(property.shape, depth + 1, context);
    const optional = context.optionalProperties === 'all' || property.count !== shape.samples;
    const rendered = optional ? optionalZod(expression) : renderZod(expression);

    lines.push(`${childPad}${formatPropertyName(key)}: ${rendered},`);
  }

  lines.push(`${pad}})${strict && context.version === 3 ? '.strict()' : ''}`);

  return lines.join('\n');
}

function renderZod(expression: ZodExpression): string {
  return expression.nullable ? `${expression.base}.nullable()` : expression.base;
}

function optionalZod(expression: ZodExpression): string {
  return `${expression.base}.${expression.nullable ? 'nullish' : 'optional'}()`;
}

function zodNumber(integer: boolean, version: 3 | 4): string {
  if (!integer) return 'z.number()';

  return version === 4 ? 'z.int()' : 'z.number().int()';
}

function zodString(format: StringFormat | null, version: 3 | 4): string {
  if (!format) return 'z.string()';

  const v4: Record<StringFormat, string> = {
    date: 'z.iso.date()',
    datetime: 'z.iso.datetime()',
    'datetime-offset': 'z.iso.datetime({ offset: true })',
    email: 'z.email()',
    url: 'z.url()',
    uuid: 'z.uuid()',
  };
  const v3: Record<StringFormat, string> = {
    date: 'z.string().date()',
    datetime: 'z.string().datetime()',
    'datetime-offset': 'z.string().datetime({ offset: true })',
    email: 'z.string().email()',
    url: 'z.string().url()',
    uuid: 'z.string().uuid()',
  };

  return (version === 4 ? v4 : v3)[format];
}

function stringFormat(value: string): StringFormat | null {
  const date = DATE_PATTERN.exec(value);

  if (date)
    return isCalendarDate(Number(date[1]), Number(date[2]), Number(date[3])) ? 'date' : null;

  const dateTime = DATETIME_PATTERN.exec(value);

  if (dateTime) {
    const [, year, month, day, hour, minute, second, , zone, offsetHour, offsetMinute] = dateTime;
    const validTime = Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60;
    const validOffset = zone === 'Z' || (Number(offsetHour) < 24 && Number(offsetMinute) < 60);

    if (!validTime || !validOffset || !isCalendarDate(Number(year), Number(month), Number(day)))
      return null;

    return zone === 'Z' ? 'datetime' : 'datetime-offset';
  }

  if (UUID_PATTERN.test(value)) return 'uuid';
  if (EMAIL_PATTERN.test(value)) return 'email';

  if (/^https?:\/\/[^\s]+$/i.test(value)) {
    try {
      const url = new URL(value);

      return /^[a-z0-9.-]+$/.test(url.hostname) && url.hostname.includes('.') ? 'url' : null;
    } catch {
      return null;
    }
  }

  return null;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;

  const days = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= days[month - 1]!;
}

function isOnlyObject(shape: Shape): boolean {
  return Boolean(shape.object) && !shape.array && shape.primitives.size === 0;
}

function primitiveKind(value: JsonValue): PrimitiveKind {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';

  return 'string';
}

export function singularTypeName(name: string): string {
  const rules: Array<[RegExp, string]> = [
    [/ies$/, 'y'],
    [/(ss|x|ch|sh|us)es$/, '$1'],
    [/([^siu])s$/, '$1'],
  ];

  for (const [pattern, replacement] of rules) {
    if (pattern.test(name)) return name.replace(pattern, replacement);
  }

  return `${name}Item`;
}

export function sanitizeTypeName(value: string): string {
  const words = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[A-Za-z0-9]+/g) ?? ['Root'];
  const name = words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join('');

  return /^[A-Za-z_]/.test(name) ? name : `Type${name}`;
}

function reserveTypeName(name: string, names: Set<string>): string {
  let candidate = name;

  for (let suffix = 2; names.has(candidate); suffix += 1) candidate = `${name}${suffix}`;
  names.add(candidate);

  return candidate;
}

function formatPropertyName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function checkedOutput(output: string): string {
  if (output.length > typeInferenceLimits.outputCharacters) {
    throw inferenceError(
      `Generated code is limited to ${typeInferenceLimits.outputCharacters.toLocaleString('en-US')} characters; reduce the sample.`,
    );
  }

  return output;
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function inferenceError(message: string): FunctionError {
  return new FunctionError('SCHEMA_ERROR', message);
}
