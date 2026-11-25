import {
  hasMissingRequiredField,
  isToolFieldHidden,
  isToolInputHidden,
  toolConditionsHold,
  toolFieldValue,
} from './fieldPresentation';
import type { SerializedToolDefinition, ToolDefinition, ToolRunRequirement } from './types';

export type AnyToolDefinition =
  | Pick<
      ToolDefinition,
      | 'aliasOf'
      | 'id'
      | 'inputKind'
      | 'requiresInput'
      | 'fields'
      | 'inputVisibleWhen'
      | 'runRequires'
      | 'textConversion'
    >
  | Pick<
      SerializedToolDefinition,
      | 'aliasOf'
      | 'id'
      | 'inputKind'
      | 'requiresInput'
      | 'fields'
      | 'inputVisibleWhen'
      | 'runRequires'
      | 'textConversion'
    >;

export function canRunTool(
  tool: AnyToolDefinition | undefined,
  text: string,
  fields: Record<string, string>,
): boolean {
  if (!tool) {
    return false;
  }

  if (hasMissingRequiredField(tool, fields)) {
    return false;
  }

  if (tool.runRequires) {
    return tool.runRequires.every((requirement) =>
      isRunRequirementMet(tool, requirement, text, fields),
    );
  }

  const isInputHidden = isToolInputHidden(tool, fields);

  if (tool.textConversion) {
    return isInputHidden || text.length > 0;
  }

  const fileFields = tool.fields?.filter((f) => f.type === 'file') ?? [];

  if (fileFields.length > 0 && tool.inputKind === 'none') {
    return fileFields.some((f) => Boolean(fields[f.id]?.trim()));
  }

  if (isInputHidden) {
    return true;
  }

  if (tool.inputKind === 'text') {
    return Boolean(text.trim());
  }

  if (tool.requiresInput) {
    if (tool.inputKind === 'optionalText') {
      return Boolean(
        text.trim() || Object.values(fields).some((value) => value.trim() && value !== 'false'),
      );
    }

    return Boolean(text.trim());
  }

  return true;
}

function isRunRequirementMet(
  tool: AnyToolDefinition,
  requirement: ToolRunRequirement,
  text: string,
  fields: Record<string, string>,
): boolean {
  if (!toolConditionsHold(tool, requirement.when, fields)) return true;

  return requirement.anyOf.some((member) =>
    member === '$text'
      ? !isToolInputHidden(tool, fields) && Boolean(text.trim())
      : !isToolFieldHidden(tool, member, fields) &&
        Boolean(toolFieldValue(tool, member, fields).trim()),
  );
}
