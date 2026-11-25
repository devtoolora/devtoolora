import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { deduplicateLinesDetailed } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { checkbox } from '../shared';

const defaults: Record<string, string> = {
  blankLines: 'deduplicate',
  caseSensitive: 'false',
  keep: 'first',
  normalizeComparison: 'false',
  trimComparison: 'false',
};

export const deduplicateLinesTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Remove repeated physical lines with explicit comparison rules while preserving original spelling, spacing and retained line endings.',
  fields: [
    {
      defaultValue: 'first',
      id: 'keep',
      label: 'Keep occurrence',
      options: [
        { label: 'First occurrence', value: 'first' },
        { label: 'Last occurrence', value: 'last' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'false',
      help: 'Off compares JavaScript Unicode lowercase keys. On compares exact letter case. This is not locale-sensitive collation or full Unicode case folding.',
      id: 'caseSensitive',
      label: 'Distinguish letter case',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Ignore leading and trailing ASCII spaces/tabs in comparison keys only. Retained text is not trimmed.',
      id: 'trimComparison',
      label: 'Ignore edge spaces for comparison',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      help: 'Compare canonical NFC forms after lowercasing. Accents are not removed; compatibility characters are not merged. Retained Unicode is unchanged.',
      id: 'normalizeComparison',
      label: 'Normalize Unicode for comparison',
      type: 'checkbox',
    },
    {
      defaultValue: 'deduplicate',
      help: 'Blank means empty or only ASCII spaces/tabs. Deduplicate uses the same comparison rules; Keep all bypasses deduplication for blanks. Remove deletes every blank body and its terminator.',
      id: 'blankLines',
      label: 'Blank lines',
      options: [
        { label: 'Deduplicate normally', value: 'deduplicate' },
        { label: 'Keep all', value: 'keep' },
        { label: 'Remove all', value: 'remove' },
      ],
      type: 'select',
    },
  ],
  id: 'deduplicate-lines',
  inputKind: 'optionalText',
  keywords: ['duplicate', 'deduplicate', 'unique', 'lines', 'repeated'],
  name: 'Deduplicate Lines',
  outputKind: 'text',
  relatedToolIds: ['sort-lines', 'text-diff', 'whitespace-cleaner', 'text-statistics'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const keep = fields.keep ?? 'first';
    const blankLines = fields.blankLines ?? 'deduplicate';

    if (keep !== 'first' && keep !== 'last')
      throw new ToolError('Choose First occurrence or Last occurrence.');
    if (blankLines !== 'deduplicate' && blankLines !== 'keep' && blankLines !== 'remove')
      throw new ToolError('Choose Deduplicate normally, Keep all or Remove all blank lines.');

    const result = withToolError(() =>
      deduplicateLinesDetailed(text, {
        blankLines,
        caseSensitive: checkbox(fields, 'caseSensitive', 'Distinguish letter case', false),
        keep,
        normalizeComparison: checkbox(
          fields,
          'normalizeComparison',
          'Normalize Unicode for comparison',
          false,
        ),
        trimComparison: checkbox(
          fields,
          'trimComparison',
          'Ignore edge spaces for comparison',
          false,
        ),
      }),
    );

    return {
      artifact: {
        base64: encodeBase64Text(result.text),
        fileName: 'deduplicated-lines.txt',
        mimeType: 'text/plain;charset=utf-8',
      },
      language: 'plaintext',
      summary: `${result.text === text ? 'Unchanged' : 'Deduplicated'} · ${result.inputLines} input physical lines · ${result.retainedLines} retained records · ${result.outputLines} output physical lines · ${result.removedDuplicates} duplicates removed · ${result.removedBlankLines} blank lines removed · keeping ${keep} occurrence.${result.lineStructureChanged ? ' Warning: removing intervening bodies joined retained CR/LF terminators.' : ''}`,
      text: result.text,
    };
  },
  samples: [
    { fields: { ...defaults }, label: 'First spelling wins', text: 'Alpha\nbeta\nalpha' },
    {
      fields: { ...defaults, keep: 'last' },
      label: 'Last occurrence wins',
      text: 'Alpha\nbeta\nalpha',
    },
    {
      fields: { ...defaults, caseSensitive: 'true' },
      label: 'Case-sensitive identifiers',
      text: 'ID\nid\nID',
    },
    {
      fields: { ...defaults, trimComparison: 'true' },
      label: 'Compare padding without trimming',
      text: '  beta  \nbeta\nalpha',
    },
    {
      fields: { ...defaults, normalizeComparison: 'true' },
      label: 'Canonical Unicode comparison',
      text: 'cafe\u0301\ncafé\ncafe',
    },
    {
      fields: { ...defaults, blankLines: 'keep' },
      label: 'Keep blank spacing',
      text: 'alpha\n\nalpha\n\nbeta\n',
    },
    { fields: { ...defaults }, label: 'Retain raw line endings', text: 'Alpha\r\nbeta\ralpha\n' },
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
