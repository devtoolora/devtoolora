import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A .env file is a flat list of KEY=value lines, while configuration tooling often wants JSON or YAML. This converter moves between the two shapes: it reads a .env file into a JSON object or a YAML mapping, and turns a flat JSON or YAML mapping back into a .env file.',
        'The .env.example mode keeps the structure of the file, including blank lines, comments, export prefixes and inline comments, and replaces every value with a placeholder, so you can commit a template without the secrets.',
        'Everything runs locally in your browser. Values are never sent anywhere, and no error message or summary repeats a value.',
      ],
      title: 'What is .env ↔ JSON / YAML Converter?',
    },
    {
      content: [
        'Feed environment variables from a .env file into a tool that only accepts JSON or YAML, such as a deployment manifest or a secrets manager import.',
        'Create a .env file from a JSON or YAML configuration you already maintain.',
        'Generate a .env.example for the repository, so new contributors see every required variable without any real secret.',
      ],
      title: 'When to use .env ↔ JSON / YAML Converter',
    },
  ],
  examples: [
    'PORT=3000 and DEBUG=false in .env → JSON {"PORT": "3000", "DEBUG": "false"}, values stay strings.',
    '.env → YAML keeps the file order and quotes values like "3000" that would otherwise become numbers.',
    '{"PORT":3000,"EMPTY":null,"FLAG":true} → PORT=3000, EMPTY=, FLAG=true.',
    '{"MSG":"hello world"} → MSG="hello world", quoted because of the space.',
    'PORT: 3000 in YAML → PORT=3000 in .env.',
    '.env.example with placeholder <value> → PORT=<value>, comments and blank lines kept.',
  ],
  faq: [
    {
      answer:
        'No. A .env file has no types, so every value becomes a string in JSON and YAML. Numbers such as 3000 are written with quotes, so the round trip does not change their meaning.',
      question: 'Are numbers and booleans kept as numbers?',
    },
    {
      answer:
        'A .env file is flat, so nested objects and arrays are rejected with a message naming the key. Flatten the document first with JSON Flattener, then convert it.',
      question: 'What happens with nested JSON or YAML?',
    },
    {
      answer:
        'When a name appears twice the conversion stops with an error naming the variable and the line, because JSON and YAML objects cannot hold two values for one key.',
      question: 'What if a variable is declared twice?',
    },
    {
      answer:
        'Comments and blank lines are not part of JSON or YAML, so they are dropped in those modes. Only the .env.example mode keeps them, and it can drop comments too. It always drops a # with no space before it, as in PASSWORD=abc#def, because sh and other dotenv readers take that text as part of the value.',
      question: 'Are comments preserved?',
    },
  ],
  help: 'Pick a conversion: .env to JSON or YAML, JSON or YAML to .env, or .env.example.\n\nPaste the input on the left. In the .env.example mode you can choose a placeholder value and decide whether to keep comments.\n\nThe summary shows how many variables were converted. Keys must be valid variable names such as API_KEY.\n\nCopy the result, send it to the scratchpad or save it as .env.json, .env.yaml, .env or .env.example.',
  notes: [
    'Input is limited to 1,048,576 characters in every mode.',
    'Double-quoted values are unescaped (\\n, \\" and \\\\) when converting from .env; single-quoted and unquoted values stay verbatim.',
    'Input may hold at most 10,000 variables in every mode.',
    'Variable names must match [A-Za-z_][A-Za-z0-9_]*; other keys are rejected.',
    'Values written to .env are quoted only when they contain whitespace, #, $, a backslash or quotes; quotes and line breaks are escaped. A value with $ uses single quotes where it can, so sh does not expand it.',
    'JSON numbers keep their spelling: 12345678901234567890 and 1.10 are written as is. A key repeated in the JSON keeps its last value, and the summary names the key and line.',
    'Variable references such as ${BASE_URL} are treated as literal text and are not expanded.',
    'A null value becomes an empty assignment; objects and arrays are rejected.',
    'YAML parse errors are replaced by a generic message so no part of your values is echoed.',
    'The .env.example placeholder is written as is, without quotes.',
  ],
};
