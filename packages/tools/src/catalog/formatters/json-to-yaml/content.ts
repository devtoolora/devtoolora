import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'JSON and YAML describe the same kinds of data: objects (YAML mappings), arrays (sequences), strings, numbers, booleans and null. JSON uses braces, brackets and quoted keys; YAML uses indentation and readable lists.\n\nJSON → YAML writes YAML 1.2 with two-space indentation, keeps the JSON key order and number spelling, and quotes strings that could otherwise look like numbers, booleans, dates or null. YAML → JSON reads one YAML 1.2 document and writes two-space-indented JSON.\n\nComments and YAML presentation are not data, so they do not survive the trip to JSON. Anchors, aliases and << merge keys are expanded into ordinary values.',
      title: 'What is JSON ↔ YAML conversion?',
    },
    {
      content: [
        'Turn a JSON configuration into YAML for a service, deployment manifest or documentation example.',
        'Read YAML configuration as JSON for an API payload, test fixture or program that expects JSON.',
        'Check that values such as "123", "true" and empty collections keep their types in both directions.',
        'Expand anchors, aliases and << merge keys into plain objects before using a configuration elsewhere.',
      ],
      title: 'When to convert between JSON and YAML',
    },
  ],
  examples: [
    'JSON → YAML: {"code":"123","count":123} → code: "123" and count: 123; the types stay different.',
    'JSON → YAML: {"items":[],"settings":{},"value":null} → items: [], settings: {} and value: null.',
    'JSON → YAML: {"price":1.00,"id":9007199254740993} → price: 1.00 and id: 9007199254740993; numbers are not rewritten.',
    'JSON → YAML: {"users":[{"name":"Ada","roles":["admin"]}]} → a users list holding an object and its nested roles list.',
    'YAML → JSON: enabled: yes and active: true → {"enabled":"yes","active":true} under YAML 1.2 rules.',
    'YAML → JSON: message: | followed by indented lines → a JSON string with escaped \\n line breaks.',
    'YAML → JSON: defaults: &d {port: 8080} and server: {<<: *d, host: localhost} → server holds both port and host.',
  ],
  faq: [
    {
      answer:
        'No. JSON has no comment syntax, so YAML comments are dropped and cannot be restored by converting back. Keep the original YAML file if its comments matter.',
      question: 'Does YAML to JSON keep comments?',
    },
    {
      answer:
        'They are expanded. Each *alias becomes a full copy of the anchored value, and a << merge key copies the anchored mapping’s keys, with keys written beside it taking precedence. The JSON contains only plain values.',
      question: 'How are YAML anchors, aliases and merge keys converted?',
    },
    {
      answer:
        'YAML → JSON follows YAML 1.2, where only true and false (also written True or TRUE) are booleans. YAML 1.1 words such as yes, no, on and off stay strings, so write true or false when you mean a boolean.',
      question: 'Why does yes stay a string instead of becoming true?',
    },
    {
      answer:
        'JSON → YAML quotes strings that a YAML parser could read as another type, such as "123", "true", "null", "2026-10-10", "yes" and "on". The quotes keep them strings for both YAML 1.1 and 1.2 readers.',
      question: 'Why are some strings quoted in the YAML output?',
    },
    {
      answer:
        'No. A stream with more than one document is rejected, because the result must be a single JSON value. Convert each document separately; one document that starts with --- is fine.',
      question: 'Can I convert a YAML file with several --- documents?',
    },
    {
      answer:
        'Yes. JSON → YAML reads the original number text, so 1.00, 1e3 and 9007199254740993 are written exactly as in the JSON, and keys keep their order. YAML → JSON reads YAML numbers as JavaScript values instead, so quote integers beyond ±9,007,199,254,740,991 in YAML to keep their digits.',
      question: 'Does JSON to YAML keep number formatting such as 1.00?',
    },
  ],
  help: 'Choose JSON → YAML or YAML → JSON, then paste one document or choose a sample. JSON must be strict, without comments or trailing commas; YAML must indent with spaces.\n\nConvert and inspect the output. Quoted strings keep their type, multiline text keeps its line breaks and anchors are expanded.\n\nFix a reported error at its location. Invalid JSON, duplicate JSON or YAML keys, unsupported YAML types and YAML integers that would lose digits are rejected rather than converted lossily.\n\nCopy the result or save converted.yaml or converted.json. Use result & reverse moves the output into the input and flips the direction, so you can check a round trip.',
  notes: [
    'Conversion runs locally; YAML is parsed as data, and nothing is uploaded or executed.',
    'JSON → YAML writes YAML 1.2 with two-space indentation and a final newline. Repeated structures are written out in full, without generated anchors or aliases.',
    'YAML → JSON follows YAML 1.2 scalar rules: unquoted yes, no, on and off are strings. YAML 1.1 directives and multiple documents are not supported.',
    'Duplicate YAML keys and complex YAML mapping keys are rejected. A duplicate JSON key keeps its last value, as JSON.parse does, and the summary names the key and line. Scalar mapping keys become strings; quote keys when their spelling matters.',
    'JSON cannot represent custom tags, sets, explicit timestamps, binary tags, cyclic aliases, Infinity or NaN; these produce an error rather than a lossy result.',
    'JSON → YAML writes every number as spelled, including 1.00, 1e3 and integers beyond ±9,007,199,254,740,991, and keeps numeric-looking keys in their JSON order. YAML → JSON rejects unquoted integers outside that range and reads decimals with JavaScript number precision.',
    'Up to 100 nested levels and 1,000,000 values are supported, and alias expansion is bounded.',
  ],
};
