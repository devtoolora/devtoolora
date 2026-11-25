import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Web servers such as Apache and nginx write one line per request in the common or combined log format: client address, user, time, request, status code, response size and, in the combined format, the referer and user agent. Reading those lines by eye does not scale past a few dozen requests.',
        'This tool parses every line with one fixed pattern and shows the result as a table, as a list of error responses (status 400 and above) or as a summary with status classes, busiest paths, client addresses, user agents and total bytes.',
        'Lines that do not match the format are not guessed at; their line numbers are listed in the summary. Everything runs locally in your browser.',
      ],
      title: 'What is Access Log Parser?',
    },
    {
      content: [
        'Find which paths or clients generate the most traffic in a slice of a log.',
        'Pull out the 4xx and 5xx responses after a deploy.',
        'Check that a log file really is in the combined format before feeding it to other tools.',
      ],
      title: 'When to use Access Log Parser',
    },
  ],
  examples: [
    '203.0.113.5 - - [27/Oct/2026:10:48:01 +0000] "GET /index.html HTTP/1.1" 200 5120 gives one table row with status 200 and 5120 bytes.',
    'A response size of - is shown as - in the Bytes column and counted as zero in the summary.',
    'A request written as "-" gets method - and the whole text as the path.',
    'The Errors view keeps only lines whose status is 400 or higher.',
    'The Summary view with Top entries set to 3 lists the three busiest paths, IPs and user agents.',
    'Time is shown as ISO 8601 UTC; a time that cannot be read is shown as written.',
  ],
  faq: [
    {
      answer:
        'The Apache and nginx common format, and the combined format that adds the referer and user agent in double quotes. Custom LogFormat layouts are not recognized.',
      question: 'Which log formats are supported?',
    },
    {
      answer:
        'It is listed in the summary by line number (the first 20) and left out of the table. Blank lines are ignored and not counted as unparsed.',
      question: 'What happens to lines that do not match?',
    },
    {
      answer:
        'Times are converted to UTC using the offset in the log line, so lines from servers in different zones sort correctly.',
      question: 'How are time zones handled?',
    },
    {
      answer:
        'Top entries limits the lists of paths, IPs and user agents in the summary, from 1 to 100. Ties are sorted alphabetically.',
      question: 'What does Top entries do?',
    },
  ],
  help: 'Paste lines from an Apache or nginx access log or apply a sample.\n\nChoose Table to see every parsed request, Errors to keep only status 400 and above, or Summary for counts and top lists.\n\nSet Top entries to control how long the top lists are in the summary.\n\nCopy or save the result as TSV or text. Log contents are not redacted.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters and 100,000 lines. No network requests are made.',
    'Only the common and combined log formats are parsed; each line must match completely.',
    'Top entries must be a whole number from 1 to 100.',
    'The summary lists at most the first 20 unparsed line numbers.',
    'User agents are cut to 80 characters in the table; the summary shows them in full.',
    'Escaped quotes inside the referer and user agent are unescaped.',
    'Output is not redacted and can contain addresses, user names and URLs; review before sharing.',
  ],
};
