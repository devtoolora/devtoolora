import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Command line tools color their output with ANSI escape sequences: invisible control codes that start with the escape character. When that output is copied into a ticket, a log file or a chat, the codes show up as noise such as [31m and [0m.',
        'This tool removes colors, cursor movement, screen clearing and window title sequences so only the readable text is left. In HTML mode it keeps the colors instead and turns bold, italic, underline, strike-through, 16, 256 and true colors into inline-styled spans inside a pre block.',
        'The text is scanned once, from start to end, entirely in your browser.',
      ],
      title: 'What is ANSI Escape Stripper & ANSI to HTML?',
    },
    {
      content: [
        'Clean up CI output or a terminal copy before pasting it into an issue.',
        'Make a log greppable when a tool colored its own level names.',
        'Publish a colored test run or build log as an HTML page or an email.',
      ],
      title: 'When to use ANSI Escape Stripper & ANSI to HTML',
    },
  ],
  examples: [
    'ESC[31mred ESC[0m plain → red plain in strip mode, 2 sequences removed.',
    'ESC[1;31mFAIL ESC[0m → a bold red span in HTML mode.',
    'ESC[38;5;208mX → a span with color #ff8700 (256-color index 208).',
    'ESC[38;2;1;2;3mX → a span with color #010203 (true color).',
    'ESC]0;title BEL text → text, the window title sequence is dropped.',
    'ESC[2J ESC[H ESC[?25l → removed completely, cursor and screen codes carry no text.',
    '<a & "b"> in HTML mode → &lt;a &amp; &quot;b&quot;&gt;, text is always escaped.',
  ],
  faq: [
    {
      answer:
        'Color and style codes (SGR), cursor movement and screen clearing (CSI), window titles and other operating system commands (OSC), and short escapes such as selecting a character set.',
      question: 'Which sequences are removed?',
    },
    {
      answer:
        'The sequence is dropped up to the end of that line and the next line is kept intact, so one truncated code cannot swallow the rest of the log.',
      question: 'What happens to a sequence that is cut off?',
    },
    {
      answer:
        'Bold, dim, italic, underline, strike-through, inverse, the 16 standard and bright colors, 256-color and true-color foregrounds and backgrounds. Blink, hide and fonts are ignored.',
      question: 'Which styles does HTML mode support?',
    },
    {
      answer:
        'Yes. All text is HTML-escaped and only generated span elements with inline color styles are added, so the output contains no script or event handlers.',
      question: 'Is the HTML output safe to embed?',
    },
  ],
  help: 'Paste terminal output or apply a sample.\n\nChoose Strip to remove every escape sequence and get plain text.\n\nChoose To HTML to keep the colors and styles as a pre block with inline-styled spans.\n\nCopy or save the result. Log contents are not redacted.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters. No network requests are made.',
    'The scan is a single linear pass; an unterminated sequence ends at the next line break.',
    'The single-byte forms 0x9B (CSI) and 0x9D (OSC) are recognized as well as ESC [ and ESC ].',
    'Extended colors with an index above 255 or a component above 255 are ignored and the style stays unchanged.',
    'Dim is shown as 60% opacity unless bold is also on. Inverse swaps the foreground and background, using white and black as defaults.',
    'Spans never nest and are only created when a styled run of text exists.',
    'Output is not redacted and can contain host names and tokens; review before sharing.',
  ],
};
