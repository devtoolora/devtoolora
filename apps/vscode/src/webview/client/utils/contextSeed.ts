import type { SerializedToolDefinition } from '@devtoolora/core';
import type { ToolInputSeed } from '@devtoolora/tool-ui';

export function seedFromContext(
  tool: SerializedToolDefinition,
  text: string,
  key: string,
): ToolInputSeed | undefined {
  if (tool.selectionTarget) {
    return { fields: { ...tool.selectionTarget.fields, [tool.selectionTarget.field]: text }, key };
  }

  if (tool.inputKind === 'text' || tool.inputKind === 'optionalText') return { key, text };

  return undefined;
}
