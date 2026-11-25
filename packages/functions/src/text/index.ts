export { loadFigletFont } from './figletFontLoader';
export { describeInvisible, inspectInvisibleText, markInvisibleText } from './invisibles';
export type {
  InvisibleCharacterInfo,
  InvisibleGroup,
  InvisibleMatch,
  InvisibleOptions,
  InvisibleResult,
  InvisibleScope,
} from './invisibles';
export { adjustIndentation } from './indent';
export type { IndentationOptions, IndentationResult } from './indent';
export { stripDiacriticsDetailed } from './diacritics';
export type { StripDiacriticsOptions, StripDiacriticsResult } from './diacritics';
export { layoutText, unwrapText, wrapText } from './layout';
export type { TextLayoutOptions, TextLayoutResult } from './layout';
export { findReplace, findReplaceDetailed } from './replace';
export type { FindReplaceOptions, FindReplaceResult } from './replace';
export { numberLines, numberLinesDetailed } from './number';
export type { NumberLinesOptions, NumberLinesResult } from './number';
export { affixLines, affixLinesDetailed } from './affix';
export type { AffixLinesOptions, AffixLinesResult } from './affix';
export { deduplicateLines, deduplicateLinesDetailed } from './deduplicate';
export type { DeduplicateLinesOptions, DeduplicateLinesResult } from './deduplicate';
export { sortLines, sortLinesDetailed } from './sort';
export type { SortLinesOptions, SortLinesResult } from './sort';
export { reverseText, reverseTextDetailed } from './reverse';
export type { ReverseMode, ReverseOptions, ReverseResult } from './reverse';
export { cleanWhitespace, cleanWhitespaceDetailed } from './whitespace';
export type { WhitespaceOptions, WhitespaceResult, WhitespaceStatistics } from './whitespace';
export { generateFigletText, renderAsciiArt } from './asciiArt';
export type { AsciiArtOptions, AsciiArtResult } from './asciiArt';

export { convertCase, isTextCase, slugify } from './naming';
export type { CaseOptions, SlugOptions, TextCase } from './naming';
export { processMarkdown } from './markdown';
export type { MarkdownOptions, MarkdownResult } from './markdown';
export { markdownToHtml, renderMarkdownHtml } from './markdownHtml';
export type { MarkdownHtmlOptions, MarkdownHtmlResult, MarkdownPreviewNode } from './markdownHtml';
export { compareTextLines, diffLines, formatTextDiff } from './diff';
export type { TextDiffLine, TextDiffOptions, TextDiffResult, TextDiffRow } from './diff';
export { generateLoremIpsum, loremIpsum } from './lorem';
export type { LoremOptions, LoremResult } from './lorem';
export { textStatistics } from './statistics';
export type { TextStatistics, TextStatisticsOptions } from './statistics';
export { testRegex } from './regex';
export { explainRegex } from './regexExplain';
export type { RegexExplanation } from './regexExplain';
export type { RegexMatch, RegexResult } from './regex';
export { convertList } from './list';
export type {
  ListConvertOptions,
  ListConvertResult,
  ListInputFormat,
  ListOutputFormat,
} from './list';
export { joinLines, splitText } from './joinSplit';
export type { JoinLinesOptions, JoinSplitResult, SplitTextOptions } from './joinSplit';
export { extractPatterns } from './extract';
export type { ExtractOptions, ExtractPattern, ExtractResult } from './extract';
export { convertLineEndings } from './lineEndings';
export type { LineEndingOptions, LineEndingResult } from './lineEndings';
export { shuffleLines } from './shuffle';
export type { ShuffleOptions, ShuffleResult } from './shuffle';
export { countFrequency } from './frequency';
export type { FrequencyOptions, FrequencyRow } from './frequency';
export { countSyllables, readability } from './readability';
export type { ReadabilityReport } from './readability';
export { fixTypography } from './typography';
export type { TypographyOptions } from './typography';
export { numbersToWords, numberToWords, separatorReadings } from './numberWords';
export type { NumberWordsStyle } from './numberWords';
export { formatMarkdownLint, lintMarkdown, markdownLintRules } from './markdownLint';
export type { MarkdownLintIssue, MarkdownLintResult, MarkdownLintRule } from './markdownLint';
export { githubSlug, markdownToc } from './markdownToc';
export type { TocOptions } from './markdownToc';
export { cleanLines } from './lineCleanup';
export type { LineCleanupOptions, LineCleanupResult } from './lineCleanup';
