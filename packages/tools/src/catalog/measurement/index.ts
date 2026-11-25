import { ToolDefinition } from '@devtoolora/core';
import { unitConverterTool } from './unit-converter/tool';
import { temperatureConverterTool } from './temperature-converter/tool';

export * from './temperature-converter/tool';
export * from './unit-converter/tool';

export const measurementTools: ToolDefinition[] = [temperatureConverterTool, unitConverterTool];
