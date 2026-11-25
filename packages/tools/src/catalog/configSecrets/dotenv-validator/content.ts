import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Validation checks whether assignments fit this parser and whether names are repeated. It reports all detected line issues rather than stopping at the first.',
        'Values remain strings. A syntactically valid PORT=hello is not proof that an application accepts that port.',
        'No values are resolved or executed. This is not a schema validator, connectivity test or secret scanner.',
      ],
      title: 'What is dotenv validation?',
    },
    {
      content: [
        'Find malformed assignments, invalid names and missing closing quotes.',
        'Locate duplicate variables before deployment.',
        'Check the supported syntax before formatting or redacting.',
      ],
      title: 'When to use .env Validator',
    },
  ],
  examples: [
    'PORT=3000 → Valid .env with Variables: 1.',
    'EMPTY= → Valid .env; an empty value is allowed.',
    'BAD-NAME=x → Line 1: Invalid variable name "BAD-NAME".',
    'PORT=3000 then PORT=4000 → Line 2: Duplicate variable "PORT" (first declared on line 1).',
    'TOKEN="unfinished → Line 1: Unterminated quoted value.',
    'URL=${BASE_URL} → Valid .env, even when BASE_URL is not defined.',
  ],
  faq: [
    {
      answer:
        'Each line must be blank, a # comment or a KEY=value assignment with an optional export prefix. It reports invalid names, missing =, unterminated quotes, text after a closing quote and duplicate names, each with a line number.',
      question: 'What does the .env validator check?',
    },
    {
      answer:
        'Loaders disagree about whether the first or the last value wins, so a repeated name is ambiguous. The validator reports the later line and names the line of the first declaration.',
      question: 'Why is a duplicate variable reported as an error?',
    },
    {
      answer:
        'No. Values are plain strings, so PORT=hello is valid syntax. Required variables, value types, URLs and whether ${VAR} references are defined are not checked.',
      question: 'Does it check that my values are correct for the app?',
    },
    {
      answer:
        'ASCII letters, digits and underscores, starting with a letter or an underscore. Names are case-sensitive, so Port and PORT are different variables, and BAD-NAME is invalid.',
      question: 'Which characters can a variable name contain?',
    },
    {
      answer:
        'No. Diagnostics give the line number and, for name or duplicate issues, the variable name, but assignment values are never repeated in the report.',
      question: 'Does the validation report include my secret values?',
    },
  ],
  help: 'Paste the complete file and run validation.\n\nRead Valid/Invalid and each diagnostic line number.\n\nCorrect the source and run again; invalid lines are never rewritten for you.\n\nCopy or download the diagnostic report. It may include variable names, but not assignment values.',
  notes: [
    'The report lists the first 20 issues and counts the rest.',
    'This parser supports single-line KEY=value assignments, quotes, comments and optional export. Multiline values and shell execution are unsupported.',
    'Names must begin with an ASCII letter or underscore and contain only ASCII letters, digits and underscores. Names are case-sensitive.',
    'Unquoted # starts a comment, even without a space. Quote literal hashes such as URL fragments.',
    'Variable references such as ${BASE_URL} remain literal; no environment lookup, interpolation or escape decoding occurs.',
    'CRLF and CR become LF; an initial BOM is removed. Order, grouping and terminal newline are retained unless comments are explicitly removed.',
    'Input is limited to 1,048,576 UTF-16 characters. Duplicate names are reported as issues, not silently overridden.',
    'Validity applies only to this supported syntax, not every dotenv loader or your application schema.',
    'Variables counts distinct names and Assignments counts assignment lines. In a valid report they are equal, because a repeated name makes the file invalid.',
    'Diagnostic text can contain an invalid variable-name fragment; review it before sharing.',
  ],
};
