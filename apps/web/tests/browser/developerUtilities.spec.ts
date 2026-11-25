import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  { id: 'json-patch', name: 'JSON Patch Generator & Applier' },
  {
    alert: /array of objects or an array of arrays/,
    id: 'table-generator',
    invalidText: '{"a":1}',
    name: 'Table Generator',
  },
  { id: 'html-to-text', name: 'HTML to Plain Text' },
  { id: 'html-to-markdown', name: 'HTML to Markdown' },
  { id: 'remove-blank-lines', name: 'Remove Blank Lines & Line Numbers' },
  {
    id: 'id-inspector',
    name: 'ID Inspector & Generator',
    result: /3 lines · 3 recognized · 0 unrecognized/,
  },
  {
    alert: /must fit/,
    autoRun: true,
    fields: [{ kind: 'text', label: /^A\b/, value: '99999999999999999999999' }],
    id: 'bitwise-calculator',
    inputless: true,
    name: 'Bitwise Calculator',
  },
  {
    alert: /Scope may contain/,
    autoRun: true,
    fields: [{ kind: 'text', label: /^Scope\b/, value: 'a b' }],
    id: 'conventional-commit',
    inputless: true,
    name: 'Conventional Commit Builder',
  },
  {
    alert: /Invalid range/,
    fields: [{ kind: 'text', label: /^Range\b/, value: 'garbage' }],
    id: 'semver-range',
    invalidText: '1.0.0',
    name: 'Semver Range Tester',
  },
  { autoRun: true, id: 'license-generator', name: 'License Generator' },
  { autoRun: true, id: 'editorconfig-generator', name: '.editorconfig Generator' },
];

defineToolSmokeTests('Developer utilities', tools);
