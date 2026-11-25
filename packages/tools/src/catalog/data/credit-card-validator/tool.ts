import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import {
  cardBrandLabel,
  cardBrands,
  formatCardNumber,
  generateCardNumbers,
  validateCardNumbers,
} from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];
const columns = ['Number', 'Brand', 'Length', 'Luhn', 'Result'];
const sampleDefaults = { brand: 'visa', count: '5', mode: 'validate' };
const vectors = [
  '4242424242424242',
  '378282246310005',
  '5555555555554444',
  '2223003122003222',
  '6011111111111117',
  '3056930009020004',
  '3566002020360505',
  '6200000000000005',
  '6759649826438453',
].join('\n');

function artifact(text: string, fileName: string): ToolResult['artifact'] {
  return { base64: encodeBase64Text(text), fileName, mimeType: 'text/plain;charset=utf-8' };
}

function runValidate(text: string): ToolResult {
  if (!text.trim()) throw new ToolError('Paste one card number per line.');

  const checks = validateCardNumbers(text);
  const rows = checks.map((check) => [
    check.formatted,
    cardBrandLabel(check.brand),
    check.lengthValid ? 'ok' : 'fail',
    check.luhnValid ? 'ok' : 'fail',
    check.valid ? 'valid' : 'invalid',
  ]);
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const aligned = [columns, ...rows]
    .map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index] ?? 0))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
  const valid = checks.filter((check) => check.valid).length;
  const invalid = checks.length - valid;

  return {
    artifact: artifact(aligned, 'card-check.txt'),
    jsonTable: { columns, presentation: 'plain', rows },
    summary: `${checks.length} ${checks.length === 1 ? 'number' : 'numbers'} · ${valid} valid · ${invalid} invalid`,
    text: aligned,
  };
}

function runGenerate(fields: Record<string, string>): ToolResult {
  const brand = cardBrands.find((item) => item === (fields.brand || 'visa'));

  if (!brand) throw new ToolError('Choose a card brand.');

  const count = Number(fields.count || '5');
  const numbers = generateCardNumbers(brand, count);
  const text = numbers.map(formatCardNumber).join('\n');

  return {
    artifact: artifact(text, 'test-cards.txt'),
    summary: `${numbers.length} ${cardBrandLabel(brand)} test ${numbers.length === 1 ? 'number' : 'numbers'}`,
    text,
  };
}

export const creditCardValidatorTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Data',
  description:
    'Validate card numbers with the Luhn checksum, brand prefix and length rules, or generate Luhn-valid test numbers for common brands.',
  fields: [
    {
      defaultValue: 'validate',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Validate', value: 'validate' },
        { label: 'Generate', value: 'generate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'visa',
      id: 'brand',
      label: 'Brand',
      options: cardBrands.map((brand) => ({ label: cardBrandLabel(brand), value: brand })),
      type: 'select',
      visibleWhen: { field: 'mode', is: ['generate'] },
    },
    {
      defaultValue: '5',
      help: 'Between 1 and 100 numbers.',
      id: 'count',
      label: 'Count',
      type: 'number',
      visibleWhen: { field: 'mode', is: ['generate'] },
    },
  ],
  freshResults: true,
  id: 'credit-card-validator',
  inputKind: 'optionalText',
  inputPresentation: {
    label: 'Card numbers',
    placeholder: 'One card number per line',
  },
  inputVisibleWhen: { field: 'mode', is: ['validate'] },
  keywords: ['credit card', 'luhn', 'card number', 'visa', 'mastercard', 'test card', 'pan'],
  name: 'Credit Card Validator & Test Numbers',
  outputKind: 'json',
  relatedToolIds: ['iban-validator', 'fake-data-generator', 'checksum'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => (fields.mode === 'generate' ? runGenerate(fields) : runValidate(text))),
  runRequires: [{ anyOf: ['$text'], when: { field: 'mode', is: ['validate'] } }],
  samples: [
    { fields: sampleDefaults, label: 'Nine brand test numbers', text: vectors },
    {
      fields: sampleDefaults,
      label: 'Luhn failure',
      text: '4242424242424241',
    },
    {
      fields: sampleDefaults,
      label: 'Spaces and dashes',
      text: '3782-822463-10005\n4242 4242 4242 4242',
    },
    { fields: { ...sampleDefaults, mode: 'generate' }, label: 'Generate Visa test numbers' },
    {
      fields: { ...sampleDefaults, brand: 'amex', count: '3', mode: 'generate' },
      label: 'Generate three American Express numbers',
    },
    {
      fields: { ...sampleDefaults, brand: 'maestro', count: '3', mode: 'generate' },
      label: 'Generate three Maestro numbers',
    },
  ],
  sensitiveInput: true,
  supportsSelection: true,
};
