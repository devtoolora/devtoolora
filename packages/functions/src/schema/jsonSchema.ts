import type { OutputUnit, Schema } from '@cfworker/json-schema';
import { dereference, validate as validateInstance } from './validationEngine.generated';
import { FunctionError } from '../errors';
import { jsonDuplicateWarning, type JsonValue } from '../format';
import { validateMeta7, validateMeta2019, validateMeta2020 } from './metaValidators.generated';
import {
  prepareAdditionalPropertyRules,
  preparePrototypeProperties,
  prepareSchemaKeywords,
  removeObjectPrototypes,
} from './jsonSchemaKeywords';
import type { JsonSchemaDraft } from './jsonSchemaShared';
import {
  checkedBoolean,
  checkedDraft,
  draftFromUri,
  errorMessage,
  isRecord,
  jsonSchemaLimits,
  parseBoundedJson,
  schemaError,
} from './jsonSchemaShared';

export { generateJsonSchema, type JsonSchemaGenerationOptions } from './generate';
export type { JsonSchemaDraft } from './jsonSchemaShared';
export { jsonSchemaDraftUris, jsonSchemaLimits } from './jsonSchemaShared';

export interface JsonSchemaValidationOptions {
  allErrors?: boolean;
  draft?: JsonSchemaDraft | 'auto';
  validateFormats?: boolean;
}

export interface JsonSchemaIssue {
  instancePath: string;
  keyword: string;
  message: string;
  schemaPath: string;
}

export interface SchemaValidationResult {
  errors: string[];
  valid: boolean;
}

export interface JsonSchemaValidationReport {
  draft: JsonSchemaDraft;
  errors: JsonSchemaIssue[];
  errorsTruncated: boolean;
  totalErrors: number;
  valid: boolean;
  validateFormats: boolean;
  warnings: string[];
}

export function parseJsonSchemaData(text: string): JsonValue {
  return parseBoundedJson(
    text,
    'JSON data',
    jsonSchemaLimits.dataCharacters,
    jsonSchemaLimits.dataNodes,
    { allowDuplicateKeys: true },
  );
}

export function validateJsonSchema(
  text: string,
  schemaText: string,
  options: JsonSchemaValidationOptions = {},
): SchemaValidationResult {
  const report = inspectJsonSchema(text, schemaText, options);
  const errors = report.errors.map(
    (error: JsonSchemaIssue) => `${error.instancePath || '$'} ${error.message} [${error.keyword}]`,
  );

  if (report.errorsTruncated)
    errors.push(`Showing ${report.errors.length} of ${report.totalErrors} validation errors.`);

  return { errors, valid: report.valid };
}

export function inspectJsonSchema(
  text: string,
  schemaText: string,
  options: JsonSchemaValidationOptions = {},
): JsonSchemaValidationReport {
  const value = parseJsonSchemaData(text);
  const duplicateWarning = jsonDuplicateWarning(text, 'was checked');
  const schema = parseBoundedJson(
    schemaText,
    'JSON Schema',
    jsonSchemaLimits.schemaCharacters,
    jsonSchemaLimits.schemaNodes,
  );

  if (typeof schema !== 'boolean' && !isRecord(schema))
    throw schemaError('JSON Schema must be an object or true/false.');

  const draft = resolveDraft(schema, options.draft ?? 'auto');
  const validateFormats = checkedBoolean(options.validateFormats, true, 'Format validation');
  const allErrors = checkedBoolean(options.allErrors, true, 'Collect all errors');

  preparePrototypeProperties(schema);
  assertMetaSchema(schema, draft);
  prepareSchemaKeywords(schema, draft, validateFormats);
  prepareAdditionalPropertyRules(schema);
  removeObjectPrototypes(value);
  removeObjectPrototypes(schema);
  // The bundled meta-validator and keyword checks validate this third-party boundary.
  const prepared = schema as Schema | boolean;
  const lookup = resolveSchemaReferences(prepared);

  let validation: ReturnType<typeof validateInstance>;

  try {
    validation = validateInstance(
      value,
      prepared,
      draft === 'draft-07' ? '7' : draft,
      lookup,
      !allErrors,
    );
  } catch (error: unknown) {
    throw schemaError(`Could not validate JSON against this schema: ${errorMessage(error)}`);
  }

  const detailed = detailedErrors(validation.errors);
  const errors = allErrors ? detailed : detailed.slice(0, 1);

  return {
    draft,
    errors: errors.slice(0, jsonSchemaLimits.reportedErrors).map(toIssue),
    errorsTruncated: errors.length > jsonSchemaLimits.reportedErrors,
    totalErrors: errors.length,
    valid: validation.valid,
    validateFormats,
    warnings: duplicateWarning ? [duplicateWarning] : [],
  };
}

const metaValidators = {
  '2019-09': validateMeta2019,
  '2020-12': validateMeta2020,
  'draft-07': validateMeta7,
} satisfies Record<JsonSchemaDraft, unknown>;

function assertMetaSchema(
  schema: boolean | Record<string, JsonValue>,
  draft: JsonSchemaDraft,
): void {
  const validateMeta = metaValidators[draft];

  if (!validateMeta(schema)) {
    const issue = validateMeta.errors?.[0];

    throw schemaError(
      `Invalid JSON Schema: ${issue?.instancePath || '$'} ${issue?.message ?? 'does not match the draft meta-schema'}.`,
    );
  }
}

function resolveSchemaReferences(prepared: Schema | boolean): ReturnType<typeof dereference> {
  try {
    const lookup = dereference(prepared);

    for (const child of Object.values(lookup)) {
      if (
        typeof child === 'object' &&
        child.__absolute_ref__ &&
        !Object.hasOwn(lookup, child.__absolute_ref__)
      ) {
        throw schemaError(
          `Invalid JSON Schema: cannot resolve reference ${JSON.stringify(child.$ref)}. External schemas are not loaded.`,
        );
      }
    }

    return lookup;
  } catch (error: unknown) {
    if (error instanceof FunctionError) throw error;

    throw schemaError(`Invalid JSON Schema: ${errorMessage(error)}`);
  }
}

function detailedErrors(validationErrors: OutputUnit[]): OutputUnit[] {
  const detailed: OutputUnit[] = [];

  for (const [index, error] of validationErrors.entries()) {
    const parent = validationErrors[index - 1];

    if (
      [
        'properties',
        'patternProperties',
        '$ref',
        'dependentSchemas',
        'allOf',
        'prefixItems',
        'items',
      ].includes(error.keyword)
    )
      continue;
    if (
      error.keyword === 'false' &&
      parent &&
      ['additionalProperties', 'unevaluatedProperties'].includes(parent.keyword)
    )
      continue;

    detailed.push(
      error.keyword === 'false' && parent
        ? {
            ...error,
            keyword: parent.keyword === 'items' ? 'items' : error.keyword,
            keywordLocation: parent.keywordLocation,
          }
        : error,
    );
  }

  return detailed;
}

function resolveDraft(
  schema: boolean | Record<string, JsonValue>,
  requested: JsonSchemaDraft | 'auto',
): JsonSchemaDraft {
  if (requested !== 'auto') checkedDraft(requested);

  const declared = typeof schema === 'boolean' ? undefined : schema.$schema;

  if (declared !== undefined && typeof declared !== 'string')
    throw schemaError('The $schema declaration must be a supported draft URI.');

  const declaredDraft = declared === undefined ? undefined : draftFromUri(declared);

  if (requested !== 'auto' && declaredDraft !== undefined && requested !== declaredDraft) {
    throw schemaError(
      `Selected ${requested} conflicts with the schema's ${declaredDraft} declaration. Choose Auto or a matching draft.`,
    );
  }

  return requested === 'auto' ? (declaredDraft ?? 'draft-07') : requested;
}

function toIssue(error: OutputUnit): JsonSchemaIssue {
  let message = error.error;

  if (error.keyword === 'type') {
    const expected = message.match(/Expected (.+)\.$/)?.[1];

    if (expected) message = `must be ${expected.replace(/"/g, '').replace(/, /g, ' or ')}`;
  } else if (error.keyword === 'required')
    message = message
      .replace('Instance does not have required property', 'must have required property')
      .replace(/\.$/, '');
  else if (error.keyword === 'format')
    message = message
      .replace('String does not match format', 'must match format')
      .replace(/\.$/, '');
  else if (error.keyword === 'additionalProperties')
    message = message.replace(
      /^Property (.+) does not match additional properties schema\.$/,
      'must NOT have additional properties (property $1)',
    );

  return {
    instancePath: error.instanceLocation.replace(/^#/, ''),
    keyword: error.keyword,
    message,
    schemaPath: error.keywordLocation.replace('/dependantRequired', '/dependentRequired'),
  };
}
