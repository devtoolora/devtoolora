import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Redaction replaces selected assignment values with <redacted> while retaining the variable names needed to understand a configuration.',
        'Built-in detection matches underscore-delimited TOKEN, SECRET, PASSWORD, PASS, KEY and PRIVATE names, case-insensitively. It is a name heuristic, not analysis of value contents.',
        'Custom names are comma-separated exact, case-sensitive names. Remove comments can strip full-line and inline comments; remaining ordinary values still need manual review.',
      ],
      title: 'What is configuration redaction?',
    },
    {
      content: [
        'Prepare a development config example for a support ticket.',
        'Mask conventional credential fields and explicit connection-string names.',
        'Review the resulting copy before sharing; never infer that every secret was detected.',
      ],
      title: 'When to use Secret Redactor',
    },
  ],
  examples: [
    'API_TOKEN=demo → API_TOKEN=<redacted>.',
    'PASSWORD="demo # secret" → PASSWORD=<redacted>, without the quotes.',
    'DATABASE_URL=postgres://… → unchanged unless DATABASE_URL is added as an additional name.',
    'Additional name ServiceCredential → ServiceCredential=<redacted>, while SERVICECREDENTIAL=demo stays.',
    '# note and PORT=3000 # note with Remove comments → PORT=3000.',
    'PUBLIC_VALUE=credential → unchanged; values are not inspected.',
  ],
  faq: [
    {
      answer:
        'Names with an underscore-separated part TOKEN, SECRET, PASSWORD, PASS, KEY or PRIVATE, in any letter case. GITHUB_TOKEN, DB_PASS and AWS_SECRET_ACCESS_KEY match; APIKEY, DB_PASSWD and SECRETS do not.',
      question: 'Which variable names are redacted automatically?',
    },
    {
      answer:
        'List them in Additional sensitive names separated by commas, such as DATABASE_URL, SENTRY_DSN. Matching is exact and case-sensitive, and each entry must be a valid variable name.',
      question: 'How do I redact DATABASE_URL or other custom names?',
    },
    {
      answer:
        'No. Only variable names are checked. A token stored under PUBLIC_VALUE stays visible unless you add the name, and a secret in a comment stays unless Remove comments is on.',
      question: 'Does it detect secrets by their value?',
    },
    {
      answer:
        'Not from the masked fields: each matched value is replaced with the literal text <redacted>. Unmatched values, names and any comments you keep remain readable.',
      question: 'Can the original values be recovered from the output?',
    },
    {
      answer:
        'Remove comments is on by default because comments often hold old credentials or notes. Turn it off to keep full-line and inline comments. One exception stays removed on a redacted line: a # with no space before it, as in DB_PASSWORD=abc#def, because sh and other dotenv readers take that text as part of the value.',
      question: 'Why are my comments removed?',
    },
  ],
  help: 'Paste configuration. Invalid syntax and duplicate names must be fixed first.\n\nAdd every unconventional sensitive name, separated by commas.\n\nChoose Remove comments to omit possible secrets in comments, then run redaction.\n\nReview every remaining value before copying or downloading redacted.env.',
  notes: [
    'This parser supports single-line KEY=value assignments, quotes, comments and optional export. Multiline values and shell execution are unsupported.',
    'Names must begin with an ASCII letter or underscore and contain only ASCII letters, digits and underscores. Names are case-sensitive.',
    'Unquoted # starts a comment, even without a space. Quote literal hashes such as URL fragments.',
    'Variable references such as ${BASE_URL} remain literal; no environment lookup, interpolation or escape decoding occurs.',
    'CRLF and CR become LF; an initial BOM is removed. Order, grouping and terminal newline are retained unless comments are explicitly removed.',
    'Input is limited to 1,048,576 UTF-16 characters. Duplicate names are reported as issues, not silently overridden.',
    'Additional names are exact and case-sensitive; a misspelled valid name will not match.',
    'Without Remove comments, comment text is preserved and may contain secrets. A # that touches a redacted value is dropped with the value.',
    'Names, ordinary values and grouping remain visible. This is not irreversible anonymization or proof of safe disclosure.',
    'A downloaded redacted file is an example, not a working deployment config; never replace production credentials with these markers.',
  ],
};
