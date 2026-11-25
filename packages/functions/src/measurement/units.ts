import { FunctionError } from '../errors';

export interface MeasurementUnit {
  dimension: 'length' | 'storage' | 'temperature';
  id: string;
  label: string;
  scale: number;
  symbol: string;
}

export interface MeasurementReport {
  dimension: MeasurementUnit['dimension'];
  from: string;
  fromSymbol: string;
  input: number;
  to: string;
  toSymbol: string;
  value: number;
}

const units: MeasurementUnit[] = [
  { dimension: 'length', id: 'mm', label: 'Millimeters', scale: 0.001, symbol: 'mm' },
  { dimension: 'length', id: 'cm', label: 'Centimeters', scale: 0.01, symbol: 'cm' },
  { dimension: 'length', id: 'm', label: 'Meters', scale: 1, symbol: 'm' },
  { dimension: 'length', id: 'km', label: 'Kilometers', scale: 1000, symbol: 'km' },
  { dimension: 'length', id: 'in', label: 'Inches (international)', scale: 0.0254, symbol: 'in' },
  { dimension: 'length', id: 'ft', label: 'Feet (international)', scale: 0.3048, symbol: 'ft' },
  { dimension: 'length', id: 'yd', label: 'Yards (international)', scale: 0.9144, symbol: 'yd' },
  { dimension: 'length', id: 'mi', label: 'Miles (international)', scale: 1609.344, symbol: 'mi' },
  { dimension: 'storage', id: 'B', label: 'Bytes', scale: 1, symbol: 'B' },
  { dimension: 'storage', id: 'kB', label: 'Kilobytes (1000 B)', scale: 1e3, symbol: 'kB' },
  { dimension: 'storage', id: 'MB', label: 'Megabytes (1000 kB)', scale: 1e6, symbol: 'MB' },
  { dimension: 'storage', id: 'GB', label: 'Gigabytes (1000 MB)', scale: 1e9, symbol: 'GB' },
  { dimension: 'storage', id: 'TB', label: 'Terabytes (1000 GB)', scale: 1e12, symbol: 'TB' },
  { dimension: 'storage', id: 'KiB', label: 'Kibibytes (1024 B)', scale: 2 ** 10, symbol: 'KiB' },
  { dimension: 'storage', id: 'MiB', label: 'Mebibytes (1024 KiB)', scale: 2 ** 20, symbol: 'MiB' },
  { dimension: 'storage', id: 'GiB', label: 'Gibibytes (1024 MiB)', scale: 2 ** 30, symbol: 'GiB' },
  { dimension: 'storage', id: 'TiB', label: 'Tebibytes (1024 GiB)', scale: 2 ** 40, symbol: 'TiB' },
  { dimension: 'temperature', id: 'c', label: 'Celsius', scale: 1, symbol: '°C' },
  { dimension: 'temperature', id: 'f', label: 'Fahrenheit', scale: 5 / 9, symbol: '°F' },
  { dimension: 'temperature', id: 'k', label: 'Kelvin', scale: 1, symbol: 'K' },
];

export function listMeasurementUnits(): MeasurementUnit[] {
  return units.map((unit) => ({ ...unit }));
}

export function convertMeasurement(value: number, from: string, to: string): MeasurementReport {
  if (!Number.isFinite(value))
    throw new FunctionError('INVALID_MEASUREMENT', 'Value must be a finite number.');

  const source = units.find((unit) => unit.id === from);
  const target = units.find((unit) => unit.id === to);

  if (!source || !target)
    throw new FunctionError('INVALID_UNIT', 'Choose a supported source and target unit.');
  if (source.dimension !== target.dimension)
    throw new FunctionError(
      'UNIT_DIMENSION_MISMATCH',
      'Source and target must measure the same quantity: length, storage or temperature.',
    );
  if (source.dimension === 'storage' && value < 0)
    throw new FunctionError('NEGATIVE_STORAGE', 'Storage size cannot be negative.');

  if (source.dimension === 'temperature') {
    const minimum = absoluteZero.get(from) ?? 0;

    if (value < minimum)
      throw new FunctionError(
        'BELOW_ABSOLUTE_ZERO',
        `Temperature cannot be below absolute zero (${minimum} ${source.symbol}).`,
      );
  }

  const converted = convertedValue(value, source, target);

  if (
    !Number.isFinite(converted) ||
    (value !== 0 && converted === 0 && source.dimension !== 'temperature')
  ) {
    throw new FunctionError(
      'MEASUREMENT_OUT_OF_RANGE',
      'Conversion exceeds the finite numeric range or underflows to zero.',
    );
  }

  return {
    dimension: source.dimension,
    from,
    fromSymbol: source.symbol,
    input: value,
    to,
    toSymbol: target.symbol,
    value: Object.is(converted, -0) ? 0 : converted,
  };
}

const absoluteZero = new Map([
  ['c', -273.15],
  ['f', -459.67],
]);

function convertedValue(value: number, source: MeasurementUnit, target: MeasurementUnit): number {
  if (source.id === target.id) return value;
  if (source.dimension === 'temperature') return temperatureValue(value, source.id, target.id);

  return value * (source.scale / target.scale);
}

function temperatureValue(value: number, from: string, to: string): number {
  if (from === 'f') return to === 'c' ? (value - 32) * (5 / 9) : (value + 459.67) * (5 / 9);
  if (from === 'c') return to === 'f' ? value * (9 / 5) + 32 : value + 273.15;

  return to === 'c' ? value - 273.15 : value * (9 / 5) - 459.67;
}

export function parseMeasurementValue(input: string): number {
  if (input.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input.trim())) {
    throw new FunctionError(
      'INVALID_MEASUREMENT',
      'Enter one decimal number with a dot, optionally using an e exponent.',
    );
  }

  const value = Number(input.trim());

  if (!Number.isFinite(value))
    throw new FunctionError('INVALID_MEASUREMENT', 'Value must be a finite number.');
  if (value === 0 && /[1-9]/.test(input.trim().split(/[eE]/)[0] ?? ''))
    throw new FunctionError('MEASUREMENT_OUT_OF_RANGE', 'Input underflows to zero.');
  if (Number.isInteger(value) && !Number.isSafeInteger(value))
    throw new FunctionError(
      'UNSAFE_MEASUREMENT',
      'Integer input must stay within the safe integer range.',
    );

  return value;
}
