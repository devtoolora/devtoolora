import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A Unix timestamp counts time since 1970-01-01T00:00:00Z, the Unix epoch, without leap seconds. APIs and logs write it in seconds (1700000000), milliseconds (1700000000000, as JavaScript Date.now() returns), microseconds or nanoseconds (common in Go and OpenTelemetry).\n\nThe converter detects the unit from the number of integer digits: up to 11 digits are seconds, 12–14 milliseconds, 15–17 microseconds and 18 or more nanoseconds. Choose Unit when a value is ambiguous.\n\nText is read as ISO 8601 (2026-06-02, 2026-06-02T10:00:00Z or 2026-06-02T10:00:00+02:00) or as an HTTP or RFC 2822 date. Input without an offset is read in the selected time zone, with daylight saving gaps and overlaps resolved and explained.',
      title: 'What is a Unix timestamp?',
    },
    {
      content: [
        'Read created_at, exp or ts values from logs, databases and tokens in your own time zone.',
        'Turn a local meeting or incident time into UTC and Unix seconds for an API call or a query.',
        'Paste a column of mixed timestamps to compare them side by side in a table.',
      ],
      title: 'When to convert timestamps',
    },
  ],
  examples: [
    '1700000000 → 2023-11-14T22:13:20.000Z, detected as Unix seconds (10 digits).',
    '1700000000000 → the same instant, detected as milliseconds (13 digits).',
    '2026-06-02 in America/New_York → local 2026-06-02T00:00:00-04:00, which is 2026-06-02T04:00:00.000Z.',
    '2026-03-29T02:30 in Europe/Prague → shown as 03:30+02:00, because 02:30 does not exist when daylight saving starts.',
    'Tue, 02 Jun 2026 10:00:00 GMT in Europe/Prague → RFC 2822 Tue, 02 Jun 2026 12:00:00 +0200.',
    '2021-01-03 → ISO week 2020-W53-7: ISO weeks start on Monday and week 1 contains the first Thursday.',
    'Blank input → the current time; several lines → one table row per value.',
  ],
  faq: [
    {
      answer:
        'Count the digits: current Unix time has 10 digits in seconds and 13 in milliseconds. Auto reads up to 11 digits as seconds, 12–14 as milliseconds, 15–17 as microseconds and more as nanoseconds; set Unit to override it.',
      question: 'Is my timestamp in seconds or milliseconds?',
    },
    {
      answer:
        'Input without Z or an offset is read in the selected Time zone, so 2026-06-02 in America/New_York is 2026-06-02T04:00:00.000Z. Add Z or an offset such as +02:00, or set Time zone to UTC.',
      question: 'Why is my date a few hours off in UTC?',
    },
    {
      answer:
        'Yes. Paste one value per line, up to 1,000 lines, and each becomes a table row with ISO, local time, Unix seconds and milliseconds. A line that cannot be read shows its error in that row without stopping the rest.',
      question: 'Can I convert a whole column of timestamps?',
    },
    {
      answer:
        'Leave the input empty: the converter shows the current time in every format, including Unix seconds and milliseconds, using this device’s clock.',
      question: 'How do I get the current Unix timestamp?',
    },
    {
      answer:
        'Unix time counts seconds since 1970-01-01T00:00:00Z and suits storing and comparing; ISO 8601 writes the same instant as readable text. 1700000000 and 2023-11-14T22:13:20.000Z are the same moment.',
      question: 'What is the difference between Unix time and ISO 8601?',
    },
  ],
  help: 'Paste one timestamp or date, or one per line for a table. Leave the input blank for the current time. Results update as you type.\n\nChoose the time zone for local time and for reading dates written without an offset. Local uses this device’s time zone.\n\nIf a number is read in the wrong unit, choose Unit: seconds, milliseconds, microseconds or nanoseconds.\n\nCopy the format you need: ISO 8601 in UTC, local ISO with offset, Unix seconds or milliseconds, RFC 2822, HTTP date, relative time, weekday or ISO week.',
  notes: [
    'Conversion is local and uses the time zone database built into your browser or editor.',
    'Unix time has no leap seconds, so a time such as 23:59:60 is rejected.',
    'Dates use the proleptic Gregorian calendar; JavaScript can represent about 275,000 years either side of 1970.',
    'Digits below one millisecond are dropped, because JavaScript dates count whole milliseconds.',
    'A date without a time is read as midnight in the selected time zone, not in UTC as new Date("2026-06-02") does.',
    'Text that is neither ISO 8601 nor a number goes to the runtime’s date parser, which can differ between browsers; a note says when that happened.',
    'When clocks fall back, a repeated local time maps to the earlier instant, and a note says the time was ambiguous or skipped.',
    'Limits: 256 characters per value and 1,000 lines.',
  ],
};
