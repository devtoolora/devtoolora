import { ToolError, type ToolDefinition } from '@devtoolora/core';
import {
  convertMeasurement,
  listMeasurementUnits,
  parseMeasurementValue,
} from '@devtoolora/functions/measurement';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const unitOptions = listMeasurementUnits().map((unit) => ({
  label: `${unit.dimension} · ${unit.label} (${unit.symbol})`,
  value: unit.id,
}));

export const unitConverterTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Measurement',
  description:
    'Convert length, decimal/binary storage and temperature with explicit source and target units.',
  fields: [
    {
      defaultValue: '100',
      help: 'Decimal input with a dot.',
      id: 'value',
      label: 'Value',
      required: true,
      type: 'number',
    },
    { defaultValue: 'km', id: 'from', label: 'From unit', options: unitOptions, type: 'select' },
    {
      defaultValue: 'mi',
      help: 'Choose the same dimension as From.',
      id: 'to',
      label: 'To unit',
      options: unitOptions,
      type: 'select',
    },
    {
      defaultValue: '6',
      help: '0–12 display decimal places.',
      id: 'decimals',
      label: 'Decimal places',
      type: 'number',
    },
    {
      defaultValue: 'value',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Value', value: 'value' },
        { label: 'Report', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'unit-converter',
  inputKind: 'none',
  keywords: ['length', 'metric', 'imperial', 'bytes', 'kib', 'storage', 'miles', 'inches'],
  name: 'Unit Converter',
  outputKind: 'text',
  relatedToolIds: ['temperature-converter', 'number-formatter'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const input = parseMeasurementValue(fields.value ?? '');
      const digits = fields.decimals ?? '6';

      if (!/^\d{1,2}$/.test(digits) || Number(digits) > 12)
        throw new ToolError('Decimal places must be an integer from 0 through 12.');

      const decimals = Number(digits);
      const mode = fields.report ?? 'value';

      if (mode !== 'value' && mode !== 'json')
        throw new ToolError('Choose Value or Report output.');

      const report = convertMeasurement(input, fields.from ?? 'km', fields.to ?? 'mi');
      const formatted = `${Number(report.value.toFixed(decimals))} ${report.toSymbol}`;
      const text =
        mode === 'json'
          ? JSON.stringify({ ...report, decimals, formatted, input }, null, 2)
          : formatted;

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName: `unit-conversion.${mode === 'json' ? 'json' : 'txt'}`,
          mimeType: mode === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: mode === 'json' ? 'json' : 'plaintext',
        summary: `${formatted} · display rounded to at most ${decimals} decimal places.`,
        text,
      };
    }),
  samples: [
    {
      fields: { decimals: '6', from: 'km', report: 'value', to: 'mi', value: '100' },
      label: '100 km to miles',
    },
    {
      fields: { decimals: '6', from: 'B', report: 'value', to: 'kB', value: '1048576' },
      label: 'Bytes to decimal kilobytes',
    },
    {
      fields: { decimals: '6', from: 'B', report: 'json', to: 'MiB', value: '1048576' },
      label: 'Bytes to binary mebibytes',
    },
    {
      fields: { decimals: '8', from: 'kB', report: 'value', to: 'KiB', value: '1' },
      label: 'kB is not KiB',
    },
    {
      fields: { decimals: '4', from: 'in', report: 'value', to: 'cm', value: '1' },
      label: 'One international inch',
    },
    {
      fields: { decimals: '2', from: 'c', report: 'value', to: 'f', value: '37' },
      label: '37 °C to Fahrenheit',
    },
    {
      fields: { decimals: '2', from: 'k', report: 'json', to: 'c', value: '0' },
      label: 'Absolute zero report',
    },
  ],
  supportsSelection: false,
};
