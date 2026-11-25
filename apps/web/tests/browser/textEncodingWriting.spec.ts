import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    alert: /Invalid escape/,
    fields: [{ kind: 'segmented', label: /^Mode\b/, value: 'Unescape' }],
    id: 'string-escaper',
    invalidText: 'bad \\q',
    name: 'String Escaper',
  },
  {
    alert: /Invalid Punycode/i,
    fields: [{ kind: 'segmented', label: /^Mode\b/, value: 'To Unicode' }],
    id: 'punycode-converter',
    invalidText: 'xn--zz',
    name: 'Punycode Converter',
    result: /domain/,
  },
  {
    alert: /Invalid quoted-printable/,
    fields: [{ kind: 'select', label: /^Mode\b/, value: 'decode' }],
    id: 'quoted-printable',
    invalidText: 'bad=ZZ',
    name: 'Quoted-Printable & MIME Header Decoder',
  },
  { id: 'unicode-inspector', name: 'Unicode Inspector', result: /code points/ },
  {
    alert: /Key must contain only letters/,
    fields: [{ kind: 'text', label: /^Key\b/, value: 'L3M' }],
    id: 'classic-ciphers',
    invalidText: 'HELLO',
    name: 'Classic Ciphers',
  },
  {
    alert: /Unknown code word/,
    fields: [{ kind: 'segmented', label: /^Mode\b/, value: 'NATO → text' }],
    id: 'nato-phonetic',
    invalidText: 'Sierra Foo',
    name: 'NATO Phonetic Alphabet',
  },
  { id: 'word-frequency', name: 'Word Frequency Counter', result: /distinct/ },
  {
    alert: /at least one English word/,
    id: 'readability-score',
    invalidText: '123 !!!',
    name: 'Readability Score',
  },
  { id: 'typography-fixer', name: 'Typography Fixer' },
  {
    alert: /not a number/,
    id: 'number-to-words',
    invalidText: '12a',
    name: 'Number to Words',
  },
  { id: 'markdown-toc', name: 'Markdown TOC' },
  {
    alert: /not a valid calendar date/,
    autoRun: true,
    id: 'date-calculator',
    invalidText: '2026-02-30',
    name: 'Date Calculator',
  },
];

defineToolSmokeTests('Text encoding and writing', tools);
