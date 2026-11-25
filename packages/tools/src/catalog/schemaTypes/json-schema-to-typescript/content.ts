import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'JSON Schema describes the shape of JSON data with keywords such as type, properties, required, enum and $ref. TypeScript describes the same shape at compile time, so a schema can be turned into interfaces and type aliases instead of being rewritten by hand.',
        'This tool compiles the schema into declarations: the root schema first, then every entry of $defs or definitions. Local $ref pointers become references by name, so recursive and mutually recursive schemas work. The result is plain TypeScript you can paste into a types file.',
        'Everything runs in your browser. The schema is never sent anywhere and nothing is stored.',
      ],
      title: 'What is JSON Schema to TypeScript?',
    },
    {
      content: [
        'Generate request and response types from an OpenAPI component schema or a vendor-supplied JSON Schema without installing a code generator.',
        'Check how a schema you are designing maps to types: optional properties, nullable unions, tuples and allOf intersections show up immediately.',
        'Keep keywords that have no TypeScript equivalent visible: the tool lists them as ignored comments, so you know what a validator would still enforce.',
      ],
      title: 'When to use JSON Schema to TypeScript',
    },
  ],
  examples: [
    '{"type":"object","properties":{"id":{"type":"integer"}},"required":["id"]} → export interface Root { id: number; }',
    '{"type":"string","enum":["a","b"]} → export type Root = \'a\' | \'b\';',
    '{"type":["string","null"]} → export type Root = string | null;',
    '{"type":"array","prefixItems":[{"type":"string"},{"type":"number"}],"items":false} → [string, number].',
    '{"$defs":{"Node":{"type":"object","properties":{"next":{"$ref":"#/$defs/Node"}}}},"$ref":"#/$defs/Node"} → Root = Node plus a recursive Node interface.',
    '{"definitions":{"A":{"type":"string"}},"allOf":[{"$ref":"#/definitions/A"},{"type":"object"}]} → a type A plus Root = A & Record<string, unknown>.',
    '{"if":{},"type":"object"} → the type plus the comment // ignored: if at #.',
  ],
  faq: [
    {
      answer:
        'No. Only local pointers that start with # are resolved. A remote $ref such as a URL stops with an error asking you to inline the schema, because the tool never makes network requests.',
      question: 'Does it follow remote $ref URLs?',
    },
    {
      answer:
        'Keywords with no TypeScript equivalent, such as if, then, else, not, uniqueItems, patternProperties or propertyNames, are skipped. Each one is listed as an ignored comment at the end of the output, with its location in the schema. A constraint such as minimum in a schema without a type is listed the same way.',
      question: 'What happens to keywords it cannot express?',
    },
    {
      answer:
        'Properties are optional unless the schema lists them in required. An object without additionalProperties becomes a plain interface; a schema for additionalProperties adds an intersection with Record<string, T>.',
      question: 'How are optional properties and extra properties handled?',
    },
    {
      answer:
        'Format, pattern, minimum, maxLength and similar constraints cannot be expressed by TypeScript types, so the output only keeps the base type. Use the JSON Schema validator for those checks.',
      question: 'Are format and numeric constraints enforced?',
    },
    {
      answer:
        'A schema title names the root declaration; otherwise the Root type name field is used. Entries in $defs and definitions become separate declarations named after their key, and a nested object with a title gets its own declaration named after the title. Conflicts get numeric suffixes, and a name that would shadow a TypeScript global such as Record or Date gets a Type suffix.',
      question: 'How are declarations named?',
    },
  ],
  help: 'Paste a JSON Schema (draft-07, 2019-09 or 2020-12, or an OpenAPI schema object) and the TypeScript appears as you type.\n\nSet the root type name, choose interfaces or type aliases, and decide whether declarations are exported or readonly.\n\nSchemas that use if, then, not or patternProperties still convert; those keywords are listed as ignored comments below the types.\n\nCopy the result, send it to the scratchpad or save it as types.ts.',
  notes: [
    'The schema is limited to 250,000 characters and 5,000 values or properties.',
    'Nesting is limited to 64 levels.',
    'Generated code is limited to 1,000,000 characters.',
    'Only local $ref pointers to the root (#), $defs and definitions are resolved; remote references are rejected.',
    'At most 50 ignored keywords are listed, deduplicated by keyword and location; a last comment counts the rest. Validation keywords next to a $ref are dropped and listed too, while annotations such as title and description are not.',
    'An object without additionalProperties becomes a plain interface; interfaces are used only for objects without an additionalProperties schema.',
    'Integer and number both become number; nullable: true adds null to the union.',
    'A required entry that names an undeclared property is ignored and listed as an ignored comment. An unknown type such as "foo" and a root that is only a $ref to itself stop with an error. A nested object with a title becomes its own declaration named after the title; when it is nullable, null is added where it is used.',
    'A duplicate key in the schema is an error, because a parser would silently keep only the last value.',
  ],
};
