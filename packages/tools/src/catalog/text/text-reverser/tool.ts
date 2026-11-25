import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { reverseTextDetailed, type ReverseOptions } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const defaults: Record<string, string> = {
  characterUnit: 'graphemes',
  mode: 'characters',
  scope: 'whole',
  wordSpacing: 'preserve',
};

function reversalScopeLabel(mode: string, options: ReverseOptions): string {
  if (mode === 'lines') return 'original separator-slot line endings';

  return options.scope === 'per-line' ? 'within each line' : 'whole text';
}

export const textReverserTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Reverse whole visible characters, word blocks or physical lines without silently trimming text or normalizing line endings.',
  fields: [
    {
      defaultValue: 'characters',
      id: 'mode',
      label: 'Reverse',
      options: [
        { label: 'Characters', value: 'characters' },
        { label: 'Words', value: 'words' },
        { label: 'Lines', value: 'lines' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'whole',
      help: 'Whole text can move words or character units across line breaks. Each line transforms its body independently and keeps its terminator unchanged.',
      id: 'scope',
      label: 'Scope',
      options: [
        { label: 'Whole text', value: 'whole' },
        { label: 'Each line', value: 'per-line' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', isNot: ['lines'] },
    },
    {
      defaultValue: 'graphemes',
      help: 'Graphemes keep visible character clusters together. Code points can split combining accents, flags and joined emoji; surrogate pairs remain intact.',
      id: 'characterUnit',
      label: 'Character unit',
      options: [
        { label: 'Graphemes', value: 'graphemes' },
        { label: 'Unicode code points', value: 'code-points' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['characters'] },
    },
    {
      defaultValue: 'preserve',
      help: 'Keep preserves every separator slot, including repeated spaces and tabs. Reverse mirrors their sequence too, including leading/trailing whitespace.',
      id: 'wordSpacing',
      label: 'Word spacing',
      options: [
        { label: 'Keep separator slots', value: 'preserve' },
        { label: 'Reverse separators too', value: 'reverse' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['words'] },
    },
  ],
  id: 'text-reverser',
  inputKind: 'optionalText',
  keywords: ['reverse', 'grapheme', 'unicode', 'emoji', 'words', 'lines'],
  name: 'Text Reverser',
  outputKind: 'text',
  relatedToolIds: ['text-statistics', 'sort-lines', 'text-diff', 'whitespace-cleaner'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const mode = fields.mode ?? 'characters';

    if (mode !== 'characters' && mode !== 'words' && mode !== 'lines')
      throw new ToolError('Choose Characters, Words or Lines.');

    const options: ReverseOptions = {};

    if (mode !== 'lines') {
      const scope = fields.scope ?? 'whole';

      if (scope !== 'whole' && scope !== 'per-line')
        throw new ToolError('Choose Whole text or Each line scope.');

      options.scope = scope;
    }

    if (mode === 'characters') {
      const unit = fields.characterUnit ?? 'graphemes';

      if (unit !== 'graphemes' && unit !== 'code-points')
        throw new ToolError('Choose Graphemes or Unicode code points.');

      options.characterUnit = unit;
    }

    if (mode === 'words') {
      const spacing = fields.wordSpacing ?? 'preserve';

      if (spacing !== 'preserve' && spacing !== 'reverse')
        throw new ToolError('Choose Keep separator slots or Reverse separators too.');

      options.wordSpacing = spacing;
    }

    const result = withToolError(() => reverseTextDetailed(text, mode, options));

    return {
      artifact: {
        base64: encodeBase64Text(result.text),
        fileName: 'reversed-text.txt',
        mimeType: 'text/plain;charset=utf-8',
      },
      language: 'plaintext',
      summary: `${result.text === text ? 'Unchanged' : 'Reversed'} · ${result.units} ${result.unit} · ${reversalScopeLabel(mode, options)}${mode === 'words' ? ` · ${options.wordSpacing === 'reverse' ? 'separators reversed too' : 'separator slots preserved'}` : ''}.`,
      text: result.text,
    };
  },
  samples: [
    { fields: { ...defaults }, label: 'Simple letters', text: 'abc' },
    { fields: { ...defaults }, label: 'Accents and joined emoji', text: 'Café 👩🏽‍💻' },
    {
      fields: { ...defaults, characterUnit: 'code-points' },
      label: 'Inspect decomposed code points',
      text: 'é',
    },
    {
      fields: { ...defaults, mode: 'words' },
      label: 'Words with exact separators',
      text: '  one   two\tthree ',
    },
    {
      fields: { ...defaults, mode: 'words', wordSpacing: 'reverse' },
      label: 'Words and separators reversed',
      text: '  one   two\tthree ',
    },
    {
      fields: { ...defaults, scope: 'per-line' },
      label: 'Characters within CRLF lines',
      text: 'abc\r\ndef\n',
    },
    {
      fields: { ...defaults, mode: 'lines' },
      label: 'Reverse mixed-ending lines',
      text: 'one\r\ntwo\rthree\n',
    },
    { fields: { ...defaults }, label: 'Whitespace stays exact', text: ' \t\r\n' },
    { fields: { ...defaults }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};
