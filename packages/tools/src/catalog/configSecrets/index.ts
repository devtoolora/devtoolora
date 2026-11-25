import { ToolDefinition } from '@devtoolora/core';
import { dotenvConverterTool, dotenvExampleTool } from './dotenv-converter/tool';
import { dotenvFormatterTool } from './dotenv-formatter/tool';
import { dotenvValidatorTool } from './dotenv-validator/tool';
import { secretRedactorTool } from './secret-redactor/tool';

export * from './dotenv-converter/tool';
export * from './dotenv-formatter/tool';
export * from './dotenv-validator/tool';
export * from './secret-redactor/tool';

export const configSecretTools: ToolDefinition[] = [
  dotenvFormatterTool,
  dotenvValidatorTool,
  secretRedactorTool,
  dotenvConverterTool,
  dotenvExampleTool,
];
