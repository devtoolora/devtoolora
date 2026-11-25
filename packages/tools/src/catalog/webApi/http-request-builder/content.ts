import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An HTTP request is a method, a URL, headers and an optional body. The builder assembles one from form fields: it adds query parameters, encodes the body as JSON, form data or raw text, and adds Bearer, API key or Basic authentication.\n\nIt writes the request as a cURL command, a JavaScript fetch call, a raw HTTP/1.1 message and Python requests code, ready for a terminal, a browser console or a script.\n\nNothing is sent: the tool only writes code.',
      title: 'What is an HTTP request builder?',
    },
    {
      content: [
        'Prepare a reproducible API call for a bug report, documentation or a teammate.',
        'Switch a call between cURL, fetch and Python without retyping headers.',
        'Check how a JSON or form body and authentication end up on the wire.',
      ],
      title: 'When to build a request',
    },
  ],
  examples: [
    'POST https://api.example.com/items with JSON {"name":"Ada"} → Content-Type: application/json is added.',
    'Query lines page=2 and tag=local → https://api.example.com/items?page=2&tag=local.',
    'Bearer token abc → Authorization: Bearer abc, unless you typed an Authorization header yourself.',
    'API key in the query → ?X-API-Key=value is appended to the URL.',
    'Basic auth ada and secret → Authorization: Basic YWRhOnNlY3JldA==.',
    'Export Raw HTTP → POST /items HTTP/1.1 with Host and Content-Length headers.',
  ],
  faq: [
    {
      answer:
        'No. It only writes code: a cURL command, a fetch call, a raw HTTP/1.1 message and Python requests code. Copy a snippet into a terminal, browser console or script to actually call the API.',
      question: 'Does the HTTP Request Builder send the request?',
    },
    {
      answer:
        'The username and password are joined with a colon and Base64-encoded, so ada and secret become Authorization: Basic YWRhOnNlY3JldA==. Base64 is reversible encoding, not encryption, so send it only over HTTPS.',
      question: 'How is Basic auth encoded?',
    },
    {
      answer:
        'The builder writes it, but the summary warns that fetch rejects a body on GET and HEAD. cURL and Python requests can send one, although many servers ignore it; use POST, PUT or PATCH for request bodies.',
      question: 'Can I send a GET request with a JSON body?',
    },
    {
      answer:
        'Prefer a header when the API allows it. Query strings end up in server logs, browser history and Referer headers, so choose API key location Query only when the API requires a parameter such as api_key.',
      question: 'Should I put an API key in a header or the query string?',
    },
    {
      answer:
        'Body format JSON parses the text and writes it back compactly, which removes whitespace, keeps only the last value of a duplicate key and stops on invalid JSON or on a number such as 1e400 or 1e-400. A number a double cannot hold, such as 12345678901234567890, keeps its exact digits. To send the text exactly as typed, choose Raw and set Raw content type to application/json.',
      question: 'Why is my JSON body minified?',
    },
  ],
  help: 'Enter the URL and choose the method. Add query parameters and headers, one per line.\n\nChoose a body format and enter the body; JSON is validated and minified.\n\nChoose an authentication method and fill in its fields. Password fields are not saved in drafts.\n\nChoose an export, then copy or save the snippet. All shows a request summary and every format.',
  notes: [
    'No request is sent and nothing is uploaded. The snippets contain your credentials, so share them with care.',
    'Headers you type take precedence over the generated Content-Type and Authorization headers.',
    'cURL output uses single-quoted POSIX shell arguments and --globoff, so brackets and braces in a URL stay literal, and --head for HEAD; on Windows, run it in Git Bash or WSL, or adapt the quoting for PowerShell.',
    'fetch drops headers that browsers control, such as Host, Connection and Content-Length, and browsers block cross-origin calls that the server does not allow with CORS.',
    'GET and HEAD requests cannot carry a body in fetch.',
    'Raw HTTP output uses HTTP/1.1 with CRLF line endings and a Content-Length counted in UTF-8 bytes.',
    'Multipart forms and file uploads are not supported.',
  ],
};
