import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A traditional five-field cron expression lists minute, hour, day of month, month and day of week. Each field accepts *, numbers, ascending ranges, comma lists and steps such as */15; the month and weekday fields also accept English names such as JAN or MON.\n\nCron fields describe calendar matches, not elapsed-time intervals: */35 in the minute field means minutes 0 and 35 of every hour, not every 35 minutes.\n\nWhen both day fields are restricted, traditional cron runs on either one, so 0 9 1 * MON means the 1st of the month or any Monday. A day field that starts with * combines with AND in Vixie cron and cronie; other schedulers can differ, and the tool flags those cases.',
      title: 'What is a cron expression?',
    },
    {
      content: [
        'Understand a schedule from a crontab, CI workflow or Kubernetes CronJob before deploying it.',
        'Build a schedule from a preset or individual fields without memorizing the syntax.',
        'Check the next run times in UTC or in this device’s timezone, including across month ends and leap days.',
        'Catch common mistakes, such as reading 1 plus MON as the first Monday or a minute step that does not divide 60.',
      ],
      title: 'When to use Cron Explainer & Generator',
    },
  ],
  examples: [
    '*/15 * * * * → minutes 0, 15, 30 and 45 of every hour.',
    '*/35 * * * * → minutes 0 and 35 of each hour, so the gaps are 35 and 25 minutes, not a steady 35-minute interval.',
    '0 9 * * MON-FRI → 09:00 on weekdays; the next runs list the coming weekday mornings in the chosen timezone.',
    '0 9 1 * MON → the 1st of the month OR any Monday, not the first Monday of the month.',
    '0 0 29 FEB * → only in leap years, so the next runs jump from one 29 February to the next.',
    '0 0 31 APR * → never runs; the tool warns that no calendar date fits and lists no runs.',
    'Builder with the Weekdays at 09:00 preset → 0 9 * * 1-5.',
  ],
  faq: [
    {
      answer:
        'It runs at 09:00 Monday through Friday: minute 0, hour 9, any day of the month, any month and weekdays 1–5. The explanation also lists the next run dates so you can check them.',
      question: 'What does 0 9 * * 1-5 mean?',
    },
    {
      answer:
        'When both day fields are restricted, traditional cron runs when either one matches, so this means the 1st of the month or any Monday. Five-field cron has no first-Monday selector.',
      question: 'Why does 0 9 1 * MON also run on other Mondays?',
    },
    {
      answer:
        'No. Only five-field Unix cron is read, so six- or seven-field Quartz expressions and the ?, L, W and # characters fail with an error. @daily and similar macros fail too; write 0 0 * * * instead.',
      question: 'Does it support seconds, Quartz syntax or @daily?',
    },
    {
      answer:
        'Yes. The explanation lists the next 5, 10 or 25 runs after now, or after a start you enter as YYYY-MM-DD HH:MM, in UTC or this device’s timezone. Nothing is scheduled or executed.',
      question: 'Can I see when a cron schedule runs next?',
    },
    {
      answer:
        'One five-field line cannot, because steps restart every hour: */90 in the minute field just means minute 0. Two crontab lines, 0 0-21/3 * * * and 30 1-22/3 * * *, together fire every 90 minutes.',
      question: 'How do I run a job every 90 minutes?',
    },
  ],
  help: 'Choose Expression to paste or type a schedule, or Builder to start from a preset; pick Custom fields in Builder to edit minute, hour, day, month and weekday separately.\n\nRead the plain-English explanation, the expanded field values, the day matching rule and any warnings. Invalid syntax is reported for the exact field.\n\nChoose UTC or This device for the next runs and how many to list. Optionally enter a start such as 2026-12-24 18:00 to look ahead from that moment instead of now.\n\nSet Output to Expression to copy only the schedule, or to JSON audit for every field set and run time, then save cron-expression.txt, cron-explanation.txt or cron-report.json.',
  notes: [
    'Supports the Unix five-field subset: *, decimal values, ascending ranges, comma lists and positive steps on * or a range. English month and weekday names are case-insensitive, and 7 and SUN mean Sunday like 0.',
    'Quartz ?, L, W and #, Jenkins H, @daily-style macros, ~ randomization, steps on a single value, seconds, years and commands are rejected explicitly rather than guessed.',
    'Steps reset at each field boundary. A minute step that does not divide 60 creates uneven gaps across the hour, and the explanation does not call it a continuous duration.',
    'Next runs are calculated, not executed: no job is created or run. They follow Vixie cron and cronie day matching and look up to 25 years ahead.',
    'UTC has no daylight-saving changes. In This device mode, minutes skipped by a clock change are left out and repeated minutes are listed once; real schedulers handle those hours in different ways.',
    'The scheduler’s timezone decides when a job really runs. GitHub Actions schedules use UTC, while a server crontab normally uses the server’s local timezone.',
    'Input is limited to 256 characters on one line. Invalid syntax returns no partial report, and an explicitly empty expression fails instead of falling back to a default.',
  ],
};
