import { isToolFileMode, isToolInputHidden, type SerializedToolDefinition } from '@devtoolora/core';
import { ToolDraft, WebviewState } from '../types';

const DEFAULT_EDITOR_SPLIT_PERCENT = 50;

export const MIN_EDITOR_SPLIT_PERCENT = 30;
export const MAX_EDITOR_SPLIT_PERCENT = 70;

export function clampEditorSplitPercent(percent: number | undefined): number {
  if (percent === undefined || !Number.isFinite(percent)) {
    return DEFAULT_EDITOR_SPLIT_PERCENT;
  }

  return Math.min(
    Math.max(Math.round(percent), MIN_EDITOR_SPLIT_PERCENT),
    MAX_EDITOR_SPLIT_PERCENT,
  );
}

export function normalizeToolDrafts(
  tools: SerializedToolDefinition[],
  toolDrafts: WebviewState['toolDrafts'],
): Record<string, ToolDraft> {
  const drafts: Record<string, ToolDraft> = {};

  for (const tool of tools) {
    const draft = toolDrafts?.[tool.id];

    if (
      !draft ||
      typeof draft.input !== 'string' ||
      !draft.fields ||
      typeof draft.fields !== 'object'
    ) {
      continue;
    }

    const fileNames = new Set(
      (tool.fields ?? [])
        .filter((field) => field.type === 'file')
        .map((field) => `${field.id}Name`),
    );
    const fields: Record<string, string> = {};

    for (const field of tool.fields ?? []) {
      const value = draft.fields[field.id];

      if (
        field.type !== 'file' &&
        field.type !== 'password' &&
        !fileNames.has(field.id) &&
        typeof value === 'string'
      ) {
        fields[field.id] = value;
      }
    }

    const hasNoInput = isToolFileMode(tool, fields) || isToolInputHidden(tool, fields);

    drafts[tool.id] = { input: hasNoInput ? '' : draft.input, fields };
  }

  return drafts;
}

// Never keeps files, passwords or sensitive values, nor input text in file mode, while the main
// input is hidden, or for sensitive-input tools.
export function draftFromInputs(
  tool: SerializedToolDefinition,
  text: string,
  fields: Record<string, string>,
): ToolDraft | undefined {
  const toolFields = tool.fields ?? [];
  const fileFieldIds = toolFields.filter((field) => field.type === 'file').map((field) => field.id);
  const excludedIds = new Set([
    ...fileFieldIds,
    ...fileFieldIds.map((fieldId) => `${fieldId}Name`),
    ...toolFields
      .filter((field) => field.type === 'password' || field.sensitive)
      .map((field) => field.id),
  ]);
  const keptFields = Object.fromEntries(
    Object.entries(fields).filter(([fieldId]) => !excludedIds.has(fieldId)),
  );
  const input =
    isToolFileMode(tool, keptFields) || isToolInputHidden(tool, keptFields) || tool.sensitiveInput
      ? ''
      : text;
  const isDefault =
    input === '' &&
    Object.entries(keptFields).every(
      ([fieldId, value]) =>
        value === (toolFields.find((field) => field.id === fieldId)?.defaultValue ?? ''),
    );

  return isDefault ? undefined : { fields: keptFields, input };
}
