import type { ToolDefinition } from '@devtoolora/core';
import { joinSplitLinesTool } from './join-split-lines/tool';
import { listConverterTool } from './list-converter/tool';
import { lineEndingConverterTool } from './line-ending-converter/tool';
import { patternExtractorTool } from './pattern-extractor/tool';
import { shuffleLinesTool } from './shuffle-lines/tool';

export * from './join-split-lines/tool';
export * from './list-converter/tool';
export * from './line-ending-converter/tool';
export * from './pattern-extractor/tool';
export * from './shuffle-lines/tool';

export const textListTools: ToolDefinition[] = [
  listConverterTool,
  joinSplitLinesTool,
  patternExtractorTool,
  lineEndingConverterTool,
  shuffleLinesTool,
];
