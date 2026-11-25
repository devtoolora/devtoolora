import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import {
  parsePalette,
  simulatePalette,
  visionGridSvg,
  type VisionResult,
  type VisionType,
} from '@devtoolora/functions/color';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const visionTypes: VisionType[] = ['protan', 'deutan', 'tritan', 'achromat'];
const severityField = rangeField({
  defaultValue: '100',
  id: 'severity',
  label: 'Severity',
  max: 100,
  min: 0,
  step: 10,
  unit: '%',
});

/** Pair indexes are 1-based like the "#1" labels; every pair is listed, flagged or not. */
function visionReport(result: VisionResult, severity: number, types: VisionType[]): string {
  const pairs = result.distances.map((pair) => ({
    a: pair.a + 1,
    b: pair.b + 1,
    deltaE: Object.fromEntries(
      Object.entries(pair.deltaE).map(([type, value]) => [type, Number(value.toFixed(4))]),
    ),
    flags: pair.flags,
  }));

  return JSON.stringify({ pairs, rows: result.rows, severity, types }, null, 2);
}

function runSimulation(text: string, values: Record<string, string>): ToolResult {
  const severity = rangedNumber(severityField, values);
  const selected = (values.types ?? visionTypes.join(','))
    .split(',')
    .filter((entry): entry is VisionType => visionTypes.some((type) => type === entry));
  const colors = withToolError(() => parsePalette(text));
  const result = withToolError(() => simulatePalette(colors, { severity, types: selected }));
  const table = result.rows.map((row) => [row.type, ...row.colors]);
  const pairLabel = (index: number) => `#${index + 1}`;
  const pairSummary = result.pairs
    .slice(0, 5)
    .map((pair) => `${pairLabel(pair.a)}/${pairLabel(pair.b)} (${pair.flags.join(', ')})`)
    .join('; ');
  const morePairs =
    result.pairs.length > 5 ? `; ${result.pairs.length - 5} more in Copy or Save` : '';
  const flagged = result.pairs.map((pair) => [
    `${pairLabel(pair.a)} / ${pairLabel(pair.b)}`,
    pair.flags.join(', '),
    pair.deltaE.normal.toFixed(3),
    ...selected.map((type) => `${type} ${pair.deltaE[type].toFixed(3)}`),
  ]);
  const output = [
    ...table.map((row) => row.join('\t')),
    '',
    ...(flagged.length > 0 ? flagged.map((row) => row.join('\t')) : ['No hard-to-tell pairs.']),
  ].join('\n');
  const svg = visionGridSvg(result);

  return {
    artifacts: [
      {
        base64: encodeBase64Text(visionReport(result, severity, selected)),
        fileName: 'color-vision-report.json',
        mimeType: 'application/json;charset=utf-8',
      },
    ],
    jsonTable: {
      columns: ['Color', ...result.rows.map((row) => row.type)],
      presentation: 'plain',
      rows: colors.map((_, index) => [
        pairLabel(index),
        ...result.rows.map((row) => row.colors[index] ?? null),
      ]),
    },
    language: 'plaintext',
    previewDataUri: `data:image/svg+xml;base64,${base64Encode(new TextEncoder().encode(svg))}`,
    summary: result.pairs.length
      ? `${result.pairs.length} hard-to-tell pair${result.pairs.length === 1 ? '' : 's'} at ${severity}% severity: ${pairSummary}${morePairs}.`
      : `No hard-to-tell pairs at ${severity}% severity.`,
    text: output,
  };
}

const sample = (label: string, text: string, fields: Record<string, string> = {}) => ({
  fields,
  label,
  text,
});

export const colorBlindnessPaletteSimulatorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Simulate protanopia, deuteranopia, tritanopia and achromatopsia on a palette and flag the pairs that become hard to tell apart.',
  fields: [
    severityField,
    {
      defaultValue: visionTypes.join(','),
      id: 'types',
      label: 'Vision types',
      options: [
        { label: 'Protan (red)', value: 'protan' },
        { label: 'Deutan (green)', value: 'deutan' },
        { label: 'Tritan (blue)', value: 'tritan' },
        { label: 'Achromat (no color)', value: 'achromat' },
      ],
      type: 'checkboxGroup',
    },
  ],
  id: 'color-blindness-palette-simulator',
  inputKind: 'text',
  inputPresentation: { label: 'Palette', placeholder: '#2563eb, #16a34a, #dc2626 (2-12 colors)' },
  keywords: ['color blindness', 'protanopia', 'deuteranopia', 'tritanopia', 'accessibility', 'cvd'],
  name: 'Color Blindness Palette Simulator',
  relatedToolIds: ['color-palette', 'color-mixer'],
  run: ({ fields: values, text }) => runSimulation(text, values),
  samples: [
    sample('Green and red', '#2ca02c, #d62728'),
    sample('Safe pair', '#1f77b4, #ff7f0e'),
    sample('Brand palette', '#2563eb, #16a34a, #dc2626, #f59e0b'),
    sample('Deutan only at 50%', '#2563eb, #7c3aed\n#16a34a', { severity: '50', types: 'deutan' }),
    sample('Near-identical grays', '#101010, #111111, #808080'),
    sample('Functions in a palette', 'rgb(37, 99, 235), hsl(120 60% 40%), tomato'),
  ],
};
