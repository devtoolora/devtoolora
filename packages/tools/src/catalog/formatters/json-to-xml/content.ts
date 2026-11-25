import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'XML has named elements, attributes and text that can sit between child elements; JSON has objects, arrays and typed values. Converting between them needs an explicit mapping, and this tool uses the same documented one in both directions.\n\n@attributes holds attributes, #text holds a text-only value next to attributes and #content holds an ordered list of text and element nodes. Same-name siblings become an array.\n\nXML → JSON offers Compact data, which groups same-name elements, or Preserve order, which keeps every child, comment and CDATA section in sequence. JSON → XML writes either mapping back and checks that the result is well-formed XML 1.0.',
      title: 'What is JSON ↔ XML conversion?',
    },
    {
      content: [
        'Read an XML response or configuration as JSON without losing repeated elements or attributes.',
        'Produce XML for a SOAP-style API, feed or legacy configuration from JSON data.',
        'Keep codes such as 00123 and values such as true as strings instead of guessing their types.',
        'Round-trip document-oriented XML with Preserve order and Compact output when the order of children matters.',
      ],
      title: 'When to convert between JSON and XML',
    },
  ],
  examples: [
    'JSON → XML: {"person":{"name":"Ada","active":true}} → <person><name>Ada</name><active>true</active></person>.',
    'JSON → XML: {"person":{"@attributes":{"id":"001"},"#text":"Ada"}} → <person id="001">Ada</person>.',
    'JSON → XML: ["Ada","Grace"] with fallback root users → <users><item>Ada</item><item>Grace</item></users>.',
    'JSON → XML: {"price":{"@attributes":{"currency":"EUR"},"#text":1.50}} → <price currency="EUR">1.50</price>; the number keeps its spelling.',
    'XML → JSON: <users><user>Ada</user><user>Grace</user></users> → {"users":{"user":["Ada","Grace"]}}.',
    'XML → JSON: <code>00123</code> → {"code":"00123"}, and <active>true</active> → {"active":"true"}.',
    'XML → JSON: <p>Hello <strong>world</strong>!</p> → {"p":{"#content":["Hello ",{"strong":"world"},"!"]}}.',
  ],
  faq: [
    {
      answer:
        'Attributes go into an @attributes object on their element: <user id="1">Ada</user> → {"user":{"@attributes":{"id":"1"},"#text":"Ada"}}. JSON → XML turns @attributes back into attributes.',
      question: 'How are XML attributes represented in JSON?',
    },
    {
      answer:
        'XML text has no data types, so <age>37</age> and <active>true</active> become "37" and "true". Nothing is guessed, which keeps values such as 00123 intact; convert types in your own code where needed.',
      question: 'Why does XML to JSON turn numbers and booleans into strings?',
    },
    {
      answer:
        'Compact data creates an array only when an element name repeats, so one <user> becomes an object and two become an array. Make the code that reads the JSON accept both shapes, or use Preserve order, which always lists children in a #content array.',
      question: 'Why is one child element an object but repeated elements an array?',
    },
    {
      answer:
        'Each item becomes a repeated element named after its key, so {"tag":["a","b"]} → <tag>a</tag><tag>b</tag>. Root arrays and arrays nested directly inside arrays use <item> elements.',
      question: 'How are JSON arrays written as XML?',
    },
    {
      answer:
        'Yes. Comments become {"#comment": …} and CDATA sections become {"#cdata": …} entries in a #content list, so JSON → XML can write them back. Processing instructions and the XML declaration are kept as #instruction and #declaration.',
      question: 'Does XML to JSON keep comments and CDATA?',
    },
    {
      answer:
        'Every key must be a valid XML name, so keys with spaces or a leading digit, such as "my key" or "1abc", are rejected instead of being renamed. Rename those keys in the JSON first.',
      question: 'Why does JSON to XML reject some keys?',
    },
  ],
  help: 'Choose JSON → XML or XML → JSON, then paste one document or choose a sample. Errors point to malformed JSON, tags, attributes or character references.\n\nFor JSON → XML, set the fallback root used for arrays, scalars and multi-key objects, then choose Pretty with an indentation size, or Compact to keep explicit ordered whitespace.\n\nFor XML → JSON, choose Compact data for ordinary records or Preserve order for document content, then check the root element, repeated arrays and @attributes.\n\nCopy the result or save converted.xml or converted.json. For an ordered round trip, convert with Preserve order, then use result & reverse with Compact output.',
  notes: [
    'Conversion runs locally. DOCTYPE and DTD declarations are rejected, no external entity or schema is loaded and XML is never executed.',
    'XML → JSON keeps text and attribute values as strings. Empty elements become empty strings; numbers, booleans, null and arrays cannot be inferred reliably from XML.',
    'JSON → XML writes numbers as text exactly as spelled, such as 1.00 or 9007199254740993, and booleans as true or false. A duplicate JSON key keeps its last value, as JSON.parse does, and the summary names the key and line. Null, empty strings, empty arrays and empty objects can all become empty elements, so XML cannot keep those JSON distinctions.',
    'Compact data groups same-name siblings, so their order relative to other names can change on the way back. Preserve order keeps the full child sequence.',
    '#content accepts strings and single-key element objects plus #comment, #cdata and #instruction nodes; #document adds a document-level list with an optional #declaration. Do not combine #content with #text or named children.',
    'Entity references are decoded, line endings and attribute whitespace follow XML normalization, and namespace prefixes are kept as names and attributes without validating their bindings.',
    'XML 1.0 in UTF-8 is supported; decode other encodings first and update the encoding declaration. Conversion is not schema validation or byte-for-byte serialization.',
    'Limits: 5,000,000 characters, 100 nested element levels and 100,000 XML nodes or JSON values. Errors produce no partial output.',
  ],
};
