import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { convertLineEndings, type LineEndingOptions } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const endings: readonly LineEndingOptions['ending'][] = ['lf', 'crlf', 'cr', 'keep'];
const boms: readonly LineEndingOptions['bom'][] = ['keep', 'add', 'remove'];

const defaults: Record<string, string> = { bom: 'keep', ending: 'lf' };

function runLineEndingConverter(fields: Record<string, string>, text: string): ToolResult {
  const options: LineEndingOptions = {
    bom: choiceField(fields.bom, 'keep', boms, 'Choose Keep, Add or Remove for the BOM.'),
    ending: choiceField(
      fields.ending,
      'lf',
      endings,
      'Choose LF, CRLF, CR or Keep for line endings.',
    ),
  };
  const {
    counts,
    hadBom,
    mixed,
    text: converted,
  } = withToolError(() => convertLineEndings(text, options));
  const changed = converted !== text;

  return {
    artifact: {
      base64: encodeBase64Text(converted),
      fileName: 'converted.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    language: 'plaintext',
    summary: `${counts.lf} LF · ${counts.crlf} CRLF · ${counts.cr} CR · ${mixed ? 'mixed endings' : 'uniform endings'} · BOM ${hadBom ? 'present' : 'absent'}${changed ? '' : ' · Unchanged'}`,
    text: converted,
  };
}

export const lineEndingConverterTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Convert line endings between LF, CRLF and CR, add or remove a UTF-8 byte order mark, and count each kind of line terminator.',
  fields: [
    {
      defaultValue: 'lf',
      help: 'Keep only reports the counts and leaves terminators untouched.',
      id: 'ending',
      label: 'Line ending',
      options: [
        { label: 'LF (Unix, macOS)', value: 'lf' },
        { label: 'CRLF (Windows)', value: 'crlf' },
        { label: 'CR (classic Mac)', value: 'cr' },
        { label: 'Keep', value: 'keep' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'keep',
      id: 'bom',
      label: 'Byte order mark',
      options: [
        { label: 'Keep', value: 'keep' },
        { label: 'Add', value: 'add' },
        { label: 'Remove', value: 'remove' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'line-ending-converter',
  inputKind: 'optionalText',
  keywords: ['line ending', 'crlf', 'lf', 'cr', 'newline', 'bom', 'eol', 'dos2unix', 'unix2dos'],
  name: 'Line Ending & BOM Converter',
  outputKind: 'text',
  relatedToolIds: ['whitespace-cleaner', 'sort-lines', 'zero-width-detector', 'text-diff'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runLineEndingConverter(fields, text),
  samples: [
    {
      fields: defaults,
      label: 'Mixed endings to LF',
      text: 'a\r\nb\rc\n',
    },
    {
      fields: { ...defaults, ending: 'crlf' },
      label: 'LF to CRLF for Windows',
      text: 'first\nsecond\nthird\n',
    },
    {
      fields: { ...defaults, bom: 'add', ending: 'keep' },
      label: 'Add UTF-8 BOM',
      text: 'name,city\nAda,London\n',
    },
    {
      fields: { ...defaults, bom: 'remove', ending: 'keep' },
      label: 'Remove BOM',
      text: '\uFEFFname,city\r\nAda,London\r\n',
    },
    {
      fields: { ...defaults, ending: 'keep' },
      label: 'Report only (keep)',
      text: 'one\r\ntwo\nthree\r',
    },
    {
      fields: defaults,
      label: 'Empty input is valid',
      text: '',
    },
  ],
  supportsSelection: true,
};
