import type { ToolDefinition } from '@devtoolora/core';
import { dateCalculatorTool } from './date-calculator/tool';
import { durationConverterTool } from './duration-converter/tool';
import { timeZoneConverterTool } from './time-zone-converter/tool';

export * from './date-calculator/tool';
export * from './duration-converter/tool';
export * from './time-zone-converter/tool';

export const dateTimeTools: ToolDefinition[] = [
  timeZoneConverterTool,
  durationConverterTool,
  dateCalculatorTool,
];
