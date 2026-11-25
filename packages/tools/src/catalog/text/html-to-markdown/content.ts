import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'HTML to Markdown reads markup the way a browser reads it, including end tags that HTML lets you leave out. Headings become # headings, strong and b become **, em and i become *, and del, s and strike become ~~. Inline code, pre blocks, links, images, nested ul and ol lists, block quotes, horizontal rules and br line breaks have Markdown forms too. Tables become GitHub pipe tables.\n\nLayout containers such as div, span, section, article, header, footer, nav, aside, figure and figcaption are transparent: only their content is written. Head, script, style, template, svg, comments and the doctype are dropped with their content.',
      title: 'What does HTML to Markdown convert?',
    },
    {
      content:
        'Any other element, such as u, iframe or video, is removed while its text stays. The summary lists these tags by name with a count. It also counts colspan and rowspan, because pipe tables have no merged cells.\n\nCharacters that Markdown would read as syntax are escaped with a backslash, so text such as 2 * 3, ~~old~~ or [draft] stays literal. A # or - at the start of a line, and a number followed by . or ), are escaped too, so they do not turn into headings or lists. A | inside a table cell is written as \\|.',
      title: 'What is dropped or escaped?',
    },
  ],
  examples: [
    '<h2>Title</h2> → ## Title',
    '<p>Some <strong>bold</strong> and <em>em</em></p> → Some **bold** and *em*',
    '<a href="https://x.dev" title="T">x</a> → [x](https://x.dev "T")',
    '<ul><li>One<ol><li>Two</li></ol></li></ul> → - One, then 1. Two indented by 2 spaces',
    '<pre><code class="language-ts">let a;</code></pre> → a ```ts fenced block',
    '<p>1. not a list</p> → 1\\. not a list',
  ],
  faq: [
    {
      answer:
        'The fence is three backticks, or one more than the longest backtick run inside the code, so the code cannot close it early. A language-* class on pre or its code element becomes the fence language. One trailing line break of the code is removed.',
      question: 'How are code blocks fenced?',
    },
    {
      answer:
        'Markdown has no syntax for them. The tag is removed, its text is kept in place, and the summary names the tag with a count so you can check the result.',
      question: 'Why is a tag listed as dropped?',
    },
    {
      answer:
        'The first row becomes the header row, even when it uses td cells, because a pipe table always needs one. Short rows are padded with empty cells, and a line break inside a cell is written as <br>.',
      question: 'How are tables written?',
    },
    {
      answer:
        'Runs of spaces, tabs and line breaks collapse to one space, as they do in a browser, and spaces at the edges of bold or links move outside the markers. A no-break space (&nbsp;) stays a no-break space. Text inside pre keeps its spacing exactly.',
      question: 'What happens to whitespace?',
    },
  ],
  help: 'Paste HTML as the main input, or select it in the editor.\n\nRun the tool. Supported elements become Markdown, layout containers disappear, and other tags are reduced to their text.\n\nCheck the summary for tags that were dropped with their text kept.\n\nCopy the result, replace the selection with it, or save it as converted.md.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 UTF-16 units of input, 100,000 nodes, 100 nesting levels and 20,000,000 characters of output.',
    'Blocks are separated by one blank line, and the Markdown ends with one line break.',
    'The output uses GitHub-flavored Markdown for tables and ~~strikethrough~~; plain CommonMark shows those as text.',
    'CSS is not applied, so elements hidden with display: none still appear in the Markdown.',
  ],
};
