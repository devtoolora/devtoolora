import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The typography fixer turns straight quotes, double hyphens and three dots into curly quotes, en or em dashes and a real ellipsis. It also works in reverse and runs locally in your browser or editor.',
        'Use it to polish prose pasted from plain-text sources, or to flatten typographic characters before sending text to a system that only accepts ASCII.',
      ],
      title: 'What does the typography fixer do?',
    },
    {
      content: [
        'A quote opens at the start of the text, after whitespace, after an opening bracket or after a dash. Anywhere else it closes. An apostrophe between two letters becomes a right single quote.',
        'Three hyphens become an em dash and two become an en dash. Three dots become an ellipsis. In the reverse direction non-breaking spaces become plain spaces.',
      ],
      title: 'How quotes and dashes are chosen',
    },
  ],
  examples: [
    '"Hi," she said. → curly double quotes around Hi,',
    "it's → it’s with a right single quote",
    'a---b → a—b, a -- b → a – b',
    'Keep Skip Markdown code on to leave `code` and fenced blocks untouched',
  ],
  faq: [
    {
      answer:
        'Markdown code is skipped by default so snippets stay valid. Turn off Skip Markdown code to convert the text inside backticks and fenced blocks as well.',
      question: 'Is code left alone?',
    },
    {
      answer:
        'Leading apostrophes such as the one in the 90s are treated as opening quotes because the tool has no dictionary. Fix those few cases by hand after the conversion.',
      question: 'Why is a leading apostrophe curled the wrong way?',
    },
    {
      answer:
        'Yes. The reverse direction maps curly quotes, primes, dashes, the ellipsis and non-breaking spaces to their plain ASCII forms. An em dash becomes two hyphens.',
      question: 'Can it convert back to ASCII?',
    },
    {
      answer:
        'Input is limited to 1,000,000 characters. Longer text is rejected with a message before any work is done.',
      question: 'Are there size limits?',
    },
  ],
  help: 'Paste text and pick a direction.\n\nASCII to typographic curls quotes, joins hyphens into dashes and turns three dots into an ellipsis.\n\nTypographic to ASCII flattens them again.\n\nKeep Skip Markdown code on to protect inline code and fenced blocks. The summary shows how many replacements were made.',
  notes: [
    'Input is limited to 1,000,000 characters.',
    'Inline code spans are matched by backtick pairs, so a lone backtick can pair with the next one.',
    'Leading apostrophes, as in the 90s, are curled as opening quotes.',
  ],
};
