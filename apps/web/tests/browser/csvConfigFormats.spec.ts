import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    alert: /Duplicate key/,
    id: 'yaml-format',
    invalidText: 'a: 1\na: 2',
    name: 'YAML Format',
  },
  { alert: /Invalid TOML/, id: 'toml-format', invalidText: 'a = ', name: 'TOML Format' },
  { id: 'html-format', name: 'HTML Formatter & Minifier' },
  {
    alert: /Unclosed block/,
    id: 'css-format',
    invalidText: 'a{',
    name: 'CSS Formatter & Minifier',
  },
  {
    alert: /Object keys must be double-quoted/,
    id: 'jsonc-to-json',
    invalidText: '{',
    name: 'JSONC to JSON',
  },
  { id: 'ini-converter', name: 'INI Converter' },
  { id: 'properties-converter', name: 'Properties Converter' },
  {
    alert: /Binary plists are not supported/,
    id: 'plist-converter',
    invalidText: 'bplist00',
    name: 'Plist Converter',
  },
  { id: 'csv-delimiter-converter', name: 'CSV Delimiter Converter' },
  { id: 'csv-columns', name: 'CSV Columns' },
  { id: 'csv-diff', name: 'CSV Diff', result: /1 row added, 1 row removed, 1 row changed/ },
  {
    alert: /Table name must be/,
    fields: [{ kind: 'text', label: /^Table name\b/, value: 'a b' }],
    id: 'csv-to-sql',
    invalidText: 'id,name\n1,Ada',
    name: 'CSV to SQL',
  },
];

defineToolSmokeTests('CSV and config formats', tools);
