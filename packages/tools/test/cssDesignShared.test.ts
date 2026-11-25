import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { rangeField, rangedNumber } from '../src/adapters/fields';
import { cssToolResult } from '../src/catalog/cssDesign/shared';

const angle = rangeField({
  defaultValue: '135',
  id: 'angle',
  label: 'Angle',
  max: 360,
  min: 0,
  unit: 'deg',
});

describe('cssDesign shared helpers', () => {
  it('validates ranged numbers', () => {
    assert.equal(rangedNumber(angle, {}), 135);
    assert.equal(rangedNumber(angle, { angle: '90' }), 90);
    for (const bad of ['1,5', '', 'NaN', '361', '12.5'])
      assert.throws(
        () => rangedNumber(angle, { angle: bad }),
        /Angle must be a whole number between 0 and 360/,
      );

    const fine = rangeField({
      defaultValue: '0',
      id: 'a',
      label: 'A',
      max: 2,
      min: -1,
      step: 0.01,
    });

    assert.equal(rangedNumber(fine, { a: '1.56' }), 1.56);
    assert.equal(rangedNumber(fine, { a: '-0.6' }), -0.6);
  });

  // Some callers turn an empty field into undefined and get the default.
  it('does not claim that empty values are rejected', () => {
    assert.throws(
      () => rangedNumber(angle, { angle: '361' }),
      (error: Error) => !/empty/i.test(error.message) && /not clamped/.test(error.message),
    );
  });

  it('builds the css tool result', () => {
    const result = cssToolResult({
      css: 'a { b: c; }',
      fields: {},
      fileName: 'x.css',
      kind: 'x',
      summary: 's',
    });

    assert.equal(Buffer.from(result.artifact?.base64 ?? '', 'base64').toString(), 'a { b: c; }');
    assert.equal(result.artifacts?.length, 1);
    assert.equal(result.language, 'css');
  });
});
