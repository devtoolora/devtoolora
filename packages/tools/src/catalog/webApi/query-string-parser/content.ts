import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Query parameters are name/value pairs encoded using URLSearchParams form semantics. Parsing converts + to space and percent-decodes UTF-8; serialization uses + for spaces.',
        'Parsing accepts a bare query, a leading ?, or a URL or path before the first ?, as long as no = or & comes before that ?. The fragment is excluded. Repeated names become arrays of strings; every scalar remains a string.',
        'Building accepts a JSON object with scalar values or arrays of scalars. Arrays produce repeated keys, null entries are omitted, and nested structures are rejected rather than converted to [object Object].',
      ],
      title: 'What is query-string conversion?',
    },
    {
      content: [
        'Inspect duplicate parameters without losing values.',
        'Build a correctly encoded query for development requests.',
        'Compare literal plus signs, empty values and unusual names before using a framework-specific decoder.',
      ],
      title: 'When to use Query String Parser',
    },
  ],
  examples: [
    '?q=one&q=two → {"q":["one","two"]}.',
    'q=dev+tools → {"q":"dev tools"}.',
    'q=dev%2Btools → {"q":"dev+tools"}.',
    'JSON to query: {"tag":["a","b"]} → tag=a&tag=b.',
    'JSON to query: {"active":true,"skip":null} → active=true.',
    '/search?q=1 → {"q":"1"}; q=a?b&empty= → {"q":"a?b","empty":""}; https://example.com/path#fragment → {}.',
  ],
  faq: [
    {
      answer:
        'Query strings use HTML form encoding, where + stands for a space. A literal plus must be written %2B; JSON to query does that for you and writes spaces as +.',
      question: 'Why does + become a space when parsing?',
    },
    {
      answer:
        'They are grouped into an array, {"tag":["a","b"]}, so no value is lost. A name that appears once stays a plain string.',
      question: 'How are repeated parameters like tag=a&tag=b handled?',
    },
    {
      answer:
        'No. Bracket names stay literal keys, so a[b]=1 becomes {"a[b]":"1"}. Nesting rules differ between frameworks such as PHP, Rails and the qs library, so the tool does not guess one.',
      question: 'Does it turn a[b]=1 into a nested object?',
    },
    {
      answer:
        'A query string carries only text, so page=2 parses to "2" and a bare flag parses to an empty string. Convert types in your code, where you know which parameters are numbers or booleans.',
      question: 'Why are numbers and booleans returned as strings?',
    },
    {
      answer:
        'Yes. Parse to JSON accepts a full or relative URL, a bare query or one starting with ?. Only the query is read: the path and the #fragment are ignored, and a URL without a query gives {}.',
      question: 'Can I paste a whole URL?',
    },
  ],
  help: 'Choose Parse to JSON or JSON to query.\n\nPaste query text/full URL for parsing, or a JSON object for building.\n\nRun conversion and inspect the report or directly copyable query.\n\nDownload the result. Parsed arrays group equal names, so exact cross-key pair ordering is not retained on a round-trip.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters.',
    'Values are not guessed as numbers or booleans when parsing. Empty values remain empty strings.',
    'Null entries and empty arrays are omitted during building. Objects or nested arrays are unsupported. A number a double cannot hold keeps its exact digits, and a duplicate key keeps its last value with a warning in the summary.',
    'No brackets-to-object conversion, path parsing or route inference occurs.',
    'URLSearchParams is forgiving of malformed percent escapes; this is not a strict percent-encoding validator.',
    'Form encoding is different from encodeURIComponent: spaces serialize as +.',
    'Queries can contain credentials or personal data. Copy/download does not redact them.',
  ],
};
