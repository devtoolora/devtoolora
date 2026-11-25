import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { affixLinesDetailed } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const defaults: Record<string, string> = {
  blankLines: 'skip',
  mode: 'add',
  placement: 'line-start',
  prefix: '',
  repeat: 'always',
  suffix: '',
};

function affixOutcome(changedLines: number, mode: string): string {
  if (changedLines === 0) return 'Unchanged';

  return mode === 'add' ? 'Affixes added' : 'Affixes removed';
}

export const prefixSuffixLinesTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Add or remove literal line prefixes and suffixes, preserve indentation and raw line endings, and choose how blank or already-affixed lines behave.',
  fields: [
    {
      defaultValue: 'add',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Add', value: 'add' },
        { label: 'Remove', value: 'remove' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '',
      help: 'Literal single-line text; spaces are significant. Backslash sequences and regex syntax are not interpreted.',
      id: 'prefix',
      label: 'Prefix',
      placeholder: '- ',
      type: 'text',
    },
    {
      defaultValue: '',
      help: 'Placed before the original line terminator. Matching includes any trailing spaces in the body.',
      id: 'suffix',
      label: 'Suffix',
      placeholder: ';',
      type: 'text',
    },
    {
      defaultValue: 'line-start',
      help: 'After indentation preserves leading ASCII spaces/tabs and places or matches the prefix after them. Suffix matching still uses the body end.',
      id: 'placement',
      label: 'Prefix placement',
      options: [
        { label: 'Line start', value: 'line-start' },
        { label: 'After indentation', value: 'after-indent' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'skip',
      help: 'Blank means empty or only ASCII spaces/tabs. NBSP and zero-width characters count as content. A final newline does not create an extra row.',
      id: 'blankLines',
      label: 'Blank lines',
      options: [
        { label: 'Skip', value: 'skip' },
        { label: 'Include', value: 'include' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'always',
      help: 'Missing is checked separately at each original body boundary, case-sensitively. It does not parse nesting or detect marker syntax.',
      id: 'repeat',
      label: 'Existing affixes',
      options: [
        { label: 'Always add', value: 'always' },
        { label: 'Add only if missing', value: 'if-missing' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', isNot: ['remove'] },
    },
  ],
  id: 'prefix-suffix-lines',
  inputKind: 'optionalText',
  keywords: ['prefix', 'suffix', 'affix', 'lines', 'bullets', 'comment', 'wrap'],
  name: 'Prefix/Suffix Lines',
  outputKind: 'text',
  relatedToolIds: ['number-lines', 'find-replace', 'whitespace-cleaner', 'text-diff'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const blankLines = fields.blankLines ?? 'skip';
    const mode = fields.mode ?? 'add';
    const placement = fields.placement ?? 'line-start';
    const repeat = mode === 'remove' ? 'always' : (fields.repeat ?? 'always');

    if (blankLines !== 'skip' && blankLines !== 'include')
      throw new ToolError('Choose Skip or Include blank lines.');
    if (mode !== 'add' && mode !== 'remove') throw new ToolError('Choose Add or Remove mode.');
    if (placement !== 'line-start' && placement !== 'after-indent')
      throw new ToolError('Choose Line start or After indentation.');
    if (repeat !== 'always' && repeat !== 'if-missing')
      throw new ToolError('Choose Always add or Add only if missing.');

    const result = withToolError(() =>
      affixLinesDetailed(text, {
        blankLines,
        mode,
        placement,
        prefix: fields.prefix ?? '',
        repeat,
        suffix: fields.suffix ?? '',
      }),
    );

    return {
      artifact: {
        base64: encodeBase64Text(result.text),
        fileName: 'affixed-lines.txt',
        mimeType: 'text/plain;charset=utf-8',
      },
      language: 'plaintext',
      summary: `${affixOutcome(result.changedLines, mode)} · ${result.inputLines} input physical lines · ${result.outputLines} output physical lines · ${result.changedLines} changed lines · ${result.prefixChanges} prefix changes · ${result.suffixChanges} suffix changes · ${result.skippedBlankLines} blank lines skipped.${result.lineStructureChanged ? ' Warning: empty bodies changed CR/LF boundaries or terminal empty-line representation.' : ''}`,
      text: result.text,
    };
  },
  samples: [
    { fields: { ...defaults, prefix: '- ' }, label: 'Markdown bullets', text: 'one\ntwo\n' },
    {
      fields: { ...defaults, placement: 'after-indent', prefix: '// ' },
      label: 'Comments after indentation',
      text: '  first();\n\tsecond();\n\n',
    },
    {
      fields: { ...defaults, prefix: '[', suffix: ']' },
      label: 'Wrap both boundaries',
      text: 'alpha\nbeta',
    },
    {
      fields: { ...defaults, prefix: '- ', repeat: 'if-missing' },
      label: 'Fill missing bullets',
      text: '- one\ntwo\n- three',
    },
    {
      fields: { ...defaults, mode: 'remove', prefix: '[', suffix: ']' },
      label: 'Remove matching boundaries',
      text: '[alpha]\nbeta]\n[gamma\nplain',
    },
    {
      fields: { ...defaults, blankLines: 'include', prefix: '> ' },
      label: 'Include actual blank lines',
      text: 'one\n\n \ntwo\n',
    },
    {
      fields: { ...defaults, prefix: '- ', suffix: ';' },
      label: 'Keep mixed line endings',
      text: 'one\r\ntwo\rthree\n',
    },
    {
      fields: { ...defaults, mode: 'remove', prefix: '[', suffix: ']' },
      label: 'Remove to empty',
      text: '[]',
    },
    { fields: { ...defaults }, label: 'No-op with empty affixes', text: 'unchanged\n' },
    { fields: { ...defaults, prefix: '- ' }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};
