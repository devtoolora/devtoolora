import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Each plist element maps to one JSON value: <dict> becomes an object, <array> an array, <string> a string, <integer> and <real> numbers, <true/> and <false/> booleans. <date> becomes its ISO 8601 text and <data> its base64 text without whitespace. Integers outside the safe JavaScript range keep every digit.',
      title: 'How is a plist read?',
    },
    {
      content:
        'Objects become <dict>, arrays <array>, strings <string> and booleans <true/> or <false/>. A number written without a fraction or exponent becomes <integer>, any other number <real>. Output starts with the XML declaration and the Apple DOCTYPE and is indented with 2 spaces. null has no plist type and is an error, as is a string with a control character that XML 1.0 forbids; both name the JSON Pointer.',
      title: 'What does JSON → Plist write?',
    },
  ],
  examples: [
    '<dict><key>n</key><integer>3</integer></dict> → {"n": 3}.',
    '<date>2024-01-02T03:04:05Z</date> → "2024-01-02T03:04:05Z".',
    '<data>AQI=</data> → "AQI=".',
    '{"a": 1, "b": 1.5} → <integer>1</integer> and <real>1.5</real>.',
  ],
  faq: [
    {
      answer:
        'No. Binary plists start with bplist00 and are rejected. Convert them to XML first, for example with plutil -convert xml1 file.plist.',
      question: 'Are binary plists supported?',
    },
    {
      answer:
        'Only partly. JSON has no date or binary type, so <date> and <data> become strings, and JSON → Plist writes every string as <string>. Converting back gives <string> where the original had <date> or <data>.',
      question: 'Do dates and data survive a round trip?',
    },
    {
      answer:
        'Only the standard Apple DOCTYPE is accepted, with any whitespace. Any other DOCTYPE, an internal subset or an entity declaration is an error. Nothing is ever fetched from the DTD URL.',
      question: 'Which DOCTYPE is allowed?',
    },
    {
      answer:
        'A <key> without a value, a repeated <key> in the same <dict>, an unknown element, and <real> nan or inf, which JSON cannot hold. Each error gives its line and column.',
      question: 'What makes a plist invalid here?',
    },
    {
      answer:
        'Yes. <integer> values beyond ±9,007,199,254,740,991 are written to JSON with all their digits, and JSON integers of any size become <integer> unchanged. Apple tools such as plutil only read integers that fit in 64 bits, so keep larger ones as strings for them. Hexadecimal <integer> values such as 0x10 are read as numbers.',
      question: 'Are large integers kept exactly?',
    },
  ],
  help: 'Choose a direction: Plist → JSON or JSON → Plist.\n\nPaste an XML plist or JSON, or pick a sample.\n\nFix any error at the line and column it reports.\n\nCopy the result or save it as a .json or .plist file.',
  notes: [
    'Processing is local; nothing is uploaded, and the DTD is never fetched.',
    'Limits: 5,000,000 characters of input, 100 nested element levels counting <plist>, and 100,000 XML nodes, where text between elements counts too.',
    'JSON input allows 100,000 values; its output must also fit the plist limits above.',
    'A key repeated in JSON input keeps its last value, as JSON.parse does, and the summary names the key and line.',
    '<date> and <data> become strings, so a round trip through JSON writes them back as <string>.',
    'A UTF-8 byte order mark at the start is ignored.',
  ],
};
