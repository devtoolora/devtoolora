import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An HTTP status is a three-digit response code. The first digit defines its class: informational, success, redirection, client error or server error.',
        'This is a bundled reference of common codes, not a server checker or a live copy of the complete IANA registry. Empty input shows the catalog grouped by class.',
        'An unknown bundled code gets an explicit not-in-reference result. A malformed value is an error; neither silently returns the entire catalog as a match.',
      ],
      title: 'What is an HTTP status code?',
    },
    {
      content: [
        'Look up a common response code while debugging.',
        'Compare status classes without issuing a network request.',
        'Use the linked IANA registry for assignments outside this local subset.',
      ],
      title: 'When to use HTTP Status Lookup',
    },
  ],
  examples: [
    '200 → 200 OK, listed under 2xx Success when the input is empty.',
    '204 → 204 No Content: success without a response body.',
    '308 → 308 Permanent Redirect; unlike 301, the method and body must not change.',
    '404 → 404 Not Found, which does not say why the resource is missing.',
    "418 → 418 (Unused; historically I'm a teapot).",
    '499 → 499: Not in the bundled status reference.',
    '4xx or 600 → error: enter a three-digit code from 100 through 599.',
  ],
  faq: [
    {
      answer:
        '401 Unauthorized means the request has no valid credentials, and the server should say how to authenticate in WWW-Authenticate. 403 Forbidden means the server understood the request but refuses it, for example because the credentials it got lack permission.',
      question: 'What is the difference between 401 and 403?',
    },
    {
      answer:
        '301 and 308 are permanent redirects; 302 and 307 are temporary. With 307 and 308 the client must repeat the same method and body, while clients have historically turned a POST into a GET after 301 or 302.',
      question: 'What is the difference between 301, 302, 307 and 308?',
    },
    {
      answer:
        '418 comes from an April Fools’ RFC (2324) and is not a standard HTTP status. IANA lists it as unused and reserved because so much software already knows it, which is how this reference labels it.',
      question: 'Is 418 I’m a teapot a real status code?',
    },
    {
      answer:
        '499 is a nonstandard code that nginx logs when the client closes the connection before the response. This reference bundles 49 common registered codes, so vendor-specific values such as 499 or Cloudflare’s 52x get a not-in-reference result.',
      question: 'Why is 499 not in the list?',
    },
    {
      answer:
        'No. It is an offline reference: type a code to read its name. To see what a server actually returns, request it with curl -I or open your browser’s network panel.',
      question: 'Does it check the status of a URL?',
    },
  ],
  help: 'Leave the input empty to browse all bundled codes.\n\nEnter exactly one three-digit code or apply a sample; lookup updates automatically.\n\nRead the matched label, explicit missing-reference result or validation error.\n\nCopy or download the exact text. This tool does not request or monitor a URL.',
  notes: [
    'Input must be a three-digit decimal code from 100 through 599, with optional outer whitespace; maximum raw length is 32 characters.',
    'The bundled table is a curated subset, not all registered or nonstandard status codes.',
    'The reason phrase is descriptive text. A successful status does not prove correctness, authorization or safety of returned content.',
    'Some codes are deprecated or unused; do not infer a recommended application choice from historical labels.',
    'No network request, health check, redirect handling or response verification occurs.',
    'Registry reference: https://www.iana.org/assignments/http-status-codes (checked 2026-10-13).',
  ],
};
