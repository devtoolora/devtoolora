import { ToolError, type ToolDefinition, type ToolField } from '@devtoolora/core';
import { calculateTransfer, type TransferOptions } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

type Mode = TransferOptions['solveFor'];

const sizeUnits = [
  'bit',
  'kbit',
  'Mbit',
  'Gbit',
  'B',
  'kB',
  'MB',
  'GB',
  'TB',
  'KiB',
  'MiB',
  'GiB',
  'TiB',
];
const rateUnits = [
  'bit/s',
  'kbit/s',
  'Mbit/s',
  'Gbit/s',
  'B/s',
  'kB/s',
  'MB/s',
  'GB/s',
  'KiB/s',
  'MiB/s',
  'GiB/s',
];
const timeUnits = ['s', 'min', 'h', 'd'];
const unitOptions = (units: string[]) => units.map((unit) => ({ label: unit, value: unit }));
const hideWhenSolving = (mode: Mode) => ({ field: 'solveFor', isNot: [mode] });

const fields: ToolField[] = [
  {
    defaultValue: 'time',
    id: 'solveFor',
    label: 'Solve for',
    options: [
      { label: 'Time', value: 'time' },
      { label: 'Size', value: 'size' },
      { label: 'Rate', value: 'rate' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  {
    defaultValue: '1',
    id: 'size',
    label: 'Size',
    type: 'number',
    visibleWhen: hideWhenSolving('size'),
  },
  {
    defaultValue: 'GB',
    id: 'sizeUnit',
    label: 'Size unit',
    options: unitOptions(sizeUnits),
    type: 'select',
    visibleWhen: hideWhenSolving('size'),
  },
  {
    defaultValue: '100',
    id: 'rate',
    label: 'Rate',
    type: 'number',
    visibleWhen: hideWhenSolving('rate'),
  },
  {
    defaultValue: 'Mbit/s',
    id: 'rateUnit',
    label: 'Rate unit',
    options: unitOptions(rateUnits),
    type: 'select',
    visibleWhen: hideWhenSolving('rate'),
  },
  {
    defaultValue: '60',
    id: 'time',
    label: 'Time',
    type: 'number',
    visibleWhen: hideWhenSolving('time'),
  },
  {
    defaultValue: 's',
    id: 'timeUnit',
    label: 'Time unit',
    options: unitOptions(timeUnits),
    type: 'select',
    visibleWhen: hideWhenSolving('time'),
  },
  { defaultValue: '0', id: 'overhead', label: 'Protocol overhead (%)', type: 'number' },
];

const sample = (label: string, values: Record<string, string>) => ({
  fields: {
    overhead: '0',
    rate: '100',
    rateUnit: 'Mbit/s',
    size: '1',
    sizeUnit: 'GB',
    solveFor: 'time',
    time: '60',
    timeUnit: 's',
    ...values,
  },
  label,
});

function number(value: string | undefined, label: string): number | undefined {
  const text = (value ?? '').trim();

  if (text.length > 128) throw new ToolError(`${label} input exceeds 128 characters.`);

  return text === '' ? undefined : Number(text);
}

function isMode(value: string): value is Mode {
  return value === 'time' || value === 'size' || value === 'rate';
}

function isTimeUnit(value: string): value is TransferOptions['timeUnit'] {
  return timeUnits.includes(value);
}

function describeInputs(f: Record<string, string>, mode: Mode): string {
  const size = `${f.size?.trim()} ${f.sizeUnit}`;
  const rate = `${f.rate?.trim()} ${f.rateUnit}`;
  const time = `${f.time?.trim()} ${f.timeUnit}`;

  return { rate: `${size} in ${time}`, size: `${rate} for ${time}`, time: `${size} at ${rate}` }[
    mode
  ];
}

export const bandwidthCalculatorTool: ToolDefinition = {
  autoRun: true,
  capabilities,
  category: 'Network',
  description:
    'Work out the transfer time, file size or line rate from the other two, with optional protocol overhead.',
  fields,
  id: 'bandwidth-calculator',
  inputKind: 'none',
  keywords: ['download time', 'transfer speed', 'mbps', 'throughput', 'file size', 'data rate'],
  name: 'Bandwidth & Transfer Time Calculator',
  outputKind: 'text',
  relatedToolIds: ['unit-converter', 'duration-converter'],
  resultActions: actions,
  run: ({ fields: f }) =>
    withToolError(() => {
      const solveFor = f.solveFor ?? 'time';
      const timeUnit = f.timeUnit ?? 's';

      if (!isMode(solveFor)) throw new ToolError('Choose time, size or rate to solve for.');

      if (!isTimeUnit(timeUnit)) throw new ToolError('Choose a valid time unit.');

      const { summary, text } = calculateTransfer({
        overheadPercent: number(f.overhead, 'Overhead') ?? 0,
        rate: number(f.rate, 'Rate'),
        rateUnit: f.rateUnit ?? 'Mbit/s',
        size: number(f.size, 'Size'),
        sizeUnit: f.sizeUnit ?? 'GB',
        solveFor,
        time: number(f.time, 'Time'),
        timeUnit,
      });

      return result(
        text,
        'bandwidth.txt',
        'plaintext',
        `${describeInputs(f, solveFor)} → ${summary}`,
      );
    }),
  samples: [
    sample('1 GB over 100 Mbit/s', {}),
    sample('With 10 % overhead', { overhead: '10' }),
    sample('Backup of 500 GiB on gigabit', {
      rate: '1',
      rateUnit: 'Gbit/s',
      size: '500',
      sizeUnit: 'GiB',
    }),
    sample('Data in 10 minutes', { solveFor: 'size', time: '10', timeUnit: 'min' }),
    sample('Rate for 4 GB in 5 minutes', {
      solveFor: 'rate',
      size: '4',
      time: '5',
      timeUnit: 'min',
    }),
    sample('Slow link, 20 MB at 512 kbit/s', {
      rate: '512',
      rateUnit: 'kbit/s',
      size: '20',
      sizeUnit: 'MB',
    }),
  ],
  supportsSelection: false,
};
