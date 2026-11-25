import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { textStatistics, TextStatistics } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

function readableReport(stats: TextStatistics): string {
  return [
    'TEXT STATISTICS',
    '',
    `Words: ${stats.words}`,
    `Visible characters (graphemes): ${stats.graphemes}`,
    `Unicode code points: ${stats.characters}`,
    `UTF-16 units: ${stats.utf16Units}`,
    `UTF-8 bytes: ${stats.bytes}`,
    '',
    `Lines: ${stats.lines}`,
    `Non-blank lines: ${stats.nonEmptyLines}`,
    `Letter code points: ${stats.letters}`,
    `Decimal digit code points: ${stats.digits}`,
    `Punctuation / symbol code points: ${stats.symbols}`,
    `Whitespace code points: ${stats.whitespace}`,
    '',
    `Estimated reading time: ${stats.readingTimeSeconds} seconds`,
    `Rounded up to minutes: ${stats.readingTimeMinutes}`,
    `Reading speed: ${stats.wordsPerMinute} words/minute`,
  ].join('\n');
}

export const textStatisticsTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Understand Unicode text length, words, lines, UTF-8 size and estimated reading time.',
  fields: [
    {
      defaultValue: 'report',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Readable report', value: 'report' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'en',
      help: 'Used for word segmentation, independent of your device language.',
      id: 'locale',
      label: 'Word language',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Czech', value: 'cs' },
        { label: 'Chinese', value: 'zh' },
        { label: 'Japanese', value: 'ja' },
        { label: 'Thai', value: 'th' },
      ],
      type: 'select',
    },
    {
      defaultValue: '200',
      help: 'An estimate, not a measurement of a reader. Whole numbers from 50 to 1,000.',
      id: 'wordsPerMinute',
      label: 'Reading speed (words/minute)',
      type: 'number',
    },
  ],
  id: 'text-statistics',
  inputKind: 'optionalText',
  keywords: ['word count', 'character count', 'unicode', 'grapheme', 'utf8', 'reading time'],
  name: 'Text Statistics',
  outputKind: 'text',
  relatedToolIds: ['case-convert', 'zero-width-detector', 'whitespace-cleaner', 'token-estimator'],
  requiresInput: false,
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = fields.output ?? 'report';
      const locale = fields.locale ?? 'en';
      const speed = fields.wordsPerMinute ?? '200';

      if (output !== 'report' && output !== 'json')
        throw new ToolError('Choose a readable report or JSON output.');
      if (
        locale !== 'en' &&
        locale !== 'cs' &&
        locale !== 'zh' &&
        locale !== 'ja' &&
        locale !== 'th'
      )
        throw new ToolError('Choose a supported word language.');
      if (!/^\d{2,4}$/.test(speed))
        throw new ToolError('Reading speed must be a whole number from 50 to 1,000.');

      const stats = textStatistics(text, { locale, wordsPerMinute: Number(speed) });
      const report = output === 'json' ? JSON.stringify(stats, null, 2) : readableReport(stats);

      return {
        artifact: {
          base64: encodeBase64Text(report),
          fileName: `text-statistics.${output === 'json' ? 'json' : 'txt'}`,
          mimeType:
            output === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: output === 'json' ? 'json' : 'plaintext',
        summary: `${stats.words} words · ${stats.graphemes} graphemes · ${stats.bytes} UTF-8 bytes · estimated ${stats.readingTimeSeconds}s at ${stats.wordsPerMinute} words/minute.`,
        text: report,
      };
    }),
  samples: [
    {
      fields: { locale: 'en', output: 'report', wordsPerMinute: '200' },
      label: 'Paragraph with numbers & symbols',
      text: 'The quick brown fox jumps over the lazy dog.\nPack my box with five dozen liquor jugs!\n12345 items processed at 99.9% accuracy.',
    },
    {
      fields: { locale: 'cs', output: 'report', wordsPerMinute: '200' },
      label: 'Czech and combining accents',
      text: 'Příliš žluťoučký kůň.\né e\u0301',
    },
    {
      fields: { locale: 'en', output: 'json', wordsPerMinute: '200' },
      label: 'Emoji and joined family',
      text: '😀 👨‍👩‍👧‍👦',
    },
    {
      fields: { locale: 'zh', output: 'report', wordsPerMinute: '200' },
      label: 'Words without spaces',
      text: '你好世界。中文文本统计。',
    },
    {
      fields: { locale: 'en', output: 'json', wordsPerMinute: '100' },
      label: 'Blank lines and trailing newline',
      text: 'one\n\n  \ntwo\n',
    },
    {
      fields: { locale: 'en', output: 'report', wordsPerMinute: '200' },
      label: 'Empty text',
      text: '',
    },
  ],
  supportsSelection: true,
};
