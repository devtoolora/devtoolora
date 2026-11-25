import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'HTTP fields are named text values attached to a request or response. Field names are case-insensitive; their value syntax depends on the particular field.',
        'This parser accepts a copied header block with an optional request/status line. It groups repeated names into arrays while rawHeaders retains spelling, order and individual values.',
        'It never combines Set-Cookie with commas, sends a request or interprets credentials. A blank line ends the block; nonblank body text after it is rejected.',
      ],
      title: 'What is HTTP header parsing?',
    },
    {
      content: [
        'Compare repeated headers and inspect casing without losing source order.',
        'Read copied request/response metadata in an expandable JSON report.',
        'Use Raw HTTP Request Inspector for full messages, and a separate redactor before sharing credentials.',
      ],
      title: 'When to use HTTP Headers Parser',
    },
  ],
  examples: [
    'Content-Type: application/json → headers["content-type"] "application/json".',
    'Two Set-Cookie lines → headers["set-cookie"] as an array of two separate values.',
    'X-Trace: a then x-trace: b → headers["x-trace"] ["a", "b"], with both spellings kept in rawHeaders.',
    'GET http://example.com/path HTTP/1.1 → startLine, despite the colon in the URL.',
    'X-Empty: → headers["x-empty"] "".',
    'Host : example.com or an indented continuation line → error.',
  ],
  faq: [
    {
      answer:
        'No. Content-Type and content-type are the same field, so headers groups them under the lowercase name. rawHeaders keeps each line’s original spelling and order when you need to see exactly what was sent.',
      question: 'Are HTTP header names case-sensitive?',
    },
    {
      answer:
        'Cookie values and dates can contain commas, so joining Set-Cookie lines with commas would corrupt them. Each line stays a separate array item, and other repeated fields are kept as separate items too.',
      question: 'Why are Set-Cookie headers not combined into one?',
    },
    {
      answer:
        'No. A blank line ends the header block, and any text after it is rejected. Paste only the start line and headers; for a whole request with a body, use Raw HTTP Request Inspector.',
      question: 'Can I paste a full response with its body?',
    },
    {
      answer:
        'In Chrome, Edge or Firefox DevTools, open the Network panel, select the request and switch the headers to the raw view. curl -sI https://example.com prints response headers in the same format.',
      question: 'Where do I copy raw headers from?',
    },
    {
      answer:
        'No. Values are reported exactly as pasted, including Authorization and Cookie. Run the text through Secret Redactor before you share it or the report.',
      question: 'Does it redact cookies or Authorization headers?',
    },
  ],
  help: 'Paste header lines, optionally preceded by one request/status line.\n\nRun parsing and inspect normalized headers and ordered rawHeaders.\n\nCorrect an invalid line using its diagnostic; body text must be removed or handled by the full request inspector.\n\nCopy or download the JSON report. Authorization and cookie values are preserved, not redacted.',
  notes: [
    'Input is at most 1,048,576 UTF-16 characters. CR/CRLF become line boundaries, and an initial BOM is removed.',
    'Header names must be ASCII HTTP tokens; whitespace before the colon and obsolete folded lines are unsupported.',
    'Disallowed control characters are rejected. Surrounding value whitespace is trimmed; internal horizontal tabs remain.',
    'Request/status lines support HTTP/1.0, HTTP/1.1 and readable HTTP/2 or HTTP/3 labels. This does not decode binary HTTP/2 or HTTP/3 wire framing.',
    'Pseudo-headers such as :status and :authority are read as headers. Multiple response blocks and trailers are unsupported.',
    'Parsing does not validate field-specific semantics, conflicting Content-Length/Transfer-Encoding or request-smuggling safety.',
    'No network, TLS, DNS or server validation occurs. Report and export can contain credentials and personal data.',
    'Original source is omitted from new native VS Code drafts, but older saved drafts are not purged.',
  ],
};
