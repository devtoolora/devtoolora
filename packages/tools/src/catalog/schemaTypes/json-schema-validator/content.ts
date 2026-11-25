import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'JSON Schema validation checks a JSON instance against explicit rules. Valid JSON syntax alone does not guarantee required fields, correct types or permitted values.\n\nThis validator supports draft-07, 2019-09 and 2020-12. Auto follows the schema’s $schema declaration; without one it uses draft-07 for compatibility.\n\nThe schema is checked against bundled, build-time-compiled meta-schemas. A no-eval interpreter then checks the data, keeping the same behavior under browser, VS Code and desktop security policies.',
      title: 'What is JSON Schema validation?',
    },
    {
      content: [
        'Check API payloads, configuration files and event messages against a documented contract before passing them downstream.',
        'Test a schema from the generator against its source sample and against missing fields, wrong types or extra properties.',
        'Debug nested failures using the JSON Pointer and schema path, then save a text or JSON report for a reproducible test case.',
      ],
      title: 'When to validate JSON Schema',
    },
  ],
  examples: [
    '{"name":"Ada"} + {"type":"object","required":["name"]} → valid; {} → a required error at the root ($).',
    '{"age":"37"} + integer age schema → /age must be integer; numeric strings are not coerced.',
    '"2026-02-30" + {"type":"string","format":"date"} → invalid calendar date when format checks are on.',
    '2020-12 prefixItems: [{"type":"string"},{"type":"integer"}], items: false → ["Ada",37] is valid; ["Ada","37"] fails at /1.',
    'A local $ref: "#/$defs/user" resolves within the pasted schema; external schemas are not fetched.',
    'A boolean schema true accepts any permitted JSON input; false rejects every input.',
  ],
  faq: [
    {
      answer:
        'Auto uses Draft 7 when the schema has no $schema, so newer keywords such as prefixItems or $defs are reported as unknown. Add a $schema URI, or choose 2020-12 or 2019-09 under Schema draft.',
      question: 'Which draft is used when the schema has no $schema?',
    },
    {
      answer:
        'No. Only references inside the pasted schema, such as #/$defs/user, are resolved. A $ref to another file or URL fails with a cannot resolve reference error, and nothing is downloaded.',
      question: 'Does the validator download $ref schemas from URLs?',
    },
    {
      answer:
        'The validator rejects keywords it does not know for the selected draft, including x- extension keywords, so a typo cannot silently weaken validation. Remove the keyword, fix its spelling or select the draft that defines it.',
      question: 'Why does my schema fail with an unknown keyword error?',
    },
    {
      answer:
        'Yes, by default. With Validate string formats on, values must match supported formats such as date, email, uri and uuid, and an unknown format name is an error. Turn the option off to ignore every format keyword.',
      question: 'Are format keywords such as email checked?',
    },
    {
      answer:
        'Draft 7, 2019-09 and 2020-12. A schema that declares draft-04, draft-06 or a custom meta-schema is rejected with an error instead of being checked with the wrong rules.',
      question: 'Which JSON Schema drafts are supported?',
    },
  ],
  help: 'Paste the JSON instance into the main input and the schema into the JSON Schema field, or apply a complete sample.\n\nUse Auto when $schema is declared. Choose an explicit draft for an undeclared schema that uses newer keywords such as prefixItems.\n\nChoose whether to enforce supported format constraints and collect all errors. Run and inspect the status, draft and paths rather than changing data to match accidentally.\n\nFix the instance or the contract deliberately and rerun. Copy the report or save validation-report.txt / validation-report.json; validation never inserts defaults, strips properties or coerces types.',
  notes: [
    'All validation is local. Only the pasted schema and bundled meta-schemas are available; unresolved external $ref values fail without any download.',
    'Auto supports official HTTP/HTTPS draft URIs with an optional trailing #. Draft-04, draft-06 and custom meta-schemas are not supported; asynchronous schemas are rejected.',
    'Unknown keywords, unsupported formats and malformed schemas produce an error instead of silently weakening validation. With format validation off, all formats are explicitly ignored.',
    'Data validation uses @cfworker/json-schema without eval. Supported built-in formats include date, date-time, email, URI, UUID and IP addresses. Internationalized IRI/IDN and custom formats are not supported; a valid email or URI is not proof that the address exists.',
    'Paths are JSON Pointers: /users/0/name addresses a nested field; ~1 escapes / and ~0 escapes ~ in a property name. An empty pointer means the root, displayed as $.',
    'Input limits: 1,000,000 data characters / 50,000 values and 250,000 schema characters / 5,000 values, with 64 nesting levels. Unsafe integers are rejected; quote them to retain digits. Decimals use JavaScript precision.',
    'Up to 200 errors are reported, with totalErrors and an explicit truncation notice. Collecting all errors, recursive references, uniqueItems and complex patterns can be expensive; use trusted schemas. Size limits do not guarantee safe regular-expression runtime.',
    'Schema paths describe the validation chain and may reference normalized rules: __proto__ is checked with exact patternProperties; additional-property checks use an equivalent allOf rule. The original pasted text is not modified.',
    'Dynamic references/anchors ($dynamicRef/$dynamicAnchor), mixed nested drafts, mandatory custom vocabularies, extension keywords and asynchronous validation are not supported and fail explicitly. $recursiveRef supports only "#". Content encoding/media annotations do not decode or validate embedded payloads.',
    'Schema annotations such as default, title and description do not modify the JSON instance. Unknown extension keywords must be removed or supported by your destination validator separately.',
    'A duplicate key in the schema is an error, because a parser would silently keep only the last value. A duplicate key in the JSON data gets a warning that only its last value was checked.',
  ],
};
