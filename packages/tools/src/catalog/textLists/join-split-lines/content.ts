import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Joining turns several lines into one line with a separator between them. Splitting does the opposite: it cuts text at a separator, or into pieces of a fixed length, and puts each piece on its own line.',
        'Both directions can trim every item and drop empty ones. Everything runs locally in your browser or editor.',
      ],
      title: 'What does Join & Split Lines do?',
    },
    {
      content: [
        'Join a column of values into a comma separated string for a config or a query.',
        'Split a semicolon or pipe separated string into one value per line.',
        'Cut a long token or string into fixed-length pieces for fixed-width formats.',
        'Join with a tab by typing \\t as the separator.',
      ],
      title: 'When to use Join & Split Lines',
    },
  ],
  examples: [
    'Join with ", ": alpha, beta and gamma on separate lines → alpha, beta, gamma.',
    'Join with " | ": one, two, three on separate lines → one | two | three.',
    'Split on ";": red; green;blue → red, green and blue on separate lines.',
    'Split into 10-character pieces: abcdefghijklmnopqrstuvwxyz → abcdefghij, klmnopqrst, uvwxyz.',
    'Escaped tab: separator \\t joins id, name, email with real tab characters.',
  ],
  faq: [
    {
      answer:
        'In the separator field the two-character sequences \\n and \\t mean a newline and a tab. Any other backslash sequence is used literally. Leave the separator empty in join mode to concatenate lines directly.',
      question: 'Can I use a newline or a tab as the separator?',
    },
    {
      answer:
        'Splitting by length counts UTF-16 units, so an emoji takes two. A pair is never cut in half: if a piece would end between the two halves, the whole character stays in the earlier piece, which then holds one extra unit.',
      question: 'What happens to emoji when I split by length?',
    },
    {
      answer:
        'Wrap Text breaks lines at word boundaries to fit a width and keeps words intact. Join & Split Lines cuts at an exact separator or at a fixed length regardless of words, and can also join lines.',
      question: 'How is this different from Wrap Text?',
    },
  ],
  help: 'Choose Join to merge lines or Split to cut text apart.\n\nIn join mode every line becomes one item and the items are glued together with the separator. An empty separator concatenates them.\n\nIn split mode choose Separator to cut at every occurrence of the separator, or Length to cut into pieces of a fixed number of UTF-16 units. Each piece ends up on its own line.\n\nTrim removes surrounding whitespace from every item and Drop empty items removes blank ones. Turn the latter off to keep the empty pieces between adjacent separators.\n\nCopy the result, insert it into the editor, or save joined.txt or split.txt.',
  notes: [
    'Input is limited to 100,000 UTF-16 units and the result to 100,000 items.',
    'The separator is 0 to 32 characters when joining and 1 to 32 when splitting. The sequences \\n and \\t mean newline and tab.',
    'The piece length must be a whole number from 1 to 10,000. A surrogate pair stays in the earlier piece, so a piece can be one unit longer.',
    'Lines are split on LF, CRLF and CR. Browser textareas normalize line endings to LF.',
  ],
};
