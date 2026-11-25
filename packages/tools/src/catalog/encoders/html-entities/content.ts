import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'HTML character references let markup represent characters such as < and & without treating them as tag syntax or the start of another reference.\n\nEncode escapes &, <, >, double quotes and apostrophes while preserving other Unicode text; Decode resolves HTML named references and decimal or hexadecimal numeric references without rendering or executing markup.',
      title: 'What are HTML entities?',
    },
    {
      content: [
        'Prepare a literal markup example to display as text in an HTML page.',
        'Read escaped text, symbols and non-breaking spaces from a template, log or test fixture.',
        'Check one layer of escaping before inserting text into an HTML text node or a quoted attribute.',
      ],
      title: 'When to use HTML Entities',
    },
  ],
  examples: [
    'Encode: <b>A&B</b> → &lt;b&gt;A&amp;B&lt;/b&gt;',
    'Encode: "it\'s" → &quot;it&#39;s&quot;',
    'Decode: &lt;b&gt;A&lt;/b&gt; → <b>A</b>',
    'Decode named symbols: &copy; &euro; &mdash; → © € —',
    'Decode numeric Unicode: &#269; &#x2713; &#128014; → č ✓ 🐎',
    'Decode once: &amp;lt; → &lt; (not <)',
  ],
  faq: [
    {
      answer:
        'Only the five HTML syntax characters: & becomes &amp;, < becomes &lt;, > becomes &gt;, " becomes &quot; and \' becomes &#39;. Accented letters, emoji and other Unicode text stay as they are, which is valid in UTF-8 HTML.',
      question: 'Which characters does Encode escape?',
    },
    {
      answer:
        'A named reference such as &eacute; uses a name from the HTML list, while a numeric one gives the code point in decimal (&#233;) or hexadecimal (&#xE9;). Decode turns all three into é.',
      question: 'What is the difference between named and numeric entities?',
    },
    {
      answer:
        'Decode once for each layer of escaping. &amp;lt; becomes &lt; after the first pass, and decoding that result again gives <. Check the output after each pass so you stop at the layer you need.',
      question: 'How do I fix double-escaped text such as &amp;lt;?',
    },
    {
      answer:
        'It is the right escaping for text inside an HTML element or a quoted attribute value. JavaScript, CSS, URLs and unquoted attributes need different encoding, and this tool does not sanitize untrusted HTML or remove tags.',
      question: 'Is HTML entity encoding enough to prevent XSS?',
    },
    {
      answer:
        'No. The decoded result is plain text: tags such as <img onerror> are shown as characters, never rendered or executed, and the tool makes no network request.',
      question: 'Does decoding render or run the HTML?',
    },
  ],
  help: 'Choose Encode for literal text or markup, or Decode for text that contains character references.\n\nPaste the source without adding surrounding quotes, or apply a sample; spaces and line breaks are preserved.\n\nFor Decode, write named references such as &copy; and numeric references such as &#269; or &#x1F40E; with their trailing semicolon.\n\nRun the conversion and copy the plain-text result, or use “Use result & reverse” to switch direction with the result as input.',
  notes: [
    'Decode recognizes the HTML named character reference table, including references that produce two Unicode code points; names are case-sensitive, so &copy; and &COPY; are valid but &Copy; is not.',
    'A trailing semicolon is required: unknown names, malformed references and references without it remain unchanged; this intentionally avoids the legacy partial decoding a browser may apply to missing semicolons.',
    'Numeric references follow HTML rules: null, surrogate and out-of-range values become the replacement character �; some legacy values are remapped, for example &#128; becomes €.',
    'Decode removes one escaping layer only; &nbsp; becomes an actual non-breaking space (U+00A0), not an ordinary space, and spaces, tabs and line breaks are preserved.',
    'Encoding also escapes existing ampersands: &lt; becomes &amp;lt;, so avoid encoding an already escaped value unless another layer is intentional.',
    'This is not an HTML sanitizer or an XSS validator; escaping for JavaScript, CSS, URLs and unquoted attributes requires different rules.',
  ],
};
