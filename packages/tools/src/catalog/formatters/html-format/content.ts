import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Formatting puts each block element, such as div, p or li, on its own indented line. Inline elements such as b, a or span stay on the line of their text.\n\nThe tool uses its own small tokenizer instead of a browser DOM, so attributes, quotes and tag case are copied exactly as written.',
      title: 'What does HTML formatting do?',
    },
    {
      content:
        'Minify removes comments and the whitespace between tags. Conditional comments that start with <!--[if are kept. Optional closing tags and attribute quotes are never removed.',
      title: 'What does minify remove?',
    },
  ],
  examples: [
    '<div><p>Hi <b>there</b></p></div> → div on its own line with the p indented inside it.',
    '<pre>  a\n   b</pre> → unchanged in both modes.',
    '<div><span>x</div> → </span> is added and the summary reports 1 unclosed element closed.',
    '<ul> <li>a</li> <!-- c --> </ul> → <ul><li>a</li></ul> in Minify mode.',
  ],
  faq: [
    {
      answer:
        'No. Content inside pre, textarea, script and style is copied byte for byte in both modes, even when a script contains text like "</div>".',
      question: 'Does it change my scripts or preformatted text?',
    },
    {
      answer:
        'No. Malformed HTML is not an error. Unclosed elements are closed at the end of their parent, and the summary tells you how many were closed.',
      question: 'Does it reject broken HTML?',
    },
    {
      answer:
        'No. It does not check HTML conformance or fix invalid nesting beyond closing unclosed elements.',
      question: 'Does it validate HTML?',
    },
    {
      answer:
        'Yes, conditional comments that start with <!--[if are kept. All other comments are removed in Minify mode and kept in Format mode.',
      question: 'Are comments kept?',
    },
    {
      answer:
        'Whitespace between two inline elements is kept as one space so words stay apart. Whitespace next to block elements is removed.',
      question: 'Can minify join words together?',
    },
  ],
  help: 'Paste HTML or choose a sample.\n\nChoose Format to indent the markup, or Minify to remove comments and layout whitespace. \n\nPick 2 spaces, 4 spaces or tabs for Format mode.\n\nCopy the result or save it as an HTML file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 input characters, 100 nesting levels and 100,000 nodes.',
    'Format mode collapses whitespace inside inline runs and trims it at their edges; a / on a non-void tag such as <div/> is treated as self-closing.',
    'Implied end tags (p, li, dt, dd, td, th, tr, option) stay implied. Other unclosed elements are closed at their parent’s end; stray closing tags are kept as written.',
  ],
};
