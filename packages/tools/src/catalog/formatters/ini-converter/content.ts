import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'INI to JSON turns each [section] into an object and each key=value line into a string. A dotted section name such as [db.replica] nests inside [db]. Keys before the first section sit at the top level. Lines starting with ; or # are comments; a ; inside a value is part of the value.',
      title: 'How is INI converted to JSON?',
    },
    {
      content:
        'JSON to INI accepts a root object with plain values at the top and one level of sections. Deeper objects, arrays and null are rejected with the key named. Values with leading or trailing spaces, or starting with a quote, are written in double quotes so they read back unchanged. A value or key containing a newline cannot be written and is an error.',
      title: 'What does JSON to INI accept?',
    },
  ],
  examples: [
    'top=1\n[db]\nhost = x → {"db": {"host": "x"}, "top": "1"}.',
    '[db.replica]\nport=5432 → {"db": {"replica": {"port": "5432"}}}.',
    'With Typed values: port=5432 and debug=true → {"port": 5432, "debug": true}.',
    '{"a": 1, "s": {"k": "v"}} → a=1, a blank line, [s], k=v.',
  ],
  faq: [
    {
      answer:
        'By default every value is a string, because INI has no types. Turn on Typed values to convert true, false, plain integers and plain decimals. Text such as 0012, 1e5 or .5, integers beyond the safe range and quoted values stay strings.',
      question: 'Are numbers converted?',
    },
    {
      answer:
        'No. Comments are only recognized at the start of a line. In a = b ; note the value is "b ; note".',
      question: 'Are inline comments removed?',
    },
    {
      answer:
        'Yes. A repeated section name adds to the same object. A key repeated in the same section is an error with its line number. A key repeated in JSON input keeps its last value, as JSON.parse does, and the summary names the key and line.',
      question: 'What happens to repeated sections and keys?',
    },
    {
      answer:
        'JSON to INI writes at most two object levels, so a nested result from dotted sections such as [db.replica] has to be flattened before it can be written back.',
      question: 'Why does JSON to INI reject my nested object?',
    },
    {
      answer:
        'A line that is neither a key=value pair nor a [section] header, and a header without its closing bracket, are errors that name the line.',
      question: 'What counts as invalid INI?',
    },
  ],
  help: 'Choose a direction with INI → JSON or JSON → INI.\n\nPaste INI or JSON, or pick a sample.\n\nTurn on Typed values to get JSON numbers and booleans from INI.\n\nCopy the result or save it as a .json or .ini file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 characters, 100,000 lines and 100 levels of section nesting.',
    'INI has no standard: this converter reads key=value pairs, [sections], dotted section nesting and double-quoted keys and values. : separators and line continuations are not supported.',
    'JSON to INI keeps number spelling and big integers exact, writes top-level keys before sections and does not keep key order across that split.',
    'A UTF-8 byte order mark at the start is ignored, and CRLF line endings are accepted.',
  ],
};
