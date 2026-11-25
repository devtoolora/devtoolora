import { ToolDefinition } from '@devtoolora/core';
import { mathEvaluatorTool } from './math-evaluator/tool';
import { baseConverterTool } from './base-converter/tool';
import { percentageCalculatorTool } from './percentage-calculator/tool';
import { financialCalculatorTool } from './financial-calculator/tool';
import { ieee754InspectorTool } from './ieee754-inspector/tool';
import { romanNumeralsTool } from './roman-numerals/tool';
import { statisticsCalculatorTool } from './statistics-calculator/tool';
import { numberTheoryTool } from './number-theory/tool';
import { diceRollerTool, randomNumberTool } from './random-number/tool';

export * from './math-evaluator/tool';
export * from './base-converter/tool';
export * from './percentage-calculator/tool';
export * from './financial-calculator/tool';
export * from './ieee754-inspector/tool';
export * from './roman-numerals/tool';
export * from './statistics-calculator/tool';
export * from './number-theory/tool';
export * from './random-number/tool';

export const mathTools: ToolDefinition[] = [
  mathEvaluatorTool,
  baseConverterTool,
  percentageCalculatorTool,
  financialCalculatorTool,
  ieee754InspectorTool,
  romanNumeralsTool,
  statisticsCalculatorTool,
  numberTheoryTool,
  randomNumberTool,
  diceRollerTool,
];
