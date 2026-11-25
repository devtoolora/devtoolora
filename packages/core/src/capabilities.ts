import { ToolDefinition, ToolRuntimeCapability } from './types';

type ToolWithCapabilities = Pick<ToolDefinition, 'capabilities'>;

export function toolSupportsCapability(
  tool: ToolWithCapabilities,
  capability: ToolRuntimeCapability,
): boolean {
  return tool.capabilities?.includes(capability) ?? false;
}

export function filterToolsByCapability<T extends ToolWithCapabilities>(
  tools: T[],
  capability: ToolRuntimeCapability,
): T[] {
  return tools.filter((tool) => toolSupportsCapability(tool, capability));
}
