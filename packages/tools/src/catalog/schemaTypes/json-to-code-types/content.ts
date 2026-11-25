import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Typed languages need a declared shape for every JSON payload they read. This generator reads a JSON sample and writes the matching Go structs, Rust structs, Kotlin data classes, Java records, C# classes, Python dataclasses or Swift Codable types, so you start from working declarations instead of typing them by hand.\n\nRecords in one array are merged into a single item type. A property missing from some records, or holding null in some of them, becomes optional: a pointer with omitempty in Go, Option in Rust, a nullable with a null default in Kotlin and Python, a boxed type in Java, a nullable property in C# and an optional in Swift. Nested objects get their own named types, such as UserProfile.\n\nThe declarations describe one sample, not a contract. Check optional fields, numeric widths and untyped values against the API documentation before shipping them.',
      title: 'What is JSON to Code Types?',
    },
    {
      content: [
        'Model an API response, webhook payload or configuration file in Go, Rust, Kotlin, Java, C#, Python or Swift from a real example.',
        'Paste several records as one JSON array to discover optional and nullable fields before they cause deserialization errors.',
        'Draft the types for a client library, then rename fields, narrow strings to enums and add validation in your own code.',
      ],
      title: 'When to use JSON to Code Types',
    },
  ],
  examples: [
    '{"id":1,"name":"Ada"} with Go → type Root struct { Id int64 `json:"id"`; Name string `json:"name"` }',
    '[{"id":1,"email":"a@b.c"},{"id":2}] with Rust → pub email: Option<String>, because the second record has no email.',
    '{"a/b":1} with Kotlin → @SerialName("a/b") val aB: Long, with the original key kept in the annotation.',
    '{"type":1,"class":2} with Java → record components type and class_, because class is a reserved word.',
    '{"nick":null} with C# → public object? Nick { get; set; }, because null alone shows no type.',
    '{"profile":{"active":true}} with Python → class UserProfile first, then class User with profile: UserProfile.',
    '{"id":1} with Swift → struct Root: Codable { let id: Int }, plus CodingKeys only when a key is renamed.',
  ],
  faq: [
    {
      answer:
        'Rust, Java, Kotlin and Swift use integer types for whole numbers: i64, long, Long and Int. A field becomes a floating point type when any sample value has a fraction or is not a safe integer, so a 9.0 and a 9.5 in one array gives a double.',
      question: 'How are integers and decimals told apart?',
    },
    {
      answer:
        'The generator never emits the target language reserved words or digit-leading names as identifiers. A reserved word gets a trailing underscore, such as type_, and a name starting with a digit gets a field prefix. The original JSON key stays in the serialization attribute.',
      question: 'What happens to keys that are keywords or not valid identifiers?',
    },
    {
      answer:
        'Values with mixed kinds, null-only values and empty objects have no single type, so they become the language catch-all: any in Go, serde_json::Value in Rust, Any in Kotlin and Python, Object in Java, object in C# and AnyCodable in Swift.',
      question: 'Why do some fields become any or Object?',
    },
    {
      answer:
        'Swift has no built-in type that holds arbitrary JSON, so the output starts with a comment asking you to define or import an AnyCodable wrapper. It appears only when the sample contains an untyped value.',
      question: 'Why does the Swift output mention AnyCodable?',
    },
    {
      answer:
        'Pick Pydantic under Python models. The output then uses BaseModel classes and Field aliases for renamed keys, and optional fields default to None. Dataclasses keep the original key in a comment because they have no alias support.',
      question: 'Can I get Pydantic models instead of dataclasses?',
    },
  ],
  help: 'Paste a JSON object or an array of objects, or apply a sample. To merge several records, supply them as one JSON array. The output updates as you type.\n\nPick the target language and name the root type. Choose whether optional means missing or null in some records, or every property. For Python, choose dataclasses or Pydantic models.\n\nReview the declarations: the root type comes first and nested types follow in the order they appear. Python lists nested classes first so each one is defined before use.\n\nCopy the code, send it to the scratchpad or save it as types.go, types.rs, types.kt, types.java, types.cs, types.py or types.swift.',
  notes: [
    'Generation is local. The JSON is parsed in the browser or editor and never uploaded or executed.',
    'The root must be a JSON object with at least one property or an array of objects. A scalar, an empty object or an array holding scalars or null has no fields to declare and is rejected.',
    'Inference reflects only the supplied sample. A field present in every record becomes required even if your API documents it as optional.',
    'Whole numbers become 64-bit integers and other numbers become double precision floats. Strings stay strings: dates, emails and IDs are not narrowed.',
    'Values with mixed kinds, null-only values, empty objects and arrays holding null or mixed items collapse to the catch-all type of the language; unions are not generated.',
    'Field names are converted to the naming style of the language with accents removed, and a repeated name gets a numeric suffix. Renamed keys keep the original in an annotation or comment. A C# property that would repeat its class name gets a Value suffix.',
    'Go encoding/json cannot map a key that contains a comma, so such a field gets an explaining comment and the tag json:"-". The key - is written as json:"-,".',
    'Untyped values use Any in Kotlin, which kotlinx.serialization cannot serialize; replace it with JsonElement. Python output uses list[...] and X | None annotations, which need Python 3.10 or later.',
    'Imports or using lines are added for the serialization library each language commonly uses: serde, kotlinx.serialization, Jackson, System.Text.Json, dataclasses or Pydantic.',
    'Limits: 1,000,000 input characters, 200,000 JSON values and properties, 64 nesting levels and 1,000,000 output characters. Larger input is rejected, never truncated.',
    'A duplicate key in the JSON keeps its last value, as JSON.parse does, and the summary names the key and line.',
    'A number beyond the range of a double, such as 1e400, or one that would become 0, such as 1e-400, is rejected.',
    'Java output declares every record public, so keep each record in a file named after it; the single downloaded file holds them all and must be split before javac accepts it.',
  ],
};
