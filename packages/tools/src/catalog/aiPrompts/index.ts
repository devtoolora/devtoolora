import type { ToolDefinition } from '@devtoolora/core';
import { functionSchemaBuilderTool } from './function-schema-builder/tool';
import { jsonlDatasetValidatorTool } from './jsonl-dataset-validator/tool';
import { promptTemplateRendererTool } from './prompt-template-renderer/tool';
import { textChunkerTool, textSplitterTool } from './text-chunker/tool';
import { tokenCounterTool, tokenEstimatorTool } from './token-estimator/tool';

export * from './function-schema-builder/tool';
export * from './jsonl-dataset-validator/tool';
export * from './prompt-template-renderer/tool';
export * from './text-chunker/tool';
export * from './token-estimator/tool';

export const aiPromptTools: ToolDefinition[] = [
  tokenEstimatorTool,
  tokenCounterTool,
  textChunkerTool,
  textSplitterTool,
  promptTemplateRendererTool,
  jsonlDatasetValidatorTool,
  functionSchemaBuilderTool,
];
