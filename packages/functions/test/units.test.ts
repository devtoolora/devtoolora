import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  convertMeasurement,
  convertTemperature,
  listMeasurementUnits,
  parseMeasurementValue,
} from '@devtoolora/functions/measurement';
import { FunctionError } from '@devtoolora/functions/errors';

function close(actual: number, expected: number): void {
  assert.ok(
    Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)),
    `${actual} differs from ${expected}`,
  );
}

describe('measurement conversion engine', () => {
  it('uses international length factors and distinct decimal/binary byte prefixes', () => {
    assert.equal(convertMeasurement(1, 'mi', 'm').value, 1609.344);
    assert.equal(convertMeasurement(1, 'ft', 'm').value, 0.3048);
    close(convertMeasurement(1, 'in', 'cm').value, 2.54);
    assert.equal(convertMeasurement(1000, 'B', 'kB').value, 1);
    assert.equal(convertMeasurement(1024, 'B', 'KiB').value, 1);
    assert.equal(convertMeasurement(1, 'kB', 'KiB').value, 0.9765625);
    assert.equal(convertMeasurement(1048576, 'B', 'MiB').value, 1);
    close(convertMeasurement(1048576, 'B', 'MB').value, 1.048576);
    assert.equal(convertMeasurement(1, 'TiB', 'B').value, 1099511627776);
  });

  it('supports every same-dimension pair and rejects every incompatible pair', () => {
    const units = listMeasurementUnits();

    assert.equal(units.length, 20);

    for (const from of units)
      for (const to of units) {
        if (from.dimension !== to.dimension) {
          assert.throws(
            () => convertMeasurement(100, from.id, to.id),
            (error: unknown) =>
              error instanceof FunctionError && error.code === 'UNIT_DIMENSION_MISMATCH',
          );
        } else {
          const converted = convertMeasurement(100, from.id, to.id);

          close(convertMeasurement(converted.value, to.id, from.id).value, 100);
          assert.equal(converted.toSymbol, to.symbol);
          if (from.id === to.id) assert.equal(converted.value, 100);
        }
      }

    units[0]!.scale = 999;
    assert.equal(listMeasurementUnits()[0]!.scale, 0.001);
  });

  it('handles temperature offsets and exact boundary validation in all input scales', () => {
    assert.equal(convertTemperature(32, 'f').celsius, 0);
    close(convertTemperature(37).fahrenheit, 98.6);
    close(convertTemperature(-40, 'f').celsius, -40);
    assert.equal(convertTemperature(-273.15).kelvin, 0);
    assert.equal(convertTemperature(-459.67, 'f').kelvin, 0);
    assert.equal(convertTemperature(0, 'k').celsius, -273.15);
    assert.equal(convertTemperature(0, 'k').fahrenheit, -459.67);
    assert.ok(Number.isFinite(convertMeasurement(9e307, 'c', 'f').value));
    assert.ok(Number.isFinite(convertMeasurement(1e308, 'f', 'c').value));

    for (const [value, unit] of [
      [-273.150001, 'c'],
      [-459.670001, 'f'],
      [-0.000001, 'k'],
    ] satisfies Array<[number, 'c' | 'f' | 'k']>) {
      assert.throws(
        () => convertTemperature(value, unit),
        (error: unknown) => error instanceof FunctionError && error.code === 'BELOW_ABSOLUTE_ZERO',
      );
    }
  });

  it('rejects unsafe input, invalid units, negative storage and numeric range loss', () => {
    for (const input of [
      '',
      ' ',
      '1,5',
      '1 000',
      '1 km',
      '0x10',
      'NaN',
      'Infinity',
      '1e400',
      '1e-400',
      '9007199254740993',
      '1'.repeat(129),
    ]) {
      assert.throws(() => parseMeasurementValue(input), FunctionError);
    }

    assert.equal(parseMeasurementValue(' +1.5e2 '), 150);
    assert.equal(parseMeasurementValue('.5'), 0.5);
    assert.equal(parseMeasurementValue('0e400'), 0);
    assert.throws(() => convertMeasurement(1, '__proto__', 'm'), FunctionError);
    assert.throws(() => convertMeasurement(-1, 'B', 'KiB'), FunctionError);
    assert.equal(convertMeasurement(-1, 'm', 'cm').value, -100);
    for (const value of [NaN, Infinity, -Infinity])
      assert.throws(() => convertMeasurement(value, 'm', 'm'), FunctionError);
    assert.throws(() => convertMeasurement(Number.MAX_VALUE, 'km', 'mm'), FunctionError);
    assert.throws(() => convertMeasurement(Number.MIN_VALUE, 'mm', 'km'), FunctionError);
  });
});
