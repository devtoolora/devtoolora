import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'HTTP/1.x requests are plain text: a request line such as POST /items HTTP/1.1, header lines, a blank line and an optional body. You see them in proxies such as Burp Suite or mitmproxy, in server logs, in .http files and in specifications.\n\nThe inspector parses that text, resolves the target against the Host header or a base URL, keeps repeated headers in order, and turns the request into cURL, fetch, raw HTTP or Python code.',
      title: 'What is a raw HTTP request?',
    },
    {
      content: [
        'Replay a request captured in a proxy or a log from the command line.',
        'Turn an example from API documentation into code.',
        'Check the method, URL and headers a client actually sent.',
      ],
      title: 'When to inspect a raw request',
    },
  ],
  examples: [
    'GET /items?page=2 HTTP/1.1 with Host: api.example.com → https://api.example.com/items?page=2.',
    'Default scheme HTTP → http://… for internal hosts without TLS.',
    'Base URL https://staging.example.com → used instead of the Host header for relative targets.',
    'Two X-Trace headers → both kept, in order.',
    'CRLF or LF line endings → both accepted.',
    'GET https://example.com/ HTTP/1.1, the absolute form proxies use → the URL is used as written.',
  ],
  faq: [
    {
      answer:
        'From intercepting proxies such as Burp Suite, mitmproxy or Fiddler, from .http files, and from API documentation that shows requests in wire format.',
      question: 'Where can I get a raw HTTP request?',
    },
    {
      answer:
        'A target such as /items?page=2 is joined to the Host header using Default scheme, HTTPS unless you pick HTTP. A Base URL, when set, replaces both, which helps replay a production capture against localhost or staging.',
      question: 'How is the full URL worked out from a path?',
    },
    {
      answer:
        'The first line must be METHOD target HTTP/1.1 or HTTP/1.0 with an uppercase method. HTTP/2 labels, a missing version and pseudo-headers such as :authority are rejected; rewrite the line as HTTP/1.1 to convert the request.',
      question: 'Why is my request line rejected?',
    },
    {
      answer:
        'Yes. The cURL, fetch and raw HTTP exports keep every line in its original order and spelling. Python requests takes one value per name, so the Python export combines repeats, Cookie with "; " and others with ", ". Set-Cookie values cannot be combined, so only the last one is sent there. A comment above the call notes either change.',
      question: 'Are repeated headers kept?',
    },
    {
      answer:
        'No. The request is parsed and rewritten as code on your device; nothing is sent. The exports keep the cookies and tokens from the capture, so redact them before sharing.',
      question: 'Does inspecting a request send it to the server?',
    },
  ],
  help: 'Paste the raw request: the request line, headers, a blank line and the body.\n\nIf the target is a path, the Host header supplies the host. Set Default scheme, or a Base URL to override the host.\n\nChoose an export format. The result updates as you type.\n\nCopy or save the snippet; nothing is sent.',
  notes: [
    'Parsing is local. Requests often carry cookies and tokens, so the input is not saved in drafts.',
    'Only HTTP/1.0 and HTTP/1.1 text is supported; HTTP/2 frames and HAR files are not.',
    'Chunked and multipart bodies are copied as text, not decoded. Body bytes stay as pasted, including CRLF line ends and a trailing newline; a body of only blank lines counts as no body.',
    'Obsolete header folding, where a header continues on an indented line, is rejected.',
    'fetch output drops Host, Connection and Content-Length, because browsers set them.',
    'cURL output uses single-quoted POSIX shell arguments and --globoff, so brackets and braces in a URL stay literal. HEAD requests use --head.',
    'Python requests takes one value per header name, so repeated headers are combined, Cookie with "; " and others with ", ". Repeated Set-Cookie lines cannot be combined; only the last is sent, and a comment says so.',
  ],
};
