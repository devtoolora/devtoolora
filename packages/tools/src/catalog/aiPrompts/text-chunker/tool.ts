import { ToolError, type ToolDefinition, type ToolField } from '@devtoolora/core';
import { aiLimits, chunkText, type ChunkOptions, type TextChunk } from '@devtoolora/functions/ai';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField, rangeField } from '../../../adapters/fields';

const units = ['characters', 'tokens'] as const;
const boundaries = ['sentence', 'paragraph', 'word', 'none'] as const;
const outputs = ['json', 'jsonl', 'text'] as const;

const labels: { [value in (typeof units | typeof boundaries | typeof outputs)[number]]: string } = {
  characters: 'Characters',
  json: 'JSON',
  jsonl: 'JSONL',
  none: 'None',
  paragraph: 'Paragraph',
  sentence: 'Sentence',
  text: 'Text',
  tokens: 'Tokens',
  word: 'Word',
};
const format = new Intl.NumberFormat('en-US');
const { maxSize, minSize } = aiLimits.chunker;

const fields: ToolField[] = [
  {
    defaultValue: 'characters',
    id: 'unit',
    label: 'Unit',
    options: units.map((value) => ({ label: labels[value], value })),
    presentation: 'segmented',
    type: 'select',
  },
  rangeField({ defaultValue: '1000', id: 'size', label: 'Size', max: maxSize, min: minSize }),
  rangeField({ defaultValue: '100', id: 'overlap', label: 'Overlap', max: maxSize / 2, min: 0 }),
  {
    defaultValue: 'sentence',
    id: 'boundary',
    label: 'Boundary',
    options: boundaries.map((value) => ({ label: labels[value], value })),
    type: 'select',
  },
  {
    defaultValue: 'json',
    id: 'output',
    label: 'Output',
    options: outputs.map((value) => ({ label: labels[value], value })),
    type: 'select',
  },
];

const record = ({ chars, end, estimatedTokens, index, start, text }: TextChunk) => ({
  index,
  start,
  end,
  chars,
  estimatedTokens,
  text,
});

function render(chunks: TextChunk[], output: (typeof outputs)[number]): string {
  if (output === 'json') return JSON.stringify(chunks.map(record), null, 2);
  if (output === 'jsonl') return chunks.map((chunk) => JSON.stringify(record(chunk))).join('\n');

  return chunks
    .map(
      ({ end, estimatedTokens, index, start, text }) =>
        `--- chunk ${index + 1}/${chunks.length} · chars ${format.format(start)}-${format.format(end - 1)} · ≈ ${format.format(estimatedTokens)} tokens ---\n${text}`,
    )
    .join('\n\n');
}

const sample = (label: string, text: string, values: Record<string, string> = {}) => ({
  fields: values,
  label,
  text,
});

const prose =
  'Chunking splits long text into pieces that fit a limit. Each piece should end at a natural place. Sentences are the usual choice.\n\nA new paragraph starts here. It keeps related ideas together. Overlap repeats a little context between pieces.';

export const textChunkerTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'AI & Prompts',
  description:
    'Split long text into overlapping chunks by characters or estimated tokens, cutting at paragraph, sentence or word boundaries. For RAG and context limits.',
  fields,
  freshResults: true,
  id: 'text-chunker',
  inputKind: 'text',
  keywords: ['chunk', 'split', 'rag', 'embedding', 'overlap', 'context window', 'llm', 'tokens'],
  name: 'Text Chunker',
  outputKind: 'text',
  relatedToolIds: ['token-estimator', 'text-statistics'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields: values, text }) =>
    withToolError(() => {
      const output = choiceField(values.output, 'json', outputs, 'Choose JSON, JSONL or text.');
      const options: ChunkOptions = {
        boundary: choiceField(values.boundary, 'sentence', boundaries, 'Choose a listed boundary.'),
        overlap: Number(values.overlap ?? '100'),
        size: Number(values.size ?? '1000'),
        unit: choiceField(values.unit, 'characters', units, 'Choose characters or tokens.'),
      };
      const chunks = chunkText(text, options);
      const result = render(chunks, output);

      if (result.length > aiLimits.chunker.outputChars)
        throw new ToolError(
          `Output must be at most ${format.format(aiLimits.chunker.outputChars)} characters; use a smaller overlap or a different output format.`,
        );

      const largest = Math.max(0, ...chunks.map((chunk) => chunk.estimatedTokens));
      const extension = output === 'text' ? 'txt' : output;

      return {
        artifact: {
          base64: encodeBase64Text(result),
          fileName: `chunks.${extension}`,
          mimeType: output === 'json' ? 'application/json' : 'text/plain;charset=utf-8',
        },
        language: output === 'text' ? undefined : output,
        noWrap: true,
        summary: `${format.format(chunks.length)} ${chunks.length === 1 ? 'chunk' : 'chunks'} · largest ≈ ${format.format(largest)} tokens`,
        text: result,
      };
    }),
  samples: [
    sample('Sentences, 80 characters', prose, { boundary: 'sentence', overlap: '10', size: '80' }),
    sample('Paragraphs', prose, { boundary: 'paragraph', overlap: '0', size: '140' }),
    sample('Words with overlap', prose, { boundary: 'word', overlap: '20', size: '100' }),
    sample('Hard cut', 'a'.repeat(120), { boundary: 'none', overlap: '10', size: '50' }),
    sample('Token window as text', prose, {
      output: 'text',
      overlap: '5',
      size: '50',
      unit: 'tokens',
    }),
    sample('JSON Lines for a pipeline', prose, { output: 'jsonl', overlap: '10', size: '100' }),
  ],
  supportsSelection: true,
};

export const textSplitterTool: ToolDefinition = {
  ...textChunkerTool,
  aliasOf: 'text-chunker',
  description:
    'Split text into overlapping pieces at sentence, paragraph or word boundaries for embeddings and context limits.',
  id: 'text-splitter',
  name: 'Text Splitter',
};
