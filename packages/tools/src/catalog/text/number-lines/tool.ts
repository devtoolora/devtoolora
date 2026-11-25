import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { numberLinesDetailed } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const integerFieldLabels: Record<string, string> = {
  start: 'Start number',
  width: 'Minimum digit width',
};

function integerField(fields: Record<string, string>, id: string, fallback: string): number {
  const text = (fields[id] ?? fallback).trim();

  if (!/^[+-]?\d+$/.test(text) || !Number.isSafeInteger(Number(text)))
    throw new ToolError(
      `${integerFieldLabels[id] ?? 'Step'} must be a decimal safe integer, not a fraction, exponent or empty value.`,
    );

  return Number(text);
}

const defaults: Record<string, string> = {
  blankLines: 'number',
  placement: 'line-start',
  separator: '. ',
  start: '1',
  step: '1',
  width: '1',
};

export const numberLinesTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Number physical lines with an exact integer start and step, sign-aware zero padding, optional blank-line skipping and preserved original line endings.',
  fields: [
    {
      defaultValue: '1',
      help: 'Decimal safe integer. Negative values and zero are supported; fractions, exponent notation and empty values are rejected.',
      id: 'start',
      label: 'Start number',
      type: 'number',
    },
    {
      defaultValue: '1',
      help: 'Integer increment for each numbered row. Negative counts down; zero deliberately repeats the same label. Skipped blanks do not consume a number.',
      id: 'step',
      label: 'Step',
      type: 'number',
    },
    {
      defaultValue: '1',
      help: '1–20 digits, padded with zeros. The minus sign is outside the width: -2 at width 3 becomes -002. Existing digits are never truncated.',
      id: 'width',
      label: 'Minimum digit width',
      type: 'number',
    },
    {
      defaultValue: '. ',
      help: 'Literal single-line text after the label. Spaces are significant; empty is allowed. Backslash-n, $1 and other syntax are not interpreted.',
      id: 'separator',
      label: 'Separator',
      type: 'text',
    },
    {
      defaultValue: 'number',
      help: 'Blank means empty or only ASCII spaces/tabs. Skip keeps these bodies and terminators unchanged without advancing the sequence.',
      id: 'blankLines',
      label: 'Blank lines',
      options: [
        { label: 'Number', value: 'number' },
        { label: 'Skip', value: 'skip' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'line-start',
      help: 'After indentation preserves leading ASCII spaces/tabs before the generated label. It does not trim the remaining body.',
      id: 'placement',
      label: 'Number placement',
      options: [
        { label: 'Line start', value: 'line-start' },
        { label: 'After indentation', value: 'after-indent' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'number-lines',
  inputKind: 'optionalText',
  keywords: ['number', 'lines', 'sequence', 'list', 'padding', 'increment'],
  name: 'Number Lines',
  outputKind: 'text',
  relatedToolIds: ['prefix-suffix-lines', 'sort-lines', 'whitespace-cleaner', 'text-diff'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const blankLines = fields.blankLines ?? 'number';
    const placement = fields.placement ?? 'line-start';

    if (blankLines !== 'number' && blankLines !== 'skip')
      throw new ToolError('Choose Number or Skip blank lines.');
    if (placement !== 'line-start' && placement !== 'after-indent')
      throw new ToolError('Choose Line start or After indentation.');

    const result = withToolError(() =>
      numberLinesDetailed(text, {
        blankLines,
        placement,
        separator: fields.separator ?? '. ',
        start: integerField(fields, 'start', '1'),
        step: integerField(fields, 'step', '1'),
        width: integerField(fields, 'width', '1'),
      }),
    );

    return {
      artifact: {
        base64: encodeBase64Text(result.text),
        fileName: 'numbered-lines.txt',
        mimeType: 'text/plain;charset=utf-8',
      },
      language: 'plaintext',
      summary: `${result.numberedLines === 0 ? 'Unchanged' : 'Numbered'} · ${result.inputLines} input physical lines · ${result.numberedLines} numbered lines · ${result.skippedBlankLines} blank lines skipped · numbers ${result.firstNumber ?? 'none'} → ${result.lastNumber ?? 'none'}.`,
      text: result.text,
    };
  },
  samples: [
    { fields: { ...defaults }, label: 'Simple numbered list', text: 'one\ntwo\n' },
    {
      fields: { ...defaults, separator: '_', start: '7', width: '3' },
      label: 'Zero-padded labels',
      text: 'alpha\nbeta',
    },
    {
      fields: { ...defaults, start: '3', step: '-1' },
      label: 'Descending labels',
      text: 'a\nb\nc',
    },
    {
      fields: { ...defaults, start: '-2', step: '2', width: '3' },
      label: 'Negative labels through zero',
      text: 'a\nb\nc',
    },
    {
      fields: { ...defaults, blankLines: 'skip' },
      label: 'Keep blank gaps unnumbered',
      text: 'one\n\n \ntwo\n',
    },
    { fields: { ...defaults }, label: 'Number actual blank rows', text: 'one\n\ntwo\n' },
    {
      fields: { ...defaults, placement: 'after-indent', separator: ': ' },
      label: 'Labels after indentation',
      text: '  alpha\n\tbeta\n',
    },
    { fields: { ...defaults }, label: 'Preserve mixed line endings', text: 'one\r\ntwo\rthree\n' },
    {
      fields: { ...defaults, start: '10', step: '0' },
      label: 'Deliberately repeated label',
      text: 'one\ntwo',
    },
    { fields: { ...defaults }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};
