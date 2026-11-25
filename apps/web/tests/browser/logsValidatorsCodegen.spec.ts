import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    alert: /1,000,000/,
    autoRun: true,
    id: 'json-to-code-types',
    name: 'JSON to Code Types',
    oversizeInput: 1_000_001,
  },
  {
    alert: /Invalid JSON Schema at line 1, column 1/,
    autoRun: true,
    id: 'json-schema-to-typescript',
    invalidText: 'hello',
    name: 'JSON Schema to TypeScript',
  },
  {
    alert: /Invalid JSON Schema at line 1, column 1/,
    autoRun: true,
    id: 'json-schema-to-zod',
    invalidText: 'hello',
    name: 'JSON Schema to Zod',
  },
  {
    id: 'credit-card-validator',
    name: 'Credit Card Validator & Test Numbers',
    result: /9 numbers/,
  },
  {
    id: 'gtin-validator',
    name: 'ISBN / EAN / UPC / GTIN Validator',
    result: /2 codes/,
  },
  {
    alert: /32 characters/,
    id: 'vat-validator',
    invalidText: '4'.repeat(33),
    name: 'VAT Number Format Validator',
    result: /4 numbers/,
  },
  {
    alert: /No country, currency or language/,
    id: 'iso-codes',
    invalidText: 'zzzzqqq',
    name: 'Country, Currency & Language Codes',
    result: /1 country/,
  },
  {
    alert: /Invalid \.env input/,
    id: 'dotenv-converter',
    invalidText: 'PORT',
    name: '.env ↔ JSON / YAML Converter',
  },
  {
    alert: /not valid JSON/,
    id: 'har-viewer',
    invalidText: 'hello',
    name: 'HAR Viewer',
    result: /3 requests/,
  },
  {
    alert: /1,048,576/,
    id: 'access-log-parser',
    name: 'Access Log Parser',
    oversizeInput: 1_048_577,
    result: /2 lines/,
  },
  {
    alert: /1,048,576/,
    id: 'ansi-stripper',
    name: 'ANSI Escape Stripper & ANSI to HTML',
    oversizeInput: 1_048_577,
  },
  {
    alert: /between 1970 and 2100/,
    fields: [{ kind: 'number', label: /^Year/, value: '1900' }],
    id: 'log-timestamp-normalizer',
    invalidText: 'x',
    name: 'Log Timestamp Normalizer',
  },
  {
    alert: /No exit code/,
    id: 'exit-code-reference',
    invalidText: 'FOO',
    name: 'Exit Code & errno Reference',
    result: /exit code/,
  },
];

defineToolSmokeTests('Logs, validators and code generation', tools);
