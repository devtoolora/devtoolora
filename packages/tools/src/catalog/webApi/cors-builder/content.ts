import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Cross-Origin Resource Sharing (CORS) lets a server tell the browser which other origins may read its responses. The server answers with Access-Control-* headers; the browser, not the server, enforces them.',
        'This tool builds two header sets: the response to the OPTIONS preflight request and the response to the actual request. It adds Vary: Origin whenever a specific origin is echoed, so caches never serve one origin the answer meant for another.',
        'It also explains how the browser decides whether a preflight is needed and flags risky choices such as the null origin, wildcards with credentials and a max age that browsers cap.',
      ],
      title: 'What is a CORS header builder?',
    },
    {
      content: [
        'Use it when a front end on one origin calls an API on another and the browser console reports a blocked cross-origin request.',
        'Pick the methods and request headers your API really accepts, list each allowed origin on its own line, then copy the headers into your server or proxy configuration.',
        'Compare the result with HTTP Headers Parser output from a real response, and pair it with CSP Builder & Analyzer for the rest of your security headers.',
      ],
      title: 'When to use CORS Header Builder',
    },
  ],
  examples: [
    'https://app.example.com with GET, POST and Content-Type, Authorization → preflight required, Vary: Origin added.',
    '* with GET, HEAD → Access-Control-Allow-Origin: * and no Vary header; no preflight for simple requests.',
    'Credentials with two origins → the first origin is shown, and the notes say the server must echo exactly one per request.',
    'Allow private network → adds Access-Control-Allow-Private-Network: true to the preflight response.',
    'Exposed headers X-Request-Id, ETag → Access-Control-Expose-Headers on the actual response.',
    'Max age 86400 → an info finding that Chromium caps the cache at 7,200 seconds.',
  ],
  faq: [
    {
      answer:
        'Browsers reject Access-Control-Allow-Origin: * on a request that includes credentials. The tool replaces * with the first named origin and reports a high finding; with only *, it stops with an error.',
      question: 'Why is * rejected together with credentials?',
    },
    {
      answer:
        'A preflight is sent for methods beyond GET, HEAD and POST, and for request headers beyond Accept, Accept-Language, Content-Language and Content-Type. Content-Type avoids it only for form, multipart and text/plain bodies.',
      question: 'When does the browser send a preflight?',
    },
    {
      answer:
        'The header can hold only one origin, so a server with several allowed origins must check the request Origin and echo it back. Vary: Origin keeps caches from mixing the answers.',
      question: 'How do I allow several origins?',
    },
    {
      answer:
        'Sandboxed iframes and local files send Origin: null, so any page can claim it. Allowing null effectively allows everyone, which is why it is a high finding.',
      question: 'Why is the null origin risky?',
    },
  ],
  help: 'List allowed origins one per line, using *, null or scheme://host[:port].\n\nTick the methods, then type allowed and exposed headers as comma-separated lists. Add credentials, a max age or private network access if you need them.\n\nThe result has the preflight headers, the actual response headers and a short note on how the browser decides. Findings are sorted from high to info.\n\nCopy or download the headers. Nothing is sent anywhere and no server is configured.',
  notes: [
    'Input is at most 100 origins, and each of the origins, methods and header fields at most 2,048 characters; the max age is 0 to 31,536,000 seconds. Origins have no path, query or trailing slash and are lowercased.',
    'Methods default to GET and POST when none is ticked; only GET, HEAD, POST, PUT, PATCH, DELETE and OPTIONS are accepted.',
    'Allowed and exposed headers are comma-separated lists; * is accepted. Authorization is never covered by * when credentials are allowed.',
    'With several origins or with credentials, the output uses the first listed origin and tells the server to echo exactly one per request.',
    'Chromium caps Access-Control-Max-Age at 7,200 seconds and Firefox at 86,400 seconds, so larger values are reported as info.',
    'The tool writes headers only; it does not run a server, test a live endpoint or check that your API sends them.',
  ],
};
