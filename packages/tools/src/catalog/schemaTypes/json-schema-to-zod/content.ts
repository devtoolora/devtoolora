import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'JSON Schema describes the shape of JSON data with keywords such as type, properties, required, enum and $ref. Zod describes the same shape in TypeScript and validates it at runtime, so a schema can be turned into Zod code instead of being rewritten by hand.',
        'This tool compiles the schema into declarations: the root schema first in the schema, then every entry of $defs or definitions. Output is ordered so that every schema is declared after the schemas it references, and each one can be followed by a z.infer type.',
        'Everything runs in your browser. The schema is never sent anywhere and nothing is stored.',
      ],
      title: 'What is JSON Schema to Zod?',
    },
    {
      content: [
        'Generate runtime validators for an API response or request body from an OpenAPI component schema or a vendor-supplied JSON Schema.',
        'Keep constraints that plain TypeScript types lose: minLength, maxLength, pattern, format, minimum, maximum, multipleOf and array bounds become Zod checks.',
        'Target either Zod 4 or Zod 3 and see how formats such as email or uuid change between the two APIs.',
      ],
      title: 'When to use JSON Schema to Zod',
    },
  ],
  examples: [
    '{"type":"string","format":"email"} → export const RootSchema = z.email();',
    '{"type":"string","minLength":2,"pattern":"^[a-z]+$"} → z.string().min(2).regex(/^[a-z]+$/u)',
    '{"type":"integer","minimum":0,"exclusiveMaximum":10} → z.number().int().min(0).lt(10)',
    '{"type":"string","enum":["a","b"]} → z.enum([\'a\', \'b\'])',
    '{"type":["string","null"]} → z.string().nullable()',
    '{"type":"array","prefixItems":[{"type":"string"}],"items":{"type":"number"}} → z.tuple([z.string()]).rest(z.number())',
    '{"allOf":[{"$ref":"#/definitions/A"},{"type":"object"}]} → ASchema.and(z.object({}))',
  ],
  faq: [
    {
      answer:
        'Not in Zod output. Zod needs lazy getters for self-references, so a schema that refers back to itself stops with an error. The JSON Schema to TypeScript tool handles recursive types.',
      question: 'Are recursive schemas supported?',
    },
    {
      answer:
        'Zod 4 has top-level helpers such as z.email(), z.uuid() and z.iso.datetime(). Zod 3 uses methods on z.string(), such as z.string().email(), z.string().date() and z.string().datetime().',
      question: 'How do Zod 4 and Zod 3 output differ?',
    },
    {
      answer:
        'No. Only local pointers that start with # are resolved. A remote $ref stops with an error asking you to inline the schema, because the tool never makes network requests.',
      question: 'Does it follow remote $ref URLs?',
    },
    {
      answer:
        'Keywords with no Zod equivalent, such as if, then, not, uniqueItems or patternProperties, are skipped and listed as ignored comments. So is a required name with no declared property, and a constraint such as minimum in a schema without a type. A pattern that is not a valid regular expression is dropped and listed the same way.',
      question: 'What happens to keywords it cannot express?',
    },
    {
      answer:
        'An object without additionalProperties becomes z.object, which strips unknown keys. additionalProperties false gives a strict object, and a schema for additionalProperties adds catchall.',
      question: 'How are extra properties handled?',
    },
  ],
  help: 'Paste a JSON Schema (draft-07, 2019-09 or 2020-12, or an OpenAPI schema object) and the Zod code appears as you type.\n\nSet the root schema name, pick Zod 4 or Zod 3 and decide whether a z.infer type is exported next to each schema.\n\nSchemas that use if, then, not or patternProperties still convert; those keywords are listed as ignored comments below the code.\n\nCopy the result, send it to the scratchpad or save it as schema.ts.',
  notes: [
    'The schema is limited to 250,000 characters and 5,000 values or properties.',
    'Nesting is limited to 64 levels.',
    'Generated code is limited to 1,000,000 characters.',
    'Only local $ref pointers to the root (#), $defs and definitions are resolved; remote references are rejected.',
    'Recursive and mutually recursive schemas are rejected because Zod output needs them declared in dependency order.',
    'At most 50 ignored keywords are listed, deduplicated by keyword and location; a last comment counts the rest. Validation keywords next to a $ref are dropped and listed too, while annotations such as title and description are not.',
    'A nested object with a title becomes its own schema named after the title, the same way $defs entries do. A name that would shadow a TypeScript global such as Date or Record gets a Type suffix, as in DateTypeSchema and DateType.',
    'Property descriptions are not emitted; only the description of a declaration becomes .describe().',
    'date-time accepts a UTC offset. time becomes a regular expression in both Zod versions, because the Zod time helpers reject the offset that RFC 3339 requires. Zod 3 maps date to z.string().date().',
    'A pattern is written with the u flag, as JSON Schema defines it; one that only compiles without the flag is written without it.',
    'prefixItems become required tuple positions, so a shorter array is rejected even when the schema allows it.',
    'An unknown type such as "foo" stops with an error.',
    'A duplicate key in the schema is an error, because a parser would silently keep only the last value.',
  ],
};
