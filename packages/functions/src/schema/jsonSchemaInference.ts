import type { JsonValue } from '../format';
import { isRecord, schemaError } from './jsonSchemaShared';

type PrimitiveType = 'boolean' | 'integer' | 'null' | 'number' | 'string';
type ObjectProperty = { count: number; shape: InferredShape };
type ShapeVariant =
  | { item?: InferredShape; kind: 'array' }
  | { kind: 'object'; properties: Map<string, ObjectProperty>; samples: number }
  | { kind: 'primitive'; types: Set<PrimitiveType> };
type InferredShape = ShapeVariant[];

const primitiveOrder: PrimitiveType[] = ['string', 'integer', 'number', 'boolean', 'null'];

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;

  return left > right ? 1 : 0;
}

function primitiveType(value: JsonValue): PrimitiveType {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'boolean') return 'boolean';

  return 'string';
}

export function inferShape(value: JsonValue): InferredShape {
  if (Array.isArray(value)) {
    let item: InferredShape | undefined;

    for (const child of value)
      item = item ? mergeShapes(item, inferShape(child)) : inferShape(child);

    return [{ item, kind: 'array' }];
  }

  if (isRecord(value)) {
    return [
      {
        kind: 'object',
        properties: new Map(
          Object.entries(value)
            .sort(([leftKey], [rightKey]) => compareCodeUnits(leftKey, rightKey))
            .map(([key, child]) => [key, { count: 1, shape: inferShape(child) }]),
        ),
        samples: 1,
      },
    ];
  }

  const type = primitiveType(value);

  return [{ kind: 'primitive', types: new Set([type]) }];
}

function mergeShapes(left: InferredShape, right: InferredShape): InferredShape {
  const merged: InferredShape = [...left];

  for (const next of right) {
    const index = merged.findIndex((variant: ShapeVariant) => variant.kind === next.kind);

    if (index === -1) merged.push(next);
    else merged[index] = mergeVariant(merged[index]!, next);
  }

  return merged;
}

function mergeVariant(left: ShapeVariant, right: ShapeVariant): ShapeVariant {
  if (left.kind === 'primitive' && right.kind === 'primitive') {
    const types = new Set([...left.types, ...right.types]);

    if (types.has('number')) types.delete('integer');

    return { kind: 'primitive', types };
  }

  if (left.kind === 'array' && right.kind === 'array') {
    return {
      item:
        left.item && right.item ? mergeShapes(left.item, right.item) : (left.item ?? right.item),
      kind: 'array',
    };
  }

  if (left.kind === 'object' && right.kind === 'object') {
    // Merges into the accumulator in place; copying and re-sorting per sample would be quadratic.
    for (const [key, property] of right.properties) {
      const existing = left.properties.get(key);

      left.properties.set(
        key,
        existing
          ? {
              count: existing.count + property.count,
              shape: mergeShapes(existing.shape, property.shape),
            }
          : property,
      );
    }

    left.samples += right.samples;

    return left;
  }

  throw schemaError('Cannot merge incompatible inferred shape variants.');
}

export function schemaForShape(
  shape: InferredShape,
  additionalProperties: boolean,
  requiredProperties: 'observed' | 'none',
): Record<string, JsonValue> {
  const schemas = shape.map((variant: ShapeVariant) =>
    schemaForVariant(variant, additionalProperties, requiredProperties),
  );

  return schemas.length === 1 ? schemas[0]! : { anyOf: schemas };
}

function schemaForVariant(
  variant: ShapeVariant,
  additionalProperties: boolean,
  requiredProperties: 'observed' | 'none',
): Record<string, JsonValue> {
  if (variant.kind === 'primitive') {
    const types = primitiveOrder.filter((type: PrimitiveType) => variant.types.has(type));

    return { type: types.length === 1 ? types[0]! : types };
  }

  if (variant.kind === 'array')
    return {
      items: variant.item
        ? schemaForShape(variant.item, additionalProperties, requiredProperties)
        : {},
      type: 'array',
    };

  const sorted = [...variant.properties].sort(([leftKey], [rightKey]) =>
    compareCodeUnits(leftKey, rightKey),
  );
  const properties = Object.fromEntries(
    sorted.map(([key, property]) => [
      key,
      schemaForShape(property.shape, additionalProperties, requiredProperties),
    ]),
  );
  const prototypeSchema = Object.hasOwn(properties, '__proto__') ? properties.__proto__ : undefined;

  if (prototypeSchema !== undefined) delete properties.__proto__;

  const required = sorted
    .filter(([, property]) => property.count === variant.samples)
    .map(([key]) => key);

  return {
    additionalProperties,
    ...(prototypeSchema !== undefined
      ? { patternProperties: { '^__proto__$': prototypeSchema } }
      : {}),
    properties,
    ...(requiredProperties === 'observed' && required.length > 0 ? { required } : {}),
    type: 'object',
  };
}
