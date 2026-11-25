import { ToolDefinition } from '@devtoolora/core';
import { jsonSchemaGeneratorTool } from './json-schema-generator/tool';
import { jsonSchemaToTypeScriptTool } from './json-schema-to-typescript/tool';
import { jsonSchemaToZodTool } from './json-schema-to-zod/tool';
import { jsonSchemaValidatorTool } from './json-schema-validator/tool';
import {
  jsonToCsharpTool,
  jsonToCodeTypesTool,
  jsonToGoTool,
  jsonToJavaTool,
  jsonToKotlinTool,
  jsonToPythonTool,
  jsonToRustTool,
  jsonToSwiftTool,
} from './json-to-code-types/tool';
import { jsonToTypeScriptTool } from './json-to-typescript/tool';
import { jsonToZodTool } from './json-to-zod/tool';
import { csvProfilerTool } from './csv-profiler/tool';

export * from './json-schema-generator/tool';
export * from './json-schema-validator/tool';
export * from './json-to-typescript/tool';
export * from './json-to-zod/tool';
export * from './csv-profiler/tool';
export * from './json-to-code-types/tool';
export * from './json-schema-to-typescript/tool';
export * from './json-schema-to-zod/tool';

export const browserSchemaTypeTools: ToolDefinition[] = [
  jsonSchemaGeneratorTool,
  jsonSchemaValidatorTool,
  jsonToTypeScriptTool,
  jsonToZodTool,
  csvProfilerTool,
  jsonToCodeTypesTool,
  jsonToGoTool,
  jsonToRustTool,
  jsonToKotlinTool,
  jsonToJavaTool,
  jsonToCsharpTool,
  jsonToPythonTool,
  jsonToSwiftTool,
  jsonSchemaToTypeScriptTool,
  jsonSchemaToZodTool,
];
