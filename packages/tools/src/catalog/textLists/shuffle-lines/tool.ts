import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { shuffleLines, type ShuffleOptions } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const modes: readonly ShuffleOptions['mode'][] = ['shuffle', 'pick'];

function readOptions(fields: Record<string, string>): ShuffleOptions {
  const mode = choiceField(fields.mode, 'shuffle', modes, 'Choose Shuffle or Pick for the mode.');

  // Count is only visible in pick mode, so a stale value must not break shuffling.
  return mode === 'pick' ? { count: Number(fields.count ?? '1'), mode } : { mode };
}

function runShuffleLines(fields: Record<string, string>, text: string): ToolResult {
  const options = readOptions(fields);
  const result = withToolError(() => shuffleLines(text, options));

  return {
    artifact: {
      base64: encodeBase64Text(result.text),
      fileName: options.mode === 'pick' ? 'picked.txt' : 'shuffled.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    language: 'plaintext',
    summary: `${result.outputLines} of ${result.inputLines} lines · cryptographic randomness`,
    text: result.text,
  };
}

const defaults: Record<string, string> = { count: '1', mode: 'shuffle' };

export const shuffleLinesTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Shuffle the lines of a list or pick random lines from it, using cryptographically secure randomness and an unbiased Fisher-Yates shuffle.',
  fields: [
    {
      defaultValue: 'shuffle',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Shuffle all', value: 'shuffle' },
        { label: 'Pick random', value: 'pick' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '1',
      help: 'Whole number from 1 to the number of lines.',
      id: 'count',
      label: 'Lines to pick',
      type: 'number',
      visibleWhen: { field: 'mode', is: ['pick'] },
    },
  ],
  freshResults: true,
  id: 'shuffle-lines',
  inputKind: 'text',
  keywords: ['shuffle', 'random', 'pick', 'lines', 'raffle', 'draw', 'randomize', 'winner'],
  name: 'Shuffle & Pick Random Lines',
  outputKind: 'text',
  relatedToolIds: ['sort-lines', 'deduplicate-lines', 'random-token', 'fake-data-generator'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runShuffleLines(fields, text),
  samples: [
    { fields: defaults, label: 'Shuffle a list', text: 'Ada\nBob\nCleo\nDan\nEve' },
    {
      fields: { ...defaults, mode: 'pick' },
      label: 'Pick one winner',
      text: 'Ada\nBob\nCleo\nDan\nEve',
    },
    {
      fields: { ...defaults, count: '3', mode: 'pick' },
      label: 'Pick three',
      text: 'red\ngreen\nblue\nyellow\nblack',
    },
    { fields: defaults, label: 'Keep trailing newline', text: 'one\ntwo\nthree\n' },
    { fields: defaults, label: 'Single line', text: 'only one line' },
    { fields: defaults, label: 'Mixed endings', text: 'a\r\nb\rc\nd' },
  ],
  supportsSelection: true,
};
