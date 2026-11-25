import { devError } from './shared';

export const editorconfigSections = [
  'markdown',
  'makefile',
  'go',
  'python',
  'yaml',
  'windows',
] as const;

export type EditorconfigSection = (typeof editorconfigSections)[number];

export type EditorconfigOptions = {
  charset: 'latin1' | 'omit' | 'utf-16be' | 'utf-16le' | 'utf-8' | 'utf-8-bom';
  endOfLine: 'cr' | 'crlf' | 'lf' | 'omit';
  indentSize: number | 'omit';
  indentStyle: 'omit' | 'space' | 'tab';
  insertFinalNewline: 'false' | 'omit' | 'true';
  root: boolean;
  sections: EditorconfigSection[];
  trimTrailingWhitespace: 'false' | 'omit' | 'true';
};

type Block = { glob: string; lines: string[] };

const fixedBlocks: Record<EditorconfigSection, Block> = {
  go: { glob: '*.go', lines: ['indent_style = tab'] },
  makefile: { glob: 'Makefile', lines: ['indent_style = tab'] },
  markdown: { glob: '*.md', lines: ['trim_trailing_whitespace = false'] },
  python: { glob: '*.py', lines: ['indent_style = space', 'indent_size = 4'] },
  windows: { glob: '*.{bat,cmd,ps1}', lines: ['end_of_line = crlf'] },
  yaml: { glob: '*.{yml,yaml}', lines: ['indent_style = space', 'indent_size = 2'] },
};

export function generateEditorconfig(options: EditorconfigOptions): {
  properties: number;
  sections: number;
  text: string;
} {
  const { indentSize } = options;

  if (
    indentSize !== 'omit' &&
    !(Number.isInteger(indentSize) && indentSize >= 1 && indentSize <= 16)
  )
    throw devError('Indent size must be 1-16.');

  const set = (key: string, value: string): string[] =>
    value === 'omit' ? [] : [`${key} = ${value}`];
  const blocks: Block[] = [
    {
      glob: '*',
      lines: [
        ...set('indent_style', options.indentStyle),
        ...set('indent_size', String(indentSize)),
        ...set('end_of_line', options.endOfLine),
        ...set('charset', options.charset),
        ...set('trim_trailing_whitespace', options.trimTrailingWhitespace),
        ...set('insert_final_newline', options.insertFinalNewline),
      ],
    },
    ...editorconfigSections
      .filter((id) => options.sections.includes(id))
      .map((id) => fixedBlocks[id]),
  ].filter((block) => block.lines.length > 0);

  if (blocks.length === 0) throw devError('Choose at least one setting.');

  const parts = blocks.map(({ glob, lines }) => `[${glob}]\n${lines.join('\n')}\n`);

  if (options.root) parts.unshift('root = true\n');

  return {
    properties: blocks.reduce((sum, block) => sum + block.lines.length, 0),
    sections: blocks.length,
    text: parts.join('\n'),
  };
}
