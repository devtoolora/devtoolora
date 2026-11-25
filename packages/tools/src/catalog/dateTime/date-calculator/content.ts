import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A date calculator works on calendar dates, not moments in time. It tells you how many days, weeks, months or business days separate two dates, adds or subtracts an amount, and describes a single date.',
        'Dates use the proleptic Gregorian calendar with no time zones, written as YYYY-MM-DD for the years 0001 to 9999. Everything runs locally in your browser or editor.',
      ],
      title: 'What is a date calculator?',
    },
    {
      content: [
        'Count the days to a release, a deadline or a contract end.',
        'Find the date 30 days or 3 business days from now.',
        'Look up the weekday, ISO week number or day of the year of a date.',
        'Check whether a year is a leap year and how long a month is.',
      ],
      title: 'When to use Date Calculator',
    },
  ],
  examples: [
    '2024-01-01 to 2024-03-01 → 60 days, 8 weeks and 4 days, 44 business days, 2 months.',
    '2024-01-31 plus +1m → 2024-02-29 (clamped to the last day of February).',
    '2026-10-23 plus +1bd → 2026-10-26 (Friday to Monday).',
    '2026-10-20 plus +1y 2m 3w 4d → 2028-01-14.',
    '2027-01-01 date info → Friday, ISO week 2026-W53-5.',
    'Blank start date → today, from your device clock.',
  ],
  faq: [
    {
      answer:
        'The start date is counted and the end date is not. From Monday 2026-10-19 to Monday 2026-10-26 there are 5 business days, Monday to Friday. Weekends count as no business days, and public holidays are not known to the tool.',
      question: 'How are business days counted?',
    },
    {
      answer:
        'The day is clamped to the last day of the target month. Adding one month to 2024-01-31 gives 2024-02-29, and adding one year to 2024-02-29 gives 2025-02-28. Years are applied first, then months, then weeks and days.',
      question: 'What happens when the day does not exist in the new month?',
    },
    {
      answer:
        'Business days cannot be mixed with other units, because the result would depend on the order of the steps. Use +5bd on its own, or calendar units such as +2w 3d on their own. Amounts are limited to 100,000 units.',
      question: 'Why can I not combine business days with days?',
    },
  ],
  help: 'Choose a mode and type the start date as YYYY-MM-DD. Leave it blank to use today.\n\nDifference compares the start date with the end date and lists days, weeks, business days, months, years and a readable span. If the end is earlier, the values are negative.\n\nAdd or subtract takes an amount such as +1y 2m 3w 4d, -10d or +5bd. Units are y, m, w, d and bd for business days.\n\nDate info shows the weekday, ISO week, day of the year, days in the month, quarter and leap year flag. Copy the JSON or insert it into the editor.',
  notes: [
    'Dates must be real calendar dates: 2026-02-30 is rejected. Years run from 0001 to 9999.',
    'Calculations use UTC midnight, so daylight saving time and time zones never change a result.',
    'Business days are Monday to Friday. Holidays are not taken into account.',
    'Only the blank start or end date reads your device clock; all other results are fully deterministic.',
  ],
};
