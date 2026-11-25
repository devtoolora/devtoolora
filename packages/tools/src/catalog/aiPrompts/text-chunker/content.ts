import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Chunking cuts a long text into pieces of a bounded size. Language models have a context limit, and retrieval systems embed and search small passages rather than whole documents, so long input has to be split first.',
        'A good chunk ends at a natural place, so it reads as a whole thought. This tool looks for the last paragraph, sentence or word boundary in the second half of the window and cuts there. If none falls in that half it tries the next finer boundary, and only then cuts hard, never inside a surrogate pair.',
        'Neighboring chunks can share an overlap, so a sentence cut at one edge still appears in full in the next chunk. The size is measured in characters or in estimated tokens; the token window is the size scaled by the estimated tokens of the whole text.',
      ],
      title: 'What is text chunking?',
    },
    {
      content: [
        'Prepare documents for embeddings and retrieval-augmented generation.',
        'Fit a long article into several prompts that each stay under a context limit.',
        'Batch a transcript or log for summarizing piece by piece.',
        'Export the pieces as JSON or JSON Lines for a script or an ingestion pipeline.',
      ],
      title: 'When to use Text Chunker',
    },
  ],
  examples: [
    '120 letters a, size 50, overlap 10, boundary None → chunks at 0-50, 40-90 and 80-120.',
    'Size 80, boundary Sentence → each chunk ends at the last full sentence inside its window.',
    'Boundary Paragraph on text without blank lines → falls back to sentences, then words.',
    'Unit Tokens with size 50 → a window of about 200 characters for English prose.',
    'Output Text → every chunk gets a header like --- chunk 3/12 · chars 2,000-2,999 · ≈ 250 tokens ---.',
    'Overlap 26 with size 50 → an error: Overlap must be at most 25 for size 50.',
  ],
  faq: [
    {
      answer:
        'Start with 500 to 1,500 characters and an overlap of about 10%. Smaller chunks retrieve more precisely, larger ones keep more context. The right value depends on your embedding model and content.',
      question: 'What size should I choose?',
    },
    {
      answer:
        'The estimate is a heuristic, not a tokenizer. The window uses one average for the whole text, so chunks are close to the size you asked for when the text is uniform. Text that mixes scripts, such as English and Chinese, can overshoot in its denser parts, so check the estimate shown for each chunk if you must stay under a limit.',
      question: 'Are token chunks exact?',
    },
    {
      answer:
        'The overlap is at most half the size, and every chunk starts at least one character after the previous one, so the process always finishes.',
      question: 'Why is the overlap limited?',
    },
    {
      answer:
        'Sentences come from the browser sentence segmenter, so abbreviations and languages without spaces are handled by it. Paragraphs are blank lines and words are runs of whitespace.',
      question: 'How are boundaries found?',
    },
    {
      answer: 'Everything runs in your browser or editor. The text is not uploaded anywhere.',
      question: 'Is my text uploaded?',
    },
  ],
  help: 'Paste the text you want to split. Choose whether the size counts characters or estimated tokens, then set the size and the overlap.\n\nThe boundary decides where chunks end. Sentence is the default; Paragraph prefers blank lines, Word cuts between words, and None cuts exactly at the size.\n\nThe summary names the number of chunks and the estimate of the largest one. The JSON output lists index, start, end, chars, estimatedTokens and text for every chunk, JSONL puts one chunk per line, and Text adds a header before each chunk.\n\nCopy the result or save it as chunks.json, chunks.jsonl or chunks.txt. Start and end are UTF-16 offsets, and end is exclusive.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'The size must be 50-100,000 and the overlap at most half the size.',
    'At most 10,000 chunks and 5,000,000 output characters are produced; more is an error.',
    'The input is limited to 1,000,000 UTF-16 units.',
    'Token estimates are a heuristic, not a tokenizer; real counts vary by model.',
    'A hard cut never splits a surrogate pair, so a chunk can be one unit shorter than the size.',
    'Start and end are UTF-16 offsets, the same ones JavaScript string slicing uses.',
  ],
};
