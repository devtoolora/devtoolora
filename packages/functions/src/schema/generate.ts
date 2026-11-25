import type { JsonValue } from '../format';
import { inferShape, schemaForShape } from './jsonSchemaInference';
import type { JsonSchemaDraft } from './jsonSchemaShared';
import {
  checkJsonValue,
  checkedBoolean,
  checkedDraft,
  jsonSchemaDraftUris,
  jsonSchemaLimits,
  schemaError,
} from './jsonSchemaShared';

// Kept apart from jsonSchema.ts so importers do not pull in the bundled meta-validators.

export interface JsonSchemaGenerationOptions {
  additionalProperties?: boolean;
  draft?: JsonSchemaDraft;
  label?: string;
  requiredProperties?: 'observed' | 'none';
  schemaNodes?: number;
}

export function generateJsonSchema(
  value: JsonValue,
  options: JsonSchemaGenerationOptions = {},
): Record<string, JsonValue> {
  const draft = checkedDraft(options.draft ?? '2020-12');
  const additionalProperties = checkedBoolean(
    options.additionalProperties,
    false,
    'Additional properties',
  );
  const requiredProperties = options.requiredProperties ?? 'observed';

  if (requiredProperties !== 'observed' && requiredProperties !== 'none') {
    throw schemaError('Choose observed required properties or no required properties.');
  }

  checkJsonValue(
    value,
    options.label ?? 'JSON data',
    jsonSchemaLimits.dataCharacters,
    jsonSchemaLimits.dataNodes,
  );

  const schema = {
    $schema: jsonSchemaDraftUris[draft],
    ...schemaForShape(inferShape(value), additionalProperties, requiredProperties),
  };

  checkJsonValue(
    schema,
    'Generated JSON Schema',
    jsonSchemaLimits.schemaCharacters,
    options.schemaNodes ?? jsonSchemaLimits.schemaNodes,
  );

  return schema;
}
