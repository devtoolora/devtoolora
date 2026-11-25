import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  { id: 'ipv6-converter', invalidText: '1::2::3', name: 'IPv6 Address Converter' },
  { id: 'ipv6-subnet', invalidText: '2001:db8::/129', name: 'IPv6 Subnet Calculator' },
  {
    alert: /Line 1/,
    id: 'cidr-aggregator',
    invalidText: 'not an ip',
    name: 'CIDR Aggregator & Overlap Checker',
  },
  { id: 'port-reference', invalidText: '70000', name: 'Port Reference' },
  {
    alert: /above zero/,
    autoRun: true,
    fields: [{ kind: 'number', label: /^Rate\b/, value: '0' }],
    id: 'bandwidth-calculator',
    inputless: true,
    name: 'Bandwidth & Transfer Time Calculator',
  },
  { id: 'ieee754-inspector', invalidText: 'abc', name: 'IEEE 754 Float Inspector' },
  {
    id: 'roman-numerals',
    name: 'Roman Numeral Converter',
    result: /1 converted · 0 invalid/,
  },
  { id: 'statistics-calculator', invalidText: '1 x', name: 'Statistics Calculator' },
  {
    alert: /from 2/,
    id: 'number-theory',
    invalidText: '1',
    name: 'Number Theory Calculator',
  },
  {
    alert: /Min must not exceed max/,
    fields: [
      { kind: 'number', label: /^Min\b/, value: '5' },
      { kind: 'number', label: /^Max\b/, value: '1' },
    ],
    id: 'random-number',
    inputless: true,
    name: 'Random Number Generator',
  },
  {
    alert: /Division by zero/,
    autoRun: true,
    fields: [
      { kind: 'select', label: /^Operation\b/, value: 'Divide (unsigned)' },
      { kind: 'text', label: /^B\b/, value: '0' },
    ],
    id: 'bitwise-calculator',
    inputless: true,
    name: 'Bitwise Calculator',
  },
];

defineToolSmokeTests('Number and network calculators', tools);
