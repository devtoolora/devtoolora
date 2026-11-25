import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Zod is a TypeScript-first validation library. A Zod schema checks data at runtime, such as a fetch response or a form submission, and z.infer derives the matching TypeScript type from the same schema.\n\nThis generator uses the same inference as JSON to TypeScript Types. Records in one array are merged, a property missing from some records gets .optional(), a property that is sometimes null gets .nullable(), and one that is both gets .nullish().\n\nWith format inference on, consistent samples produce stricter validators. Whole numbers become z.int(), and strings that are all emails, http(s) URLs, UUIDs, ISO dates or ISO date-times become z.email(), z.url(), z.uuid(), z.iso.date() or z.iso.datetime(). Zod 3 output uses the z.string().email() style instead.',
      title: 'What is a Zod schema?',
    },
    {
      content: [
        'Validate API responses, webhook bodies, localStorage values or JSON configuration at runtime instead of trusting a TypeScript cast.',
        'Start a form, tRPC procedure or API contract from a real payload, then tighten it with .min(), .max(), z.enum() or refinements.',
        'Keep one source of truth: export the inferred type with z.infer instead of maintaining a separate interface.',
      ],
      title: 'When to generate a Zod schema',
    },
  ],
  examples: [
    '{"id":1,"name":"Ada"} → z.object({ id: z.int(), name: z.string() })',
    '[{"email":"ada@example.com"},{}] → email: z.email().optional()',
    '[{"meta":null},{"meta":{"a":1}}] → meta: z.object({ a: z.int() }).nullable()',
    '"2026-01-02T10:00:00Z" → z.iso.datetime(); a value with +02:00 → z.iso.datetime({ offset: true })',
    'Strict objects → z.strictObject({ … }) in Zod 4 or z.object({ … }).strict() in Zod 3; unknown keys are rejected.',
    '{} → z.record(z.string(), z.unknown()) and [] → z.array(z.unknown())',
    'Zod 3 + formats → z.number().int(), z.string().email(), z.string().datetime()',
  ],
  faq: [
    {
      answer:
        'Both. Zod 4 output uses top-level validators such as z.email() and z.int(), while Zod 3 output uses z.string().email() and z.number().int(). Pick the Zod version that matches the zod package in your project.',
      question: 'Does it generate Zod 3 or Zod 4 code?',
    },
    {
      answer:
        '.optional() allows the key to be missing, .nullable() allows null and .nullish() allows both. The generator picks one per field depending on whether records in the sample omit the key, contain null or both.',
      question: 'What is the difference between .optional(), .nullable() and .nullish()?',
    },
    {
      answer:
        'With Infer formats and integers on, a field whose sample values are all whole numbers becomes z.int(), and 2.0 counts as whole because JSON parsing turns it into 2. Turn inference off, or change the field to z.number() if decimals are allowed.',
      question: 'Why is my number field z.int()?',
    },
    {
      answer:
        'Turn on Strict objects. Zod 4 output then uses z.strictObject() and Zod 3 output adds .strict(), so parsing fails when the data contains a key that is not in the schema.',
      question: 'How do I make the schema reject unknown keys?',
    },
    {
      answer:
        'No. A field such as "type":"a" becomes z.string(), and records with different shapes are merged into one object with optional fields. Replace them with z.enum() or z.discriminatedUnion() by hand.',
      question: 'Does it detect enums or discriminated unions?',
    },
  ],
  help: 'Paste a JSON value or apply a sample. Supply several records as one JSON array so optional and nullable fields can be detected. The output updates as you type.\n\nPick Zod 4 or Zod 3 syntax to match the zod version in your package.json. Set the schema name, strict objects, format inference and optional properties.\n\nReview the schema. Formats and integers are inferred from the sample only, so turn inference off when a field may later hold other values.\n\nCopy, insert or save schema.ts and install zod in your project. Call Schema.parse() to throw on invalid data or Schema.safeParse() to get a result object.',
  notes: [
    'Generation is local. The tool writes code; it does not import or run Zod, and your project needs its own zod dependency.',
    'Format inference is all or nothing per field: one plain string keeps the field as z.string(). Emails use Zod’s ASCII email pattern, URLs need http or https and a domain, and UUIDs need an RFC version and variant digit.',
    'Date-times are recognized only with seconds and a Z or ±HH:MM offset. Local date-times without a zone, and impossible dates such as 2026-02-30, stay z.string().',
    'Decimals and integers outside ±9007199254740991 become z.number(). JSON.parse has already rounded such large integers, so quote them in the source to keep exact digits.',
    'Objects in one array are merged by property name. Discriminated unions, enums, lengths, ranges and refinements are not inferred; add them by hand.',
    'A "__proto__" key is left out with a comment, because Zod drops it from parsed data. With Strict objects on, that object stays non-strict so the schema still accepts the sample.',
    'Limits: 1,000,000 input characters, 200,000 JSON values and properties, 64 nesting levels and 1,000,000 output characters. Larger input is rejected, never truncated.',
    'A duplicate key in the JSON keeps its last value, as JSON.parse does, and the summary names the key and line.',
    'A number beyond the range of a double, such as 1e400, or one that would become 0, such as 1e-400, is rejected.',
  ],
};
