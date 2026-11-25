import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A token is the unit a language model reads and writes. A short English word is often one token, a long or rare word is several, and punctuation, digits and emoji can each take a token or more. Prompt length, cost and context-window limits are all measured in tokens, not characters.',
        'Real counts come from a tokenizer that belongs to one model family, and different models split the same text differently. This tool does not ship a tokenizer and calls no API. It adds up a weight for each character class in one pass, so the answer is an estimate with an honest range.',
        'Latin letters, digits and single spaces weigh a quarter token. ASCII punctuation and letters of other scripts weigh half a token, Chinese, Japanese and Korean characters weigh one, emoji weigh two, and a newline or a run of other whitespace weighs one. The total is rounded up.',
      ],
      title: 'What is a token estimate?',
    },
    {
      content: [
        'Check whether a prompt, document or chat history is likely to fit in a context window before you send it.',
        'Compare the size of two prompt drafts while you shorten one.',
        'Judge roughly how much a long text will cost when a provider bills per token.',
        'Split work into pieces that stay well under a limit, keeping the upper bound of the range in mind.',
      ],
      title: 'When to use Token Estimator',
    },
  ],
  examples: [
    'Hello world → about 3 tokens, range 2-4, margin plus or minus 20%.',
    '日本語のテキスト → about 8 tokens, range 4-12, margin plus or minus 50%.',
    '{"a":1} → about 3 tokens, range 1-5; punctuation is most of the text, so the margin is plus or minus 40%.',
    '👍 → 2 tokens, because every emoji weighs two.',
    'An empty input → 0 tokens, range 0-0.',
    'a b on one line and c on the next → 2 lines, 3 words, 5 UTF-8 bytes.',
  ],
  faq: [
    {
      answer:
        'No. It is a heuristic with fixed weights per character class, not a tokenizer, and it knows nothing about any model vocabulary. Use the range, and the high end when you need a safe upper bound.',
      question: 'Is this the exact token count?',
    },
    {
      answer:
        'Model families use different vocabularies, so the same text has a different count in each. One estimate with a range avoids a false precision for names this tool cannot calibrate against.',
      question: 'Why are there no per-model numbers?',
    },
    {
      answer:
        'The margin follows the dominant kind of text: plus or minus 20% for Latin text, 40% when more than 15% of characters are punctuation (code, JSON), and 50% for CJK or other scripts.',
      question: 'How is the margin chosen?',
    },
    {
      answer:
        'Context fit divides the high estimate by 8,192, 32,768, 128,000, 200,000 and 1,000,000 tokens. It is the share of that window the text could use at most, not a promise about any product.',
      question: 'What does context fit mean?',
    },
    {
      answer:
        'Everything runs in your browser or editor. The text is not sent anywhere and no tokenizer file is downloaded.',
      question: 'Is my text uploaded?',
    },
  ],
  help: 'Paste or type the text you want to measure. The estimate updates from that text alone; there are no options.\n\nThe first line shows the estimate and its range, for example about 3 tokens with a range of 2-4. The range is wider for code and for languages that are not Latin script, because the weights are less reliable there.\n\nBelow the note you find the text counts: UTF-16 units, code points, UTF-8 bytes, words and lines. After them comes the context fit, the share of five common window sizes that the high estimate could fill.\n\nCopy the summary, save it as token-estimate.txt, or open the JSON report with the same numbers. The input is limited to 1,000,000 UTF-16 units.',
  notes: [
    'Processing is local; nothing is uploaded and no tokenizer is downloaded.',
    'The estimate is a heuristic. Real token counts vary by model.',
    'The range is floor(estimate × (1 − margin)) to ceil(estimate × (1 + margin)).',
    'Words are counted with the browser word segmenter, so languages without spaces are split by it.',
    'Zero-width and combining characters add nothing to the estimate.',
    'The input is limited to 1,000,000 UTF-16 units; longer text is an error.',
  ],
};
