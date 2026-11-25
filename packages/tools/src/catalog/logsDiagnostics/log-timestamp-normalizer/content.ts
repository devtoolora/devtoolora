import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Log files rarely agree on how to write a time. Syslog prints Oct 27 10:48:01 with no year, Apache wraps 27/Oct/2026:10:48:01 +0200 in brackets, applications emit ISO 8601, and some services only log a Unix timestamp. Comparing lines from several sources means converting all of them first.',
        'This tool finds the first timestamp on every line, converts it to a single output format and leaves the rest of the line untouched. You can replace the original text or prepend the normalized value followed by a tab.',
        'Times without an offset are read in the time zone you choose; times with an explicit offset or a Unix timestamp are absolute. Everything runs locally in your browser.',
      ],
      title: 'What is Log Timestamp Normalizer?',
    },
    {
      content: [
        'Merge logs from several hosts or services into one sortable timeline.',
        'Convert Unix timestamps in a debug dump into readable times.',
        'Prepare lines for a diff or a sort when the sources use different date styles.',
      ],
      title: 'When to use Log Timestamp Normalizer',
    },
  ],
  examples: [
    'Oct 27 10:48:01 host sshd → 2026-10-27T10:48:01Z host sshd with year 2026 and time zone UTC.',
    '[27/Oct/2026:10:48:01 +0200] GET / → [2026-10-27T08:48:01Z] GET /.',
    '1793090881 start → 2026-10-27T08:48:01Z start.',
    '1793090881123 start → 2026-10-27T08:48:01.123Z start.',
    '2026-10-27 10:48:01,123 INFO → 2026-10-27T10:48:01.123Z INFO when the zone is UTC.',
    '2026-10-27 10:48:01+02 pg → 2026-10-27T08:48:01Z pg, whatever zone is selected.',
    '2026-10-27 10:48:01.123 UTC [1] LOG → 2026-10-27T10:48:01.123Z [1] LOG, whatever zone is selected.',
    'req 1234567890 at 2026-10-27T10:48:01Z → the number stays and the dated time is converted.',
    '27/10/2026 10:48:01 with Day/Month/Year → 2026-10-27T10:48:01Z when the zone is UTC.',
    'Prefix mode turns Oct 27 10:48:01 x into 2026-10-27T10:48:01Z, a tab, then the original line.',
  ],
  faq: [
    {
      answer:
        'Syslog, Apache access log, ISO 8601 with a T or a space, RFC 2822 email dates, slashed dates such as 10/27/2026 10:48:01, and Unix timestamps of 10 digits (seconds) or 13 digits (milliseconds).',
      question: 'Which timestamp formats are recognized?',
    },
    {
      answer:
        'Syslog has no year, so the Year field supplies it. It defaults to the current year; set it explicitly for old logs and for lines written around New Year.',
      question: 'Where does the year come from for syslog lines?',
    },
    {
      answer:
        'Only the first timestamp on each line, by position. Later timestamps on the same line stay as they were, so message text that quotes another time is not rewritten. A bare 10 or 13 digit number counts only when the line has no dated timestamp, because it may be an ID.',
      question: 'Are all timestamps on a line converted?',
    },
    {
      answer:
        'Lines with no recognized timestamp, and lines whose date is impossible such as Feb 30 or 25:00:00, are copied unchanged and counted as unchanged in the summary.',
      question: 'What happens to lines without a timestamp?',
    },
    {
      answer:
        'Yes. Offsets of +02:00, +0200 and +02 and common zone names such as UTC, CET and EST are accepted. Times without one use the selected time zone, and a time that falls in a daylight saving gap (such as 02:30 on the spring change) is shifted forward by the gap, and a time that occurs twice in the autumn overlap resolves to the earlier instant.',
      question: 'Are time zone offsets handled?',
    },
  ],
  help: 'Paste log lines or apply a sample.\n\nChoose the output format, the time zone for times without an offset, and the year for syslog lines.\n\nPick Replace to rewrite the timestamp in place, or Prefix to keep the original line after the normalized time.\n\nCopy or save the result. Log contents are not redacted.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters and 100,000 lines. No network requests are made.',
    'The year must be between 1970 and 2100 and is used only for syslog lines.',
    'Only the first timestamp on each line is converted; other occurrences are kept as written. A dated timestamp is preferred over an earlier bare number.',
    'Recognized zone names are UTC, UT, GMT, WET, WEST, CET, CEST, EET, EEST and the US names EST to PDT. CST means US Central, as in RFC 5322, not China Standard Time. Other names such as JST stay as text and the time is read in the selected zone.',
    'Unix timestamps must be 10 digits (seconds) or 13 digits (milliseconds), start with 1 to 9 and stand alone, not inside a longer number or word.',
    'Fractions are truncated to 3 digits and printed only when the source had one; Unix seconds output drops them.',
    'Impossible dates and times such as Feb 30, Oct 32 or 25:00:00 are left unchanged.',
    'Output is not redacted and can contain host names, addresses and user names; review before sharing.',
  ],
};
