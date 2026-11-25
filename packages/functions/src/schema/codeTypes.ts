import { FunctionError } from '../errors';
import type { JsonValue } from '../format';
import type { CodeRecord, CodeType } from './codeTypesModel';
import { renderCSharp, renderGo, renderJava, renderKotlin, renderRust } from './codeTypesStatic';
import { renderPython, renderSwift } from './codeTypesScript';
import {
  inferShape,
  sanitizeTypeName,
  singularTypeName,
  typeInferenceLimits,
} from './typeInference';
import type { Shape } from './typeInference';

export type CodeTypeLanguage = 'csharp' | 'go' | 'java' | 'kotlin' | 'python' | 'rust' | 'swift';

export type CodeTypeOptions = {
  language: CodeTypeLanguage;
  optionalProperties?: 'observed' | 'all';
  pythonFlavor?: 'dataclass' | 'pydantic';
};

export const codeTypeLanguages: readonly CodeTypeLanguage[] = [
  'csharp',
  'go',
  'java',
  'kotlin',
  'python',
  'rust',
  'swift',
];

const labels: Record<CodeTypeLanguage, string> = {
  csharp: 'C#',
  go: 'Go',
  java: 'Java',
  kotlin: 'Kotlin',
  python: 'Python',
  rust: 'Rust',
  swift: 'Swift',
};

type Builder = {
  names: Set<string>;
  optionalProperties: 'observed' | 'all';
  records: CodeRecord[];
};
type Typed = { nullable: boolean; type: CodeType };
type ObjectShape = NonNullable<Shape['object']>;

export function codeTypeLabel(language: CodeTypeLanguage): string {
  return labels[language];
}

export function generateCodeTypes(
  value: JsonValue,
  rootName: string,
  options: CodeTypeOptions,
): { text: string; typeCount: number } {
  const shape = inferShape(value, 0, { values: 0 });
  const records = buildRecords(shape, rootName, options.optionalProperties ?? 'observed');
  const text = render(records, options);

  if (text.length > typeInferenceLimits.outputCharacters) {
    throw new FunctionError(
      'SCHEMA_ERROR',
      `Generated code exceeds ${typeInferenceLimits.outputCharacters.toLocaleString('en-US')} characters.`,
    );
  }

  return { text, typeCount: records.length };
}

function render(records: CodeRecord[], options: CodeTypeOptions): string {
  switch (options.language) {
    case 'csharp':
      return renderCSharp(records);
    case 'go':
      return renderGo(records);
    case 'java':
      return renderJava(records);
    case 'kotlin':
      return renderKotlin(records);
    case 'python':
      return renderPython(records, options.pythonFlavor ?? 'dataclass');
    case 'rust':
      return renderRust(records);
    case 'swift':
      return renderSwift(records);
  }
}

function buildRecords(
  shape: Shape,
  rootName: string,
  optionalProperties: 'observed' | 'all',
): CodeRecord[] {
  const builder: Builder = { names: new Set(), optionalProperties, records: [] };
  const name = sanitizeTypeName(rootName);
  const item = shape.array?.item;

  if (isRecordOnly(shape) && shape.object) {
    addRecord(shape.object, name, builder);
  } else if (item && isRecordOnly(item) && item.object && !shape.object && !shape.primitives.size) {
    addRecord(item.object, singularTypeName(name), builder);
  } else {
    throw new FunctionError('SCHEMA_ERROR', rootError(shape));
  }

  return builder.records;
}

function rootError(shape: Shape): string {
  const item = shape.array?.item;

  if (shape.object && !shape.array && shape.primitives.size === 0)
    return 'The root object has no properties to type.';
  if (item?.object && (item.array || item.primitives.size > 0) && !shape.object)
    return 'Every item in the root array must be an object.';

  return 'Code types need a JSON object or an array of objects as the root.';
}

function isRecordOnly(shape: Shape): boolean {
  return (
    shape.object !== undefined &&
    shape.object.properties.size > 0 &&
    !shape.array &&
    shape.primitives.size === 0
  );
}

function addRecord(object: ObjectShape, wanted: string, builder: Builder): string {
  let name = wanted;

  for (let suffix = 2; builder.names.has(name); suffix += 1) name = `${wanted}${suffix}`;
  builder.names.add(name);

  const record: CodeRecord = { fields: [], name };

  builder.records.push(record);

  for (const [key, property] of object.properties) {
    const typed = typeOf(property.shape, `${name}${sanitizeTypeName(key)}`, builder);

    record.fields.push({
      jsonKey: key,
      nullable: typed.nullable,
      optional:
        builder.optionalProperties === 'all' ||
        property.count !== object.samples ||
        (typed.nullable && typed.type.kind !== 'any'),
      type: typed.type,
    });
  }

  return name;
}

// shortcut: mixed kinds and null array items collapse to "any", upgrade when unions are needed.
function typeOf(shape: Shape, name: string, builder: Builder): Typed {
  const kinds = [...shape.primitives].filter((kind) => kind !== 'null');
  const nullable = shape.primitives.has('null');
  const count = kinds.length + (shape.object ? 1 : 0) + (shape.array ? 1 : 0);
  const any: Typed = { nullable, type: { kind: 'any' } };

  if (count !== 1) return any;

  if (shape.object) {
    if (shape.object.properties.size === 0) return any;

    return { nullable, type: { kind: 'record', name: addRecord(shape.object, name, builder) } };
  }

  if (shape.array) {
    const item = shape.array.item;
    const inner = item ? typeOf(item, singularTypeName(name), builder) : undefined;

    return {
      nullable,
      type: { item: inner && !inner.nullable ? inner.type : { kind: 'any' }, kind: 'array' },
    };
  }

  const kind = kinds[0];

  if (kind === 'number') return { nullable, type: { kind: shape.integer ? 'integer' : 'number' } };
  if (kind === 'boolean' || kind === 'string') return { nullable, type: { kind } };

  return any;
}
