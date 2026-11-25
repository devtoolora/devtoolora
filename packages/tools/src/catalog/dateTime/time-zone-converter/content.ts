import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A time zone converter answers one question: what is the wall clock time in other places at this exact moment? Each row shows the local date and time, the UTC offset in force on that date, and how many calendar days it lies ahead of or behind the source zone.',
        'Zones are IANA names such as Europe/Prague or America/New_York. They carry the full daylight saving history, so the offset is right for the date you enter, not for today. Everything runs locally from the time zone data of your browser or editor.',
      ],
      title: 'What is a time zone converter?',
    },
    {
      content: [
        "Plan a meeting across offices: enter the time in your zone and read everyone else's local time and day.",
        'Check what a server timestamp means for users in another region.',
        'Find out whether a release window crosses midnight in a target zone.',
        'Compare half-hour and quarter-hour offset zones such as Asia/Kolkata or Asia/Kathmandu.',
      ],
      title: 'When to use Time Zone Converter',
    },
  ],
  examples: [
    '2026-07-01T12:00 from UTC to Europe/Prague → 2026-07-01 14:00:00, +02:00, same day.',
    '2026-07-01T23:00 from America/Los_Angeles to Asia/Tokyo → 2026-07-02 15:00:00, +09:00, next day.',
    '1700000000 (Unix seconds) → 2023-11-14T22:13:20.000Z in every listed zone.',
    '2026-07-01T12:00:00+02:00 → the offset in the text wins; From time zone is ignored.',
    'Blank input → the current moment.',
  ],
  faq: [
    {
      answer:
        'Abbreviations such as CST or IST are shared by several regions and change with daylight saving time. IANA names identify one region and its full rule history, so the conversion is unambiguous.',
      question: 'Why IANA names and not abbreviations?',
    },
    {
      answer:
        'A skipped local time (spring forward) is read as the matching later time, and a repeated one (fall back) as the earlier occurrence, exactly as in Timestamp Converter. The result explains it in notes. Add an explicit offset to pick the other moment.',
      question: 'What happens during a daylight saving change?',
    },
    {
      answer:
        'Local uses the time zone your browser or editor reports through Intl. It is read on your device only and never sent anywhere. Pick an IANA name when you need the same result on every machine.',
      question: 'Where does the local time zone come from?',
    },
    {
      answer:
        'Abbreviations like CEST or PST are not part of the IANA database and are not unique: CST can mean US Central, China or Cuba. Libraries disagree on them, so this tool only accepts full region names.',
      question: 'Why are abbreviations like CEST not reliable?',
    },
  ],
  help: 'Type a date and time, or leave the input blank to use the current moment.\n\nChoose From time zone for a date-time written without an offset, such as 2026-10-17T14:00. A value with Z or an offset, and a Unix timestamp, already names an exact moment and ignores that setting.\n\nList the target zones in Convert to, separated by commas. Use IANA names like Europe/Prague. Blank entries are ignored.\n\nEach row shows local time, the UTC offset on that date and the day shift. Copy the result as JSON or insert it into the editor.',
  notes: [
    'Input is read by the same parser as Timestamp Converter: blank (now), ISO 8601 with or without an offset, or a Unix timestamp whose digit count picks seconds (up to 11), milliseconds, microseconds or nanoseconds. Input is limited to 256 characters.',
    'A local time skipped by a daylight saving change is read as the matching later time, and a repeated one as the earlier occurrence. For example 2026-03-29T02:30 in Europe/Prague becomes 01:30 UTC and 2026-10-25T02:30 becomes 00:30 UTC; the result notes say so.',
    'The Day column counts calendar days against the source zone, so zones far apart can show +2 days or -2 days.',
    'Up to 50 target zones are converted at once; more are rejected with an error naming the limit.',
    'An unknown time zone is an error that names the zone. Results depend on the time zone data of your browser or editor.',
  ],
};
