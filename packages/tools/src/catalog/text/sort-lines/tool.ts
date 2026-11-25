import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { sortLinesDetailed, type SortLinesOptions } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { checkbox } from '../shared';

const defaults: Record<string, string> = {
  accentSensitive: 'true',
  blankLines: 'keep',
  caseSensitive: 'false',
  direction: 'asc',
  locale: 'en',
  numeric: 'true',
  ordering: 'locale',
  trimComparison: 'false',
};

export const sortLinesTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Sort physical lines with explicit language rules, natural number groups, stable ties and preserved separator-slot line endings.',
  fields: [
    {
      defaultValue: 'asc',
      id: 'direction',
      label: 'Direction',
      options: [
        { label: 'Ascending', value: 'asc' },
        { label: 'Descending', value: 'desc' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'locale',
      id: 'ordering',
      label: 'Comparison',
      options: [
        { label: 'Locale-aware', value: 'locale' },
        { label: 'Unicode code points', value: 'code-points' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'en',
      help: 'Supported BCP 47 locale: en, cs, de, sv or en-US. The summary reports the runtime’s resolved locale. Unknown languages are rejected.',
      id: 'locale',
      label: 'Collation locale',
      placeholder: 'en, cs, sv, de-DE',
      type: 'text',
      visibleWhen: { field: 'ordering', isNot: ['code-points'] },
    },
    {
      defaultValue: 'true',
      help: 'Compare digit runs naturally: item2 before item10. This is not a signed decimal, date, version or scientific-number parser.',
      id: 'numeric',
      label: 'Natural number groups',
      type: 'checkbox',
      visibleWhen: { field: 'ordering', isNot: ['code-points'] },
    },
    {
      defaultValue: 'false',
      help: 'Use locale case differences as a sorting distinction. Equal keys retain original order even descending.',
      id: 'caseSensitive',
      label: 'Distinguish letter case',
      type: 'checkbox',
      visibleWhen: { field: 'ordering', isNot: ['code-points'] },
    },
    {
      defaultValue: 'true',
      help: 'Use accent differences at secondary collation strength. Some accented letters are separate primary letters in a language even when this is off.',
      id: 'accentSensitive',
      label: 'Distinguish accents',
      type: 'checkbox',
      visibleWhen: { field: 'ordering', isNot: ['code-points'] },
    },
    {
      defaultValue: 'false',
      help: 'Strip leading/trailing ASCII spaces and tabs from comparison keys only. Original line bodies are never trimmed.',
      id: 'trimComparison',
      label: 'Ignore edge spaces for comparison',
      type: 'checkbox',
    },
    {
      defaultValue: 'keep',
      help: 'Blank means empty or containing only ASCII spaces/tabs. Keep positions fixes gap slots, not paragraph membership; nonblank lines are still sorted globally.',
      id: 'blankLines',
      label: 'Blank lines',
      options: [
        { label: 'Keep positions', value: 'keep' },
        { label: 'Sort normally', value: 'sort' },
        { label: 'Move first', value: 'first' },
        { label: 'Move last', value: 'last' },
        { label: 'Remove', value: 'remove' },
      ],
      type: 'select',
    },
  ],
  id: 'sort-lines',
  inputKind: 'optionalText',
  keywords: ['sort', 'lines', 'natural', 'locale', 'collation', 'alphabetical'],
  name: 'Sort Lines',
  outputKind: 'text',
  relatedToolIds: ['deduplicate-lines', 'text-reverser', 'text-diff', 'whitespace-cleaner'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const direction = fields.direction ?? 'asc';
    const ordering = fields.ordering ?? 'locale';
    const blankLines = fields.blankLines ?? 'keep';

    if (direction !== 'asc' && direction !== 'desc')
      throw new ToolError('Choose Ascending or Descending direction.');
    if (ordering !== 'locale' && ordering !== 'code-points')
      throw new ToolError('Choose Locale-aware or Unicode code points comparison.');
    if (
      blankLines !== 'keep' &&
      blankLines !== 'sort' &&
      blankLines !== 'first' &&
      blankLines !== 'last' &&
      blankLines !== 'remove'
    )
      throw new ToolError(
        'Choose Keep positions, Sort normally, Move first, Move last or Remove blank lines.',
      );

    const options: SortLinesOptions = {
      blankLines,
      direction,
      ordering,
      trimComparison: checkbox(
        fields,
        'trimComparison',
        'Ignore edge spaces for comparison',
        false,
      ),
    };

    if (ordering === 'locale') {
      options.accentSensitive = checkbox(fields, 'accentSensitive', 'Distinguish accents', true);
      options.caseSensitive = checkbox(fields, 'caseSensitive', 'Distinguish letter case', false);
      options.locale = fields.locale ?? 'en';
      options.numeric = checkbox(fields, 'numeric', 'Natural number groups', true);
    }

    const result = withToolError(() => sortLinesDetailed(text, options));

    return {
      artifact: {
        base64: encodeBase64Text(result.text),
        fileName: 'sorted-lines.txt',
        mimeType: 'text/plain;charset=utf-8',
      },
      language: 'plaintext',
      summary: `${result.text === text ? 'Unchanged' : 'Sorted'} · ${result.inputLines} input physical lines · ${result.outputLines} output physical lines · ${result.movedLines} moved source slots · ${result.removedBlankLines} blank lines removed · ${ordering === 'code-points' ? 'Unicode code points' : `locale ${result.locale}, collation ${result.collation}, ${options.numeric ? 'natural digit groups' : 'lexical digit groups'}`} · ${direction === 'asc' ? 'ascending' : 'descending'}.${result.lineStructureChanged ? ' Warning: empty-body placement joined CR/LF terminators or changed the terminal empty-line representation.' : ''}`,
      text: result.text,
    };
  },
  samples: [
    { fields: { ...defaults }, label: 'Natural filenames', text: 'item10\nitem2\nitem1' },
    {
      fields: { ...defaults, numeric: 'false' },
      label: 'Lexical digit order',
      text: 'item10\nitem2\nitem1',
    },
    {
      fields: { ...defaults, locale: 'cs' },
      label: 'Czech collation',
      text: 'chata\nžába\nčaj\nhad\ncena',
    },
    {
      fields: { ...defaults, accentSensitive: 'false', direction: 'desc' },
      label: 'Stable descending ties',
      text: 'résumé\nresume\nRESUME\nzebra',
    },
    {
      fields: { ...defaults },
      label: 'Preserve blank gap positions',
      text: 'zebra\n\nalpha\n  \nbeta\n',
    },
    {
      fields: { ...defaults, trimComparison: 'true' },
      label: 'Sort keys without trimming text',
      text: '  beta  \nalpha\n\tgamma\t',
    },
    { fields: { ...defaults }, label: 'Keep mixed line endings', text: 'zebra\r\nalpha\rbeta\n' },
    {
      fields: { ...defaults, ordering: 'code-points' },
      label: 'Exact code-point order',
      text: '😀\n\uE000\nA\na',
    },
    {
      fields: { ...defaults, blankLines: 'remove' },
      label: 'Remove blanks to empty',
      text: ' \t\r\n\r\n',
    },
    { fields: { ...defaults }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};
