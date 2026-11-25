import { ToolDefinition } from '@devtoolora/core';
import { creditCardValidatorTool } from './credit-card-validator/tool';
import { gtinValidatorTool } from './gtin-validator/tool';
import { ibanValidatorTool } from './iban-validator/tool';
import { numberFormatterTool } from './number-formatter/tool';
import { fakeDataGeneratorTool, seededFakeDataTool } from './fake-data-generator/tool';
import { vatValidatorTool } from './vat-validator/tool';
import { isoCodesTool } from './iso-codes/tool';
import { phoneFormatterTool } from './phone-formatter/tool';

export * from './credit-card-validator/tool';
export * from './fake-data-generator/tool';
export * from './gtin-validator/tool';
export * from './number-formatter/tool';
export * from './iban-validator/tool';
export * from './phone-formatter/tool';
export * from './vat-validator/tool';
export * from './iso-codes/tool';

export const generalDataTools: ToolDefinition[] = [
  fakeDataGeneratorTool,
  seededFakeDataTool,
  numberFormatterTool,
];

export const dataTools: ToolDefinition[] = [
  ibanValidatorTool,
  phoneFormatterTool,
  ...generalDataTools,
  creditCardValidatorTool,
  gtinValidatorTool,
  vatValidatorTool,
  isoCodesTool,
];
