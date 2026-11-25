import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'HTML to Plain Text reads markup the way a browser reads it, including end tags that HTML lets you leave out, such as a missing </li> or </p>. It then writes only what a reader would see. Tags, comments and the doctype disappear, and so do the contents of head, script, style, template and svg.\n\nEntities are decoded, so &lt; becomes < and &amp; becomes &. Runs of spaces, tabs and line breaks collapse to one space, as they do on screen. A no-break space (&nbsp;) is kept as a no-break space.',
      title: 'What does HTML to Plain Text keep?',
    },
    {
      content:
        'Paragraphs, headings, block quotes, lists, tables, figures, pre blocks and horizontal rules are separated by a blank line. Other block elements such as div get a single line break, and so does br. A horizontal rule becomes ---.\n\nList items start with - or with a number. An ordered list honors its start attribute. Each nested list is indented by 2 more spaces. Table rows go on separate lines, and their cells are separated by tabs. A block element inside a table cell becomes a space. Images become their alt text. Text in pre and textarea keeps its inner spacing and line breaks, but trailing spaces on each line are trimmed.',
      title: 'How is the layout written?',
    },
  ],
  examples: [
    '<p>Hello <b>world</b></p> → Hello world',
    '<ul><li>One<li>Two</ul> → - One and - Two on separate lines',
    '<ol start="3"><li>a</li></ol> → 3. a',
    '<a href="https://x.dev">docs</a> with Text and URL → docs (https://x.dev)',
    '<p>a&nbsp;&lt;b&gt;</p> → a, a no-break space and <b>',
  ],
  faq: [
    {
      answer:
        'Choose Text and URL. A link is then written as its text followed by the address in parentheses. Links to an anchor on the same page (#...) and links whose text is already the address are written once.',
      question: 'How do I keep link addresses?',
    },
    {
      answer:
        'No. Script, style, template and svg contents are dropped, and so is the head with its title. Comments and the doctype are removed too.',
      question: 'Does script or style code end up in the text?',
    },
    {
      answer:
        'Spaces only collapse where a browser would collapse them. Text inside pre and textarea keeps its inner spaces and line breaks, except that trailing spaces on each line are trimmed. Only the first line break right after the opening tag is dropped, as in HTML.',
      question: 'Why is the spacing kept in some places?',
    },
    {
      answer:
        'Elements left open are closed the way a browser would close them, and the text is written as usual. Elements whose end tag is optional, such as li, p and td, close silently.',
      question: 'What happens with broken or unclosed HTML?',
    },
  ],
  help: 'Paste HTML as the main input, or select it in the editor.\n\nChoose how links are written: Text only, or Text and URL.\n\nRun the tool. Block elements become line breaks and blank lines, and inline tags such as b and span disappear.\n\nCopy the result, replace the selection with it, or save it as text.txt.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 UTF-16 units of input, 100,000 nodes and 100 nesting levels.',
    'Output lines have no trailing spaces, and the text ends with one line break.',
    'CSS is not applied, so elements hidden with display: none still appear in the text.',
  ],
};
