import { convertMeasurement } from './units';

export {
  convertMeasurement,
  listMeasurementUnits,
  parseMeasurementValue,
  type MeasurementReport,
  type MeasurementUnit,
} from './units';

export type TemperatureUnit = 'c' | 'f' | 'k';

export function convertTemperature(
  value: number,
  unit: TemperatureUnit = 'c',
): { celsius: number; fahrenheit: number; kelvin: number } {
  return {
    celsius: convertMeasurement(value, unit, 'c').value,
    fahrenheit: convertMeasurement(value, unit, 'f').value,
    kelvin: convertMeasurement(value, unit, 'k').value,
  };
}
