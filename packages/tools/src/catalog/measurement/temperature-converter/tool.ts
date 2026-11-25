import { ToolDefinition, ToolError } from '@devtoolora/core';
import { convertTemperature, parseMeasurementValue } from '@devtoolora/functions/measurement';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const temperatureConverterTool: ToolDefinition = {
  id: 'temperature-converter',
  keywords: ['celsius', 'fahrenheit', 'kelvin', 'degrees', 'weather'],
  name: 'Temperature Converter',
  category: 'Measurement',
  description:
    'Compare Celsius, Fahrenheit and Kelvin with validated absolute temperatures and explicit display precision.',
  inputKind: 'none',
  outputKind: 'json',
  selectionTarget: { field: 'value' },
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  fields: [
    {
      defaultValue: '20',
      help: 'Absolute temperature; decimal dot.',
      id: 'value',
      label: 'Value',
      type: 'number',
    },
    {
      defaultValue: 'c',
      id: 'unit',
      label: 'Input scale',
      options: [
        { label: 'Celsius (°C)', value: 'c' },
        { label: 'Fahrenheit (°F)', value: 'f' },
        { label: 'Kelvin (K)', value: 'k' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '3',
      help: '0–12 display decimal places.',
      id: 'decimals',
      label: 'Decimal places',
      type: 'number',
    },
    {
      defaultValue: 'json',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Report', value: 'json' },
        { label: 'Values', value: 'value' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  samples: [
    {
      fields: { decimals: '3', report: 'json', unit: 'c', value: '20' },
      label: 'Room temperature (20 °C)',
    },
    {
      fields: { decimals: '3', report: 'value', unit: 'f', value: '98.6' },
      label: '98.6 °F in all scales',
    },
    {
      fields: { decimals: '2', report: 'json', unit: 'k', value: '0' },
      label: 'Absolute zero (0 K)',
    },
    {
      fields: { decimals: '2', report: 'value', unit: 'c', value: '-40' },
      label: 'Where Celsius equals Fahrenheit',
    },
    {
      fields: { decimals: '6', report: 'json', unit: 'f', value: '32' },
      label: 'Water freezing point (32 °F)',
    },
    {
      fields: { decimals: '1', report: 'value', unit: 'f', value: '350' },
      label: 'Oven temperature (350 °F)',
    },
  ],
  relatedToolIds: ['unit-converter', 'number-formatter'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  autoRun: true,
  run: ({ text, fields }) =>
    withToolError(() => {
      const report = convertTemperatureValue(fields.value ?? text, fields.unit);
      const digits = fields.decimals ?? '3';

      if (!/^\d{1,2}$/.test(digits) || Number(digits) > 12)
        throw new ToolError('Decimal places must be an integer from 0 through 12.');

      const decimals = Number(digits);
      const formatted = {
        celsius: `${Number(report.celsius.toFixed(decimals))} °C`,
        fahrenheit: `${Number(report.fahrenheit.toFixed(decimals))} °F`,
        kelvin: `${Number(report.kelvin.toFixed(decimals))} K`,
      };
      const mode = fields.report ?? 'json';

      if (mode !== 'json' && mode !== 'value')
        throw new ToolError('Choose Values or Report output.');

      const output =
        mode === 'json'
          ? JSON.stringify({ ...report, decimals, formatted }, null, 2)
          : Object.values(formatted).join('\n');

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: `temperature-conversion.${mode === 'json' ? 'json' : 'txt'}`,
          mimeType: mode === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: mode === 'json' ? 'json' : 'plaintext',
        summary: 'Absolute temperature · three scales · shared conversion engine.',
        text: output,
      };
    }),
};

function convertTemperatureValue(
  value: string,
  unit: string | undefined,
): ReturnType<typeof convertTemperature> {
  if (unit !== undefined && unit !== 'c' && unit !== 'f' && unit !== 'k')
    throw new ToolError('Choose Celsius, Fahrenheit or Kelvin input.');

  return convertTemperature(parseMeasurementValue(value), unit ?? 'c');
}
