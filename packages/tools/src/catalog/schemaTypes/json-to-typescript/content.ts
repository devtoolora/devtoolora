import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'TypeScript types describe the shape of data at compile time. This generator reads a JSON sample and writes an interface or type alias for every object it finds, so editors can autocomplete fields and the compiler can flag typos.\n\nRecords in one array are merged into a single item type. A property missing from some records becomes optional (?), and a property whose values differ becomes a union such as string | null. Nested objects get their own named declarations, such as UserProfile, and plural array names are singularized: items becomes Item.\n\nTypes exist only at compile time and do not check data at runtime. Use JSON to Zod Schema or JSON Schema Validator when untrusted input has to be validated.',
      title: 'What is JSON to TypeScript conversion?',
    },
    {
      content: [
        'Type an API response, webhook payload or configuration file from a real example instead of writing interfaces by hand.',
        'Paste several records as one JSON array to discover optional fields and nullable values before they cause runtime errors.',
        'Draft declarations for a shared types package, then rename them and narrow string fields to literal unions where your domain allows it.',
      ],
      title: 'When to generate TypeScript types',
    },
  ],
  examples: [
    '{"id":1,"name":"Ada"} → export interface Root { id: number; name: string; }',
    '[{"id":1,"email":"ada@example.com"},{"id":2}] → email?: string, because the second record has no email.',
    '[{"meta":null},{"meta":{"a":1}}] → meta: RootItemMeta | null, with RootItemMeta declared below.',
    'Root name Users and an array of objects → export type Users = User[]; followed by export interface User.',
    '[1,"a",null] → (string | number | null)[]; the parentheses make the union apply to each item.',
    '[] → unknown[] and {} → Record<string, unknown>, because an empty sample shows no item or property types.',
    'Type alias + Readonly → export type Root = { readonly tags: readonly string[]; };',
  ],
  faq: [
    {
      answer:
        'Either works for object shapes. Interfaces can be extended and merged, while type aliases can also name unions and arrays; choose Type alias under Declarations if your codebase prefers it. A root array or scalar always becomes a type alias.',
      question: 'Should I generate interfaces or type aliases?',
    },
    {
      answer:
        'With Observed, a property gets ? only when some objects in the same array lack it. A single object sample therefore makes every property required; paste several records as an array or choose All optional.',
      question: 'How does it decide which properties are optional?',
    },
    {
      answer:
        'JSON has no date type, so a value such as "2026-01-01T00:00:00Z" arrives as a string and is typed string. Convert it to a Date in your own code after parsing.',
      question: 'Why are dates typed as string instead of Date?',
    },
    {
      answer:
        'No. TypeScript types are removed when the code is compiled, so a response with the wrong shape is not detected at runtime. Use JSON to Zod Schema to generate a runtime validator from the same sample.',
      question: 'Do the generated types validate API responses at runtime?',
    },
    {
      answer:
        'Each nested object is named after its parent type plus the PascalCase property name, such as RootUser for user. Array items use a singular form, so categories becomes RootCategory, and a repeated name gets a numeric suffix.',
      question: 'How are nested types named?',
    },
  ],
  help: 'Paste a JSON value or apply a sample. To merge several records, supply them as one JSON array. The output updates as you type.\n\nName the root type. Choose interface or type alias, exported or local declarations, readonly properties and whether optional means missing in some records or every property.\n\nReview the declarations: the root comes first and nested types follow in the order they appear. Check unions and optional fields against your API documentation.\n\nCopy, insert or save types.ts. For runtime validation of the same data, open JSON to Zod Schema with the same sample.',
  notes: [
    'Generation is local. The JSON is parsed in the browser or editor and never uploaded or executed.',
    'Inference reflects only the supplied sample. A field that is present in every record becomes required even if your API documents it as optional.',
    'Numbers become number, because TypeScript has no integer type. Strings stay string: dates, emails and IDs are not narrowed to literal or branded types.',
    'Objects in one array are merged by property name. Discriminated unions, where a field such as type decides the shape of the rest, are not inferred and need manual refinement.',
    'Property names that are not valid identifiers are quoted, for example "a/b". Type names are PascalCase versions of property names with accents removed; a repeated name gets a numeric suffix.',
    'Property order follows the first record in which each key appears. JavaScript always lists integer-like keys such as "1" before other keys.',
    'Limits: 1,000,000 input characters, 200,000 JSON values and properties, 64 nesting levels and 1,000,000 output characters. Larger input is rejected, never truncated.',
    'A duplicate key in the JSON keeps its last value, as JSON.parse does, and the summary names the key and line.',
    'A number beyond the range of a double, such as 1e400, or one that would become 0, such as 1e-400, is rejected.',
  ],
};
