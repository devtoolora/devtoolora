import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A HAR (HTTP Archive) file is a JSON recording of the requests a browser made while loading a page. Browser developer tools export one from the Network panel, but the raw JSON is far too large to read by hand.',
        'This tool reads a HAR file and shows every request as a table with method, status, URL, type, size, time and wait, as a summary grouped by content type, host and status class, or as a list of failed requests.',
        'Fields that are missing or have an unexpected type become a dash instead of an error. Everything runs locally in your browser.',
      ],
      title: 'What is HAR Viewer?',
    },
    {
      content: [
        'Find the slowest or largest requests in a captured page load.',
        'List failed requests (status 0 or 400 and above, or a recorded error) after a deploy.',
        'Check which hosts a page talks to before sharing a capture.',
      ],
      title: 'When to use HAR Viewer',
    },
  ],
  examples: [
    'A response with status 404 and application/json content shows type json in the table.',
    'A content size of -1 falls back to the body size; if that is also unknown the cell shows -.',
    'A request that never got a response has status 0 and appears in the Failures view with its recorded error.',
    'A time stored as a string instead of a number is shown as - rather than guessed.',
    'The Summary view groups bytes by content type, largest first.',
    'Long URLs are shortened in the middle with an ellipsis to 120 characters.',
  ],
  faq: [
    {
      answer:
        'Open the Network panel in your browser developer tools, reload the page and use the export option to save all requests as a HAR file.',
      question: 'How do I get a HAR file?',
    },
    {
      answer:
        'Yes. A HAR file can contain cookies, tokens and request bodies. This tool reads only method, URL, status, type, size and timing, and nothing leaves your browser.',
      question: 'Is it safe to open a HAR file with secrets?',
    },
    {
      answer:
        'The file field takes precedence over the text box. Choose a file or paste the JSON, not both.',
      question: 'Should I paste the JSON or pick a file?',
    },
    {
      answer:
        'Failures are requests with status 0, status 400 and above, or an error recorded by the browser, such as a refused connection.',
      question: 'What counts as a failure?',
    },
  ],
  help: 'Choose a local HAR file or paste the HAR JSON, or apply a sample.\n\nSelect Table to see every request, Summary for totals by type, host and status class, or Failures to keep only failed requests.\n\nSizes use decimal units and times are in milliseconds.\n\nCopy or save the result as TSV or text. Contents are not redacted.',
  notes: [
    'Input is limited to 10,485,760 characters, 10 MiB for a file and 10,000 entries. No network requests are made.',
    'The HAR must be JSON with a log.entries array; anything else is rejected.',
    'Missing or malformed fields are shown as a dash and never stop the run.',
    'Size uses the content size, or the body size when the content size is unknown. The content size is the decoded response and includes responses served from cache, so totals are not the bytes sent over the network.',
    'The span is the time from the first request start to the last response end.',
    'Slowest 5 and Largest 5 skip entries with an unknown time or size.',
    'The summary lists the 10 busiest hosts; the rest are counted.',
    'Only method, URL, status, type, size and timing are read; headers, cookies and bodies are ignored.',
    'Output is not redacted; URLs can contain tokens, so review before sharing.',
  ],
};
