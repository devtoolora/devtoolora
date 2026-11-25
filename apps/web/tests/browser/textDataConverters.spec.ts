import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    alert: /array of strings/,
    id: 'list-converter',
    invalidText: '[{"a":1}]',
    name: 'List Converter',
  },
  {
    alert: /1 to 32/,
    fields: [
      { kind: 'segmented', label: /^Mode\b/, value: 'Split text' },
      { kind: 'text', label: /^Separator\b/, value: '' },
    ],
    id: 'join-split-lines',
    invalidText: 'x',
    name: 'Join & Split Lines',
  },
  {
    alert: /Invalid pattern/,
    fields: [
      { kind: 'select', label: /^Pattern\b/, value: 'custom' },
      { kind: 'text', label: /^Custom pattern\b/, value: '(' },
    ],
    id: 'pattern-extractor',
    invalidText: 'x',
    name: 'Pattern Extractor',
  },
  {
    alert: /1,000,000/,
    id: 'line-ending-converter',
    name: 'Line Ending & BOM Converter',
    oversizeInput: 1_000_001,
  },
  {
    alert: /1 to 1/,
    fields: [
      { kind: 'segmented', label: /^Mode\b/, value: 'Pick random' },
      { kind: 'number', label: /^Lines to pick\b/, value: '5' },
    ],
    id: 'shuffle-lines',
    invalidText: 'a',
    name: 'Shuffle & Pick Random Lines',
  },
  {
    alert: /Invalid Base32 character/,
    fields: [{ kind: 'segmented', label: /^Mode\b/, value: 'Decode' }],
    id: 'base-n-encoder',
    invalidText: 'MZXW6YTBO!',
    name: 'Base-N Encoder',
    runLabel: /^(Encode|Decode) input$/,
  },
  { id: 'unicode-normalizer', name: 'Unicode Normalizer' },
  { alert: /JSON/, id: 'json-flatten', invalidText: '{', name: 'JSON Flatten & Unflatten' },
  {
    alert: /JSON/,
    id: 'json-canonicalize',
    invalidText: '{',
    name: 'JSON Sort Keys & Canonicalize',
  },
  {
    alert: /Line 1 is not valid JSON/,
    fields: [{ kind: 'segmented', label: /^Mode\b/, value: 'JSONL → array' }],
    id: 'json-lines-converter',
    invalidText: '{bad',
    name: 'JSON Lines ↔ JSON Array',
  },
  {
    alert: /ISO 8601/,
    autoRun: true,
    id: 'time-zone-converter',
    invalidText: 'tomorrow',
    name: 'Time Zone Converter',
    result: /in 4 time zones/,
  },
  {
    alert: /Enter a duration/,
    autoRun: true,
    id: 'duration-converter',
    invalidText: 'soon',
    name: 'Duration Converter',
  },
];

defineToolSmokeTests('Text and data converters', tools);
