import {
  ToolDefinition,
  ToolError,
  ToolField,
  ToolFieldCondition,
  ToolInput,
  ToolResult,
  ToolRuntimeCapability,
  toolRuntimeCapabilities,
} from './types';
import { toolSupportsCapability } from './capabilities';

const allowedResultActions = new Set(['replace', 'insert', 'copy', 'scratch', 'save']);
const allowedCapabilities = new Set<ToolRuntimeCapability>(toolRuntimeCapabilities);

export function createToolRegistry(definitions: ToolDefinition[]): {
  getTool(id: string): ToolDefinition;
  runTool(id: string, input: ToolInput): Promise<ToolResult>;
  runToolWithCapability(
    id: string,
    input: ToolInput,
    capability: ToolRuntimeCapability,
  ): Promise<ToolResult>;
  tools: ToolDefinition[];
} {
  const tools = validateToolRegistry(definitions);

  function getTool(id: string): ToolDefinition {
    const tool = tools.find((candidate) => candidate.id === id);

    if (!tool) {
      throw new ToolError(`Unknown tool: ${id}`);
    }

    return tool;
  }

  function normalizeInput(input?: Partial<ToolInput>): ToolInput {
    return {
      text: input?.text ?? '',
      fields: input?.fields ?? {},
    };
  }

  async function runTool(id: string, input: ToolInput): Promise<ToolResult> {
    return getTool(id).run(normalizeInput(input));
  }

  async function runToolWithCapability(
    id: string,
    input: ToolInput,
    capability: ToolRuntimeCapability,
  ): Promise<ToolResult> {
    const tool = getTool(id);

    if (!toolSupportsCapability(tool, capability)) {
      throw new ToolError(`Tool ${id} does not support runtime capability: ${capability}`);
    }

    return tool.run(normalizeInput(input));
  }

  return { tools, getTool, runTool, runToolWithCapability };
}

export function validateToolRegistry(definitions: ToolDefinition[]): ToolDefinition[] {
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const tool of definitions) {
    if (ids.has(tool.id)) {
      throw new ToolError(`Duplicate tool id: ${tool.id}`);
    }

    ids.add(tool.id);

    const nameKey = `${tool.category}:${tool.name}`;

    if (!tool.aliasOf && names.has(nameKey)) {
      throw new ToolError(`Duplicate tool name in ${tool.category}: ${tool.name}`);
    }

    if (!tool.aliasOf) names.add(nameKey);

    validateCapabilities(tool);
    validateResultActions(tool.id, tool.resultActions);
    validateFields(tool);
    validateFieldConditions(tool);
    validateSamples(tool);
  }

  for (const tool of definitions) {
    if (
      tool.aliasOf &&
      !definitions.some((target) => target.id === tool.aliasOf && !target.aliasOf)
    ) {
      throw new ToolError(`Tool ${tool.id} references unknown canonical tool: ${tool.aliasOf}`);
    }

    for (const relatedId of tool.relatedToolIds ?? []) {
      if (!ids.has(relatedId)) {
        throw new ToolError(`Tool ${tool.id} references unknown related tool: ${relatedId}`);
      }

      const aliasOf = definitions.find((related) => related.id === relatedId)?.aliasOf;

      if (aliasOf) {
        throw new ToolError(
          `Tool ${tool.id} references alias ${relatedId} in relatedToolIds; use ${aliasOf}.`,
        );
      }
    }
  }

  return definitions.map(withDefaultKeywords);
}

export function withDefaultKeywords(tool: ToolDefinition): ToolDefinition {
  return { ...tool, keywords: tool.keywords?.length ? tool.keywords : defaultKeywords(tool) };
}

function defaultKeywords(tool: ToolDefinition): string[] {
  return [
    ...new Set(
      `${tool.name} ${tool.category} ${tool.description}`.toLowerCase().match(/[a-z0-9]+/g) ?? [],
    ),
  ];
}

function validateCapabilities(tool: ToolDefinition): void {
  const capabilities = tool.capabilities ?? [];

  if (new Set(capabilities).size !== capabilities.length) {
    throw new ToolError(`Tool ${tool.id} declares duplicate runtime capabilities.`);
  }

  for (const capability of capabilities) {
    if (!allowedCapabilities.has(capability)) {
      throw new ToolError(`Tool ${tool.id} declares unknown runtime capability: ${capability}`);
    }
  }
}

function validateResultActions(toolId: string, actions: string[] | undefined): void {
  for (const action of actions ?? []) {
    if (!allowedResultActions.has(action)) {
      throw new ToolError(`Tool ${toolId} declares unknown result action: ${action}`);
    }
  }
}

function validateFields(tool: ToolDefinition): void {
  const fieldIds = new Set<string>();

  for (const field of tool.fields ?? []) {
    if (fieldIds.has(field.id)) {
      throw new ToolError(`Tool ${tool.id} declares duplicate field: ${field.id}`);
    }

    fieldIds.add(field.id);

    if (field.type === 'select' || field.type === 'checkboxGroup') {
      const optionValues = new Set(field.options.map((option) => option.value));

      if (optionValues.size !== field.options.length) {
        throw new ToolError(`Tool ${tool.id} field ${field.id} declares duplicate option values.`);
      }

      const defaultValues = fieldDefaultValues(field);

      if (defaultValues.some((value) => !optionValues.has(value))) {
        throw new ToolError(`Tool ${tool.id} field ${field.id} has an invalid default value.`);
      }
    }
  }
}

// A checkbox group stores its default as a comma-separated list of option values.
function fieldDefaultValues(field: ToolField): string[] {
  if (field.type === 'checkboxGroup') return field.defaultValue?.split(',').filter(Boolean) ?? [];

  return field.defaultValue ? [field.defaultValue] : [];
}

function validateFieldConditions(tool: ToolDefinition): void {
  const fields = new Map((tool.fields ?? []).map((field) => [field.id, field]));
  // File fields keep the chosen file name in a companion `<id>Name` value.
  const valueIds = new Set(
    (tool.fields ?? []).flatMap((field) =>
      field.type === 'file' ? [field.id, `${field.id}Name`] : [field.id],
    ),
  );

  for (const field of tool.fields ?? []) {
    for (const condition of flattenConditions(field.visibleWhen)) {
      if (condition.field === field.id)
        throw new ToolError(
          `Tool ${tool.id} field ${field.id} depends on unknown field: ${field.id}`,
        );

      validateCondition(tool, `field ${field.id}`, condition);
    }
  }

  for (const condition of flattenConditions(tool.inputVisibleWhen))
    validateCondition(tool, 'inputVisibleWhen', condition);
  for (const condition of flattenConditions(tool.fileModeWhen))
    validateCondition(tool, 'fileModeWhen', condition);

  for (const requirement of tool.runRequires ?? []) {
    for (const condition of flattenConditions(requirement.when))
      validateCondition(tool, 'runRequires', condition);

    const unknown = requirement.anyOf.find((id) => id !== '$text' && !valueIds.has(id));

    if (unknown) throw new ToolError(`Tool ${tool.id} runRequires unknown field: ${unknown}`);
  }

  const { selectionTarget } = tool;

  if (selectionTarget) {
    for (const [field, value] of [
      [selectionTarget.field, undefined],
      ...Object.entries(selectionTarget.fields ?? {}),
    ] as Array<[string, string | undefined]>) {
      const target = fields.get(field);

      if (!target)
        throw new ToolError(`Tool ${tool.id} selectionTarget uses unknown field: ${field}`);
      if (value !== undefined && isOptionField(target) && !hasOption(target, value))
        throw new ToolError(`Tool ${tool.id} selectionTarget uses an unknown ${field} option.`);
    }
  }

  const modes = Object.keys(tool.inputPresentation?.byMode ?? {});
  const modeField = fields.get('mode');

  if (
    modes.length > 0 &&
    (modeField?.type !== 'select' ||
      modes.some((mode) => !modeField.options.some((option) => option.value === mode)))
  ) {
    throw new ToolError(`Tool ${tool.id} declares input presentation for an unknown mode.`);
  }
}

function validateCondition(
  tool: ToolDefinition,
  owner: string,
  condition: Exclude<ToolFieldCondition, { anyOf: ToolFieldCondition[] }>,
): void {
  const target = tool.fields?.find((field) => field.id === condition.field);

  if (!target)
    throw new ToolError(`Tool ${tool.id} ${owner} depends on unknown field: ${condition.field}`);

  const values = [...(condition.is ?? []), ...(condition.isNot ?? [])];

  if (values.length === 0)
    throw new ToolError(`Tool ${tool.id} ${owner} has an empty visibility condition.`);

  if (isOptionField(target) && values.some((value) => !hasOption(target, value)))
    throw new ToolError(
      `Tool ${tool.id} ${owner} depends on an unknown ${condition.field} option.`,
    );
}

function isOptionField(
  field: ToolField,
): field is Extract<ToolField, { type: 'select' | 'checkboxGroup' }> {
  return field.type === 'select' || field.type === 'checkboxGroup';
}

function hasOption(field: Extract<ToolField, { type: 'select' | 'checkboxGroup' }>, value: string) {
  return field.options.some((option) => option.value === value);
}

function flattenConditions(
  conditions: ToolFieldCondition | ToolFieldCondition[] | undefined,
): Array<Exclude<ToolFieldCondition, { anyOf: ToolFieldCondition[] }>> {
  return [conditions ?? []]
    .flat()
    .flatMap((condition) =>
      'anyOf' in condition ? flattenConditions(condition.anyOf) : [condition],
    );
}

function validateSamples(tool: ToolDefinition): void {
  // File fields keep the chosen file name in a companion `<id>Name` value, which samples may set
  // too.
  const fieldIds = new Set(
    (tool.fields ?? []).flatMap((field) =>
      field.type === 'file' ? [field.id, `${field.id}Name`] : [field.id],
    ),
  );

  for (const sample of tool.samples ?? []) {
    for (const fieldId of Object.keys(sample.fields ?? {})) {
      if (!fieldIds.has(fieldId)) {
        throw new ToolError(
          `Tool ${tool.id} sample "${sample.label}" references unknown field: ${fieldId}`,
        );
      }
    }
  }
}
