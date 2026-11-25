import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'JSON Schema describes the shape and rules of JSON data: types, object properties, required fields and array items. A validator checks real data against that contract.\n\nThis generator starts from the values you supply. It merges object samples inside each array, marks consistently present fields as required and preserves mixed objects, arrays and scalar values with anyOf.\n\nInference is a starting point, not a business contract. A sample cannot prove which values will appear later or which fields your API truly requires.',
      title: 'What is JSON Schema?',
    },
    {
      content: [
        'Draft a schema for an API response, event payload or configuration file before reviewing it with the consuming application.',
        'Compare several records in one array to reveal optional fields, nullable values and heterogeneous item types.',
        'Copy the generated schema into JSON Schema Validator to test the original sample and intentional invalid variants.',
      ],
      title: 'When to generate JSON Schema',
    },
  ],
  examples: [
    '{"id":1,"name":"Ada"} → an object with integer id and string name, both required by default.',
    '[{"id":1,"email":"ada@example.com"},{"id":2}] → id is required; email is optional.',
    '[{"value":null},{"value":{"active":true}}] → value remains required and accepts null or an object via anyOf.',
    '[1,2.5] → number items; [1,2] → integer items. String "001" stays a string.',
    '[] → array with unconstrained items because no item type was observed.',
    'Allow additional properties + All optional → a more permissive starting point at every nested object.',
  ],
  faq: [
    {
      answer:
        'Draft 2020-12 by default, with 2019-09 and Draft 7 available under Schema draft. The chosen draft is written to $schema, and JSON Schema Validator accepts all three.',
      question: 'Which JSON Schema draft does the generator produce?',
    },
    {
      answer:
        'With Observed required, a property is required when it appears in every object merged at that position, such as every record of an array. A property whose value is null still counts as present. Choose All optional to omit required lists.',
      question: 'How does the generator decide which properties are required?',
    },
    {
      answer:
        'By default every object gets additionalProperties: false, so data with keys that were not in the sample fails validation. Turn on Allow additional properties to accept unknown keys at every nesting level.',
      question: 'Why does the generated schema reject extra properties?',
    },
    {
      answer:
        'No. Strings are typed only as string; no format, pattern, enum or length is guessed from sample values. Add those constraints by hand, or use JSON to Zod Schema, which can infer email, URL, UUID and ISO date validators.',
      question: 'Does the generator detect formats such as email or date?',
    },
    {
      answer:
        'The sample is parsed into JavaScript numbers, where 1.0 and 1 are the same value, so a whole number is typed integer. Include a sample such as 1.5 or change the type to number if decimals are allowed.',
      question: 'Why is 1.0 typed as integer?',
    },
    {
      answer:
        'Paste the records as one array so they are merged; the result is an array schema whose items keyword holds the merged record schema. Copy that items object if you need the schema of a single record.',
      question: 'How do I get a schema for one record instead of an array?',
    },
  ],
  help: 'Paste valid JSON or apply a sample. To compare multiple records, supply them as one JSON array.\n\nChoose the schema draft and required-field policy. Decide whether future properties should be allowed instead of relying on the sample alone.\n\nRun and inspect the generated types, required lists and anyOf alternatives. Add domain-specific constraints such as enum, format or minimum yourself.\n\nCopy the schema or save schema.json. Open JSON Schema Validator, paste the schema into its schema field and test both expected and invalid data.',
  notes: [
    'Generation is local. The output is a schema for the entire input value; wrapping records in an array produces an array schema, not a schema for one record.',
    'Default output uses draft 2020-12, observed required fields and additionalProperties: false. Required fields and nullability are independent.',
    'Object variants are merged by property name. Mixed structural types use anyOf; this does not infer discriminated unions or preserve correlations between properties.',
    'No enum, numeric bounds, string patterns, dates, email formats or array-length constraints are invented from sample values. Empty arrays leave item types unconstrained.',
    'Integers outside ±9007199254740991 are rejected: quote them to preserve exact digits. Decimal values use JavaScript numeric precision.',
    'The __proto__ name is represented by an exact patternProperties rule so AJV cannot silently skip it; other property names and Unicode are preserved.',
    'Input limits: 1,000,000 characters and 50,000 JSON values/properties. Generated schemas: 250,000 characters and 5,000 values/properties. Both have a 64-level nesting limit; oversized output is rejected, never truncated.',
    'A duplicate key in the JSON keeps its last value, as JSON.parse does, and the summary names the key and line.',
  ],
};
