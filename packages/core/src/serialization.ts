import { SerializedToolDefinition, ToolDefinition } from './types';

export function serializeToolDefinition(tool: ToolDefinition): SerializedToolDefinition {
  const { run: _run, ...serializedTool } = tool;

  return serializedTool;
}

export function serializeToolDefinitions(tools: ToolDefinition[]): SerializedToolDefinition[] {
  return tools.map(serializeToolDefinition);
}
