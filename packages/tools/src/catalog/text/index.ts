import { ToolDefinition } from '@devtoolora/core';
import { asciiTextGeneratorTool } from './ascii-text-generator/tool';
import { caseConvertTool } from './case-convert/tool';
import { slugifyTool } from './slugify/tool';
import { textStatisticsTool } from './text-statistics/tool';
import { markdownHelperTool } from './markdown-helper/tool';
import { regexTestTool } from './regex-test/tool';
import { markdownToHtmlTool } from './markdown-to-html/tool';
import { textDiffTool } from './text-diff/tool';
import { loremIpsumTool } from './lorem-ipsum/tool';
import { whitespaceCleanerTool } from './whitespace-cleaner/tool';
import { textReverserTool } from './text-reverser/tool';
import { sortLinesTool } from './sort-lines/tool';
import { deduplicateLinesTool } from './deduplicate-lines/tool';
import { prefixSuffixLinesTool } from './prefix-suffix-lines/tool';
import { numberLinesTool } from './number-lines/tool';
import { findReplaceTool } from './find-replace/tool';
import { wrapTextTool } from './wrap-text/tool';
import { stripDiacriticsTool } from './strip-diacritics/tool';
import { indentDedentTool } from './indent-dedent/tool';
import { zeroWidthDetectorTool } from './zero-width-detector/tool';
import { wordFrequencyTool } from './word-frequency/tool';
import { readabilityScoreTool } from './readability-score/tool';
import { typographyFixerTool } from './typography-fixer/tool';
import { numberToWordsTool } from './number-to-words/tool';
import { markdownTocTool } from './markdown-toc/tool';
import { htmlToTextTool } from './html-to-text/tool';
import { htmlToMarkdownTool } from './html-to-markdown/tool';
import { removeBlankLinesTool, removeLineNumbersTool } from './remove-blank-lines/tool';
import { markdownLinterTool } from './markdown-linter/tool';
import { regexExplainerTool } from './regex-explainer/tool';

export * from './slugify/tool';
export * from './case-convert/tool';
export * from './text-statistics/tool';
export * from './markdown-helper/tool';
export * from './regex-test/tool';
export * from './markdown-to-html/tool';
export * from './text-diff/tool';
export * from './lorem-ipsum/tool';
export * from './ascii-text-generator/tool';
export * from './whitespace-cleaner/tool';
export * from './text-reverser/tool';
export * from './sort-lines/tool';
export * from './deduplicate-lines/tool';
export * from './prefix-suffix-lines/tool';
export * from './number-lines/tool';
export * from './find-replace/tool';
export * from './wrap-text/tool';
export * from './strip-diacritics/tool';
export * from './indent-dedent/tool';
export * from './zero-width-detector/tool';
export * from './word-frequency/tool';
export * from './readability-score/tool';
export * from './typography-fixer/tool';
export * from './number-to-words/tool';
export * from './markdown-toc/tool';
export * from './html-to-text/tool';
export * from './html-to-markdown/tool';
export * from './remove-blank-lines/tool';
export * from './regex-explainer/tool';
export * from './markdown-linter/tool';

export const browserTextTools: ToolDefinition[] = [
  slugifyTool,
  caseConvertTool,
  textStatisticsTool,
  markdownHelperTool,
  regexTestTool,
  markdownToHtmlTool,
  textDiffTool,
  loremIpsumTool,
  asciiTextGeneratorTool,
  whitespaceCleanerTool,
  textReverserTool,
  sortLinesTool,
  deduplicateLinesTool,
  prefixSuffixLinesTool,
  numberLinesTool,
  findReplaceTool,
  wrapTextTool,
  stripDiacriticsTool,
  indentDedentTool,
  zeroWidthDetectorTool,
  wordFrequencyTool,
  readabilityScoreTool,
  typographyFixerTool,
  numberToWordsTool,
  markdownTocTool,
  htmlToTextTool,
  htmlToMarkdownTool,
  removeBlankLinesTool,
  removeLineNumbersTool,
  regexExplainerTool,
  markdownLinterTool,
];
