import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Markdown is readable plain text with markers for headings, emphasis, links, lists and code. This tool parses its structure into HTML elements instead of replacing a few patterns.',
        'CommonMark mode uses the CommonMark rules supported by the bundled markdown-it parser. Extended mode adds pipe tables and ~~strikethrough~~; it is not a complete GitHub-flavored Markdown implementation.',
        'Raw HTML is escaped as visible text. The preview builds a closed set of elements from parsed tokens, never inserts arbitrary source HTML and never fetches images or follows links.',
      ],
      title: 'What is Markdown to HTML?',
    },
    {
      content: [
        'Prepare HTML content for a website or documentation page.',
        'Check lists, headings, code blocks and table structure visually before copying HTML.',
        'Export an HTML fragment for an existing template, or a standalone UTF-8 document.',
        'Compare ordinary soft newlines with the optional line-break mode.',
      ],
      title: 'When to use Markdown to HTML',
    },
  ],
  examples: [
    '# Title → <h1>Title</h1>; Setext headings using === or --- work too.',
    '- Item and 1. Item → real ul and ol lists, including nested items.',
    'Use `<b>` → <p>Use <code>&lt;b&gt;</code></p>; fenced and indented blocks become pre/code with escaped content.',
    '| Name | Value | plus a | --- | --- | row → a table in Extended mode; plain paragraph text in CommonMark.',
    '[docs][id] with [id]: https://example.test → <a href="https://example.test">docs</a>.',
    '<script>alert(1)</script> → &lt;script&gt;alert(1)&lt;/script&gt; inside a paragraph, never executed.',
  ],
  faq: [
    {
      answer:
        'No. Raw HTML is escaped and shown as text, so <script>alert(1)</script> becomes &lt;script&gt;alert(1)&lt;/script&gt; inside a paragraph. There is no option to pass raw HTML through.',
      question: 'Is raw HTML in my Markdown rendered?',
    },
    {
      answer:
        'The markdown-it parser rejects dangerous link targets such as javascript:, so [Unsafe](javascript:alert(1)) stays as literal text. Ordinary https and relative links become a elements.',
      question: 'Why is my javascript: link shown as plain text?',
    },
    {
      answer:
        'Partly. Extended mode adds pipe tables and ~~strikethrough~~, but task lists such as - [ ] stay literal text and bare URLs are not turned into links. CommonMark mode supports neither tables nor strikethrough.',
      question: 'Does it support GitHub Flavored Markdown?',
    },
    {
      answer:
        'Turn on Soft newlines as line breaks, or end a line with two spaces or a backslash to create a hard break. Otherwise a single newline stays an ordinary newline inside the same p element.',
      question: 'How do I keep single line breaks inside a paragraph?',
    },
    {
      answer:
        'No highlighter is applied. A fenced block that starts with ```js becomes <pre><code class="language-js">, so a highlighter on your own page can style it.',
      question: 'Are code blocks syntax highlighted?',
    },
    {
      answer:
        'Both syntax modes write HTML5 void elements without a closing slash: <br>, <hr> and <img …>, matching the standalone document’s <!doctype html>. XHTML-style <br /> output is not offered.',
      question: 'Why does the output use <br> instead of <br />?',
    },
  ],
  help: 'Paste Markdown or apply a complete sample. Empty input is valid.\n\nChoose Extended or CommonMark syntax and decide how soft newlines should behave.\n\nRun the tool. Visual preview shows document structure; HTML source shows the exact copied and exported markup.\n\nChoose a fragment for an existing page, or a standalone document with charset, viewport and escaped title.\n\nCopy or download markdown.html. Links retain their target in a tooltip; image placeholders show alt text and addresses without making requests.',
  notes: [
    'Runs locally with bundled markdown-it 15. No upload, external parser, script evaluation or image request is used.',
    'Limits: 100,000 UTF-16 input units, 10,000 parsed tokens, fewer than 60 parsed nesting levels and 1,000,000 rendered fragment units. Oversized or excessively nested documents return an error, not a silently truncated export.',
    'NUL and unpaired Unicode surrogates are rejected. Parser line endings are normalized to LF; nonempty HTML normally ends with a newline. Markdown whitespace is interpreted, not preserved byte-for-byte.',
    'Raw HTML is escaped, not passed through or sanitized. There is deliberately no unsafe raw-HTML toggle.',
    'Dangerous link protocols are rejected by the parser. Relative and external links and image addresses remain in the export; opening that file may contact their destinations. Review URLs before publishing.',
    'The preview never uses innerHTML. It does not fetch even data images. Image placeholders and inactive links are preview-only; exported HTML uses img and a elements.',
    'Extended mode supports tables and strikethrough, not task-list checkboxes, footnotes, math, Mermaid or a full GFM spec. Bare URLs are not automatically linked; typography substitutions are disabled.',
    'Fenced code retains its text and language class when supplied. No syntax highlighter or executable code is loaded.',
    'Standalone export wraps the same fragment with doctype, charset, viewport and title. Application preview styles, fonts and themes are not embedded.',
    'An empty fragment exports an empty file; an empty standalone document still has its wrapper. Copy always copies HTML, never the visual preview text.',
  ],
};
