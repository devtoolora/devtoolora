import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Markdown is a plain-text format for headings, links, lists, code and other document structure. This helper parses CommonMark syntax before deciding what is markup and what is literal code.',
        'It removes recognized raw HTML when requested and reduces excess blank lines outside protected code, lists, block quotes and retained HTML blocks. It does not pretty-print or reserialize your entire document.',
        'Clean Markdown is returned without appending a statistics footer. Counts appear in the result summary; the JSON report includes the cleaned source and its statistics.',
      ],
      title: 'What is Markdown cleanup?',
    },
    {
      content: [
        'Prepare a README or documentation fragment for a Markdown-only workflow.',
        'Remove raw HTML blocks and inline tags while retaining literal HTML examples inside code.',
        'Check actual ATX/Setext headings, inline/reference/autolinks and images.',
        'Export a cleaned .md file, or a JSON report for a downstream check.',
      ],
      title: 'When to use Markdown Helper',
    },
  ],
  examples: [
    'Title / ===== → counted as 1 heading (Setext), not only lines starting with #.',
    'Read <b>this text</b>, ok. → Read this text, ok. with Remove raw HTML.',
    'Use `<span>code</span>` → unchanged; literal code is protected from HTML removal.',
    '<script> / alert(1) / </script> block → removed as a whole, including its contents.',
    'See <https://example.test> → unchanged; a CommonMark autolink is not an HTML tag.',
    'a / four blank lines / b → a / one blank line / b; blank lines inside fenced code remain.',
  ],
  faq: [
    {
      answer:
        'No. It removes raw HTML tags, comments and HTML blocks, but links and images stay exactly as written, so [x](javascript:alert(1)) remains in the cleaned source. Render untrusted Markdown with a sanitizing renderer.',
      question: 'Does removing raw HTML make Markdown safe to publish?',
    },
    {
      answer:
        'In CommonMark, an HTML block such as <div> ends at the first blank line. With <div>, a blank line, **bold**, a blank line and </div>, only the <div> and </div> blocks are removed and the bold paragraph remains.',
      question: 'Why was Markdown inside my <div> kept when the tags were removed?',
    },
    {
      answer:
        'Only the tags are removed and the text between them stays: Read <b>this text</b>, ok. → Read this text, ok. Inline HTML comments are removed the same way, which can leave two adjacent spaces.',
      question: 'What happens to text inside inline tags like <b>?',
    },
    {
      answer:
        'No. It parses CommonMark only, so a pipe table is ordinary paragraph text and is left as written; task lists and footnotes are not recognized either. Blank-line cleanup can still shorten the gap after a table.',
      question: 'Does it understand GitHub tables, task lists or footnotes?',
    },
    {
      answer:
        'Lists, block quotes, fenced and indented code, and retained HTML blocks are protected, so blank lines inside them are kept. Elsewhere, two or more consecutive blank lines become one.',
      question: 'Why weren’t the blank lines in my list collapsed?',
    },
  ],
  help: 'Paste Markdown or apply a sample. Empty input is valid.\n\nChoose whether raw HTML should be removed. HTML blocks are removed entirely, not converted to readable Markdown.\n\nChoose whether surplus blank lines should be reduced. Code content, indentation and two-space hard breaks are protected.\n\nRun Markdown Helper. Inspect the source and the counts in the summary; this is not a rendered preview or a security audit.\n\nCopy or Download cleaned.md. Choose JSON report to export markdown-report.json, including the cleaned source and counts.',
  notes: [
    'Runs locally without rendering HTML, loading images, resolving URLs or executing code.',
    'Uses markdown-it 15 CommonMark mode, without GFM tables, task-list or footnote plugins, smart typography or bare-URL linkification.',
    'Supports 100,000 UTF-16 units and 10,000 parsed tokens. NUL and unpaired Unicode surrogates are rejected. The parser limits nested containers to 64 levels.',
    'CRLF and CR line endings are normalized to LF. Outer whitespace and the existing final newline are otherwise retained unless excess blank-line cleanup changes them.',
    'Raw HTML blocks are removed as whole blocks, including text inside them. Inline HTML tokens are removed but their surrounding Markdown text remains. Images, links, escapes, entities and literal code are not rewritten.',
    'HTML removal is not an HTML/Markdown security sanitizer. The result can still contain links or image references; use a safe renderer and sanitization policy before publishing untrusted Markdown.',
    'Statistics describe the cleaned output. Headings include ATX and Setext headings; links include resolved references and CommonMark autolinks. Images are counted separately. Undefined references and unsafe destinations rejected by the parser are not counted as links.',
    'Words count parsed prose text with English Intl.Segmenter rules, excluding code, HTML blocks, link destinations, reference definitions and image alt text. This is not the same as counting raw Markdown words; use Text Statistics for raw-source measurements.',
    'The .md artifact is exactly the cleaned source, even if empty. Statistics are never appended to it. The JSON report contains the full cleaned text, not just counts.',
  ],
};
