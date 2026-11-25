import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { formatNumberReport, type NumberFormatOptions } from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

export const numberFormatterTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Data',
  description:
    'Format exact decimal input for a locale as a number, currency or percentage with explicit fraction digits.',
  fields: [
    {
      defaultValue: 'decimal',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Decimal', value: 'decimal' },
        { label: 'Currency', value: 'currency' },
        { label: 'Percent', value: 'percent' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'en-US',
      help: 'A supported BCP 47 tag. Report shows the locale actually resolved by the runtime.',
      id: 'locale',
      label: 'Locale',
      type: 'text',
    },
    {
      defaultValue: 'USD',
      help: 'Used only in Currency mode. Enter a supported code such as USD, EUR, CZK or JPY; this does not convert the amount.',
      id: 'currency',
      label: 'Currency code',
      type: 'text',
    },
    {
      defaultValue: '2',
      help: 'Integer 0–20, applied to every mode. Currency precision is explicitly overridden by this setting.',
      id: 'decimals',
      label: 'Fraction digits',
      type: 'number',
    },
    {
      defaultValue: 'maximum',
      id: 'precision',
      label: 'Precision',
      options: [
        { label: 'Maximum', value: 'maximum' },
        { label: 'Fixed', value: 'fixed' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    { defaultValue: 'true', id: 'grouping', label: 'Group digits', type: 'checkbox' },
    {
      defaultValue: 'formatted',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Formatted value', value: 'formatted' },
        { label: 'Report', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'number-formatter',
  inputKind: 'text',
  keywords: ['locale', 'currency', 'thousands separator', 'decimal', 'intl', 'money'],
  name: 'Number Formatter',
  outputKind: 'text',
  relatedToolIds: ['base-converter', 'percentage-calculator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const report = formatNumberReport(text, formatOptions(fields));
      const mode = fields.report || 'formatted';

      if (mode !== 'formatted' && mode !== 'json')
        throw new ToolError('Choose Formatted value or Report output.');

      const output = mode === 'json' ? JSON.stringify(report, null, 2) : report.formatted;

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: mode === 'json' ? 'number-format-report.json' : 'formatted-number.txt',
          mimeType: mode === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: mode === 'json' ? 'json' : 'plaintext',
        summary: `Formatted for ${report.locale} · ${report.minimumFractionDigits}–${report.maximumFractionDigits} fraction digits · display only.`,
        text: output,
      };
    }),
  samples: [
    {
      fields: {
        currency: 'USD',
        decimals: '2',
        grouping: 'true',
        locale: 'en-US',
        mode: 'currency',
        precision: 'fixed',
        report: 'formatted',
      },
      label: 'Currency $1234567.89 (US)',
      text: '1234567.89',
    },
    {
      fields: {
        currency: 'EUR',
        decimals: '2',
        grouping: 'true',
        locale: 'de-DE',
        mode: 'currency',
        precision: 'fixed',
        report: 'formatted',
      },
      label: 'Currency 1234567.89 € (DE)',
      text: '1234567.89',
    },
    {
      fields: {
        currency: 'CZK',
        decimals: '2',
        grouping: 'true',
        locale: 'cs-CZ',
        mode: 'currency',
        precision: 'fixed',
        report: 'json',
      },
      label: 'Czech price and separator report',
      text: '1234567.89',
    },
    {
      fields: {
        currency: 'USD',
        decimals: '1',
        grouping: 'true',
        locale: 'en-US',
        mode: 'percent',
        precision: 'maximum',
        report: 'formatted',
      },
      label: 'Percentage 0.856',
      text: '0.856',
    },
    {
      fields: {
        currency: 'USD',
        decimals: '3',
        grouping: 'false',
        locale: 'en-US',
        mode: 'decimal',
        precision: 'fixed',
        report: 'json',
      },
      label: 'Exact large decimal',
      text: '9007199254740993.125',
    },
    {
      fields: {
        currency: 'USD',
        decimals: '3',
        grouping: 'false',
        locale: 'en-US',
        mode: 'decimal',
        precision: 'fixed',
        report: 'formatted',
      },
      label: 'Fixed trailing zeroes',
      text: '1.5',
    },
  ],
  supportsSelection: true,
};

function formatOptions(fields: Record<string, string>): NumberFormatOptions {
  const mode = fields.mode || 'decimal';

  if (mode !== 'decimal' && mode !== 'currency' && mode !== 'percent')
    throw new ToolError('Choose Decimal, Currency or Percent mode.');

  const precision = fields.precision || 'maximum';

  if (precision !== 'maximum' && precision !== 'fixed')
    throw new ToolError('Choose Maximum or Fixed precision.');

  const digits = fields.decimals ?? '2';

  if (!/^\d{1,2}$/.test(digits) || Number(digits) > 20)
    throw new ToolError('Fraction digits must be an integer from 0 through 20.');

  const grouping = fields.grouping ?? 'true';

  if (grouping !== 'true' && grouping !== 'false')
    throw new ToolError('Group digits must be true or false.');

  return {
    currency: fields.currency,
    decimals: Number(digits),
    grouping: grouping === 'true',
    locale: fields.locale,
    mode,
    precision,
  };
}
