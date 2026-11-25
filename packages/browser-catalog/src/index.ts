import {
  createToolRegistry,
  serializeToolDefinition,
  serializeToolDefinitions,
  SerializedToolDefinition,
  ToolDefinition,
  ToolInput,
  ToolResult,
  withDefaultKeywords,
} from '@devtoolora/core';
import { domainTools } from '@devtoolora/tools';

export const browserWorkerTools: ToolDefinition[] = Object.values(domainTools)
  .flat()
  .map(withDefaultKeywords);

const registry = createToolRegistry(browserWorkerTools);

export function listBrowserWorkerTools(): SerializedToolDefinition[] {
  return serializeToolDefinitions(registry.tools);
}

export function getBrowserWorkerTool(id: string): SerializedToolDefinition {
  return serializeToolDefinition(registry.getTool(id));
}

export function runBrowserWorkerTool(id: string, input: ToolInput): Promise<ToolResult> {
  return registry.runToolWithCapability(id, input, 'browserWorker');
}
