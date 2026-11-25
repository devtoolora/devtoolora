import type {
  ToolDefinition,
  ToolFieldCondition,
  ToolInputPresentation,
  ToolPreviewKind,
} from './types';

/** Structural so the VS Code webview's own field type fits too. */
type FieldTool = {
  fields?: Array<{
    defaultValue?: string;
    id: string;
    required?: boolean;
    type?: string;
    visibleWhen?: ToolFieldCondition | ToolFieldCondition[];
  }>;
};
type PresentableTool = FieldTool & Pick<ToolDefinition, 'inputPresentation'>;
type InputTool = FieldTool & Pick<ToolDefinition, 'inputVisibleWhen'>;
type FileModeTool = FieldTool & Pick<ToolDefinition, 'fileModeWhen'>;

export function isToolFieldHidden(
  tool: FieldTool,
  fieldId: string,
  values: Record<string, string>,
): boolean {
  const field = tool.fields?.find((candidate) => candidate.id === fieldId);

  return !toolConditionsHold(tool, field?.visibleWhen, values);
}

export function isToolInputHidden(tool: InputTool, values: Record<string, string>): boolean {
  return !toolConditionsHold(tool, tool.inputVisibleWhen, values);
}

export function isToolFileMode(tool: FileModeTool, values: Record<string, string>): boolean {
  return tool.fileModeWhen !== undefined && toolConditionsHold(tool, tool.fileModeWhen, values);
}

export function toolConditionsHold(
  tool: FieldTool,
  conditions: ToolFieldCondition | ToolFieldCondition[] | undefined,
  values: Record<string, string>,
): boolean {
  return [conditions ?? []].flat().every((condition) => conditionHolds(tool, condition, values));
}

function conditionHolds(
  tool: FieldTool,
  condition: ToolFieldCondition,
  values: Record<string, string>,
): boolean {
  if ('anyOf' in condition)
    return condition.anyOf.some((nested) => conditionHolds(tool, nested, values));

  const value = toolFieldValue(tool, condition.field, values);

  return (
    (condition.is === undefined || condition.is.includes(value)) &&
    !(condition.isNot?.includes(value) ?? false)
  );
}

/** True while a visible required field is blank; a password of only spaces is a real password. */
export function hasMissingRequiredField(tool: FieldTool, values: Record<string, string>): boolean {
  return (tool.fields ?? []).some((field) => {
    const value = values[field.id] ?? field.defaultValue ?? '';

    return (
      field.required &&
      !isToolFieldHidden(tool, field.id, values) &&
      (field.type === 'password' ? value === '' : !value.trim())
    );
  });
}

export function resolveToolInputPresentation(
  tool: PresentableTool,
  values: Record<string, string>,
): ToolInputPresentation | undefined {
  const presentation = tool.inputPresentation;

  if (!presentation) return undefined;

  const byMode = presentation.byMode?.[toolFieldValue(tool, 'mode', values)];

  return byMode ?? { label: presentation.label, placeholder: presentation.placeholder };
}

export function isCssDesignPreview(preview: ToolPreviewKind | undefined): boolean {
  return preview?.startsWith('css-') ?? false;
}

export function toolFieldValue(
  tool: FieldTool,
  fieldId: string,
  values: Record<string, string>,
): string {
  return values[fieldId] ?? tool.fields?.find((field) => field.id === fieldId)?.defaultValue ?? '';
}
