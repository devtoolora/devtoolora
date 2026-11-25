import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A duration is a length of time with no start date. It is written in many ways: 90 minutes, 1h 30m, 01:30:00, the ISO 8601 form PT1H30M, or a bare number of seconds. This tool reads any of them and shows the same duration in every other form.',
        'The result lists exact milliseconds, a clock time, a human reading, the ISO 8601 duration and the total in days, hours, minutes and seconds. Everything runs locally in your browser or editor.',
      ],
      title: 'What is a duration converter?',
    },
    {
      content: [
        'Turn a timeout or TTL in seconds into hours and minutes you can read.',
        'Write a config value as ISO 8601 for an API, a calendar or a schema.',
        'Convert a video or log length such as 01:30:00 into milliseconds.',
        'Add up mixed tokens like 1w 2d 3h into one total.',
      ],
      title: 'When to use Duration Converter',
    },
  ],
  examples: [
    '90 with Bare number unit set to Minutes → 1 h 30 min, 01:30:00, PT1H30M, 5400000 ms.',
    '1h 30m 15s 250ms → 5415250 ms, clock 01:30:15.250.',
    'P1DT2H → 1 d 2 h, 26 hours in total, 93600000 ms.',
    '1:30 → 1 h 30 min (hours and minutes).',
    '250 with Bare number unit set to Milliseconds → 250 ms, PT0.25S.',
    '2w 3d → 17 days, P17D.',
  ],
  faq: [
    {
      answer:
        'Months and years have no fixed length: a month is 28 to 31 days and a year is 365 or 366. A duration written in them cannot be converted to exact milliseconds, so the ISO output uses days, hours, minutes and seconds only, and input with Y or M before T is rejected.',
      question: 'Why are months and years not supported?',
    },
    {
      answer:
        'A clock form with one colon is hours and minutes, so 1:30 is 1 hour 30 minutes. With two colons it is hours, minutes and seconds, so 01:30:00 is the same duration. Minutes and seconds must be below 60, and hours are not capped.',
      question: 'How is 1:30 read?',
    },
    {
      answer:
        'A plain number such as 90 has no unit in the text, so it takes the one chosen in Bare number unit, seconds by default. Set it to minutes and 90 becomes 1 h 30 min. Numbers with a unit, like 90m, ignore the setting.',
      question: 'What does a bare number mean?',
    },
  ],
  help: 'Type a duration in any supported form and the result updates.\n\nTokens combine amounts and units: w, d, h, m (minutes), s and ms (milliseconds). Units are case-insensitive, each may appear once, decimals such as 1.5h are fine, and spaces are optional.\n\nISO 8601 accepts PnW or PnDTnHnMnS, for example P2W, P1DT2H or PT1H30M. Clock forms are h:mm, hh:mm:ss and hh:mm:ss.mmm.\n\nA plain number uses Bare number unit. Copy the JSON or insert it into the editor.',
  notes: [
    'Accepted input: a number (in the chosen unit), unit tokens such as 1h 30m 15s 250ms, ISO 8601 PnW or PnDTnHnMnS, and clock forms h:mm, hh:mm:ss and hh:mm:ss.mmm with minutes and seconds below 60.',
    'Months and years are not accepted because their length varies. A year count above the limit still reports the limit error.',
    'Durations are limited to 1,000 years, counted as 1000 x 365.25 days in milliseconds. Negative and empty values are rejected.',
    'Results are rounded to whole milliseconds. Totals are plain fractions of a day, hour, minute and second; the clock hour is not capped at 24.',
  ],
};
