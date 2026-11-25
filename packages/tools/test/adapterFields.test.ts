import { ToolError } from '@devtoolora/core';
import { describe, expect, it } from 'vitest';
import { choiceField, colorField, rangeField, rangedNumber } from '../src/adapters/fields';

describe('shared adapter fields', () => {
  it('builds a color text field', () => {
    expect(colorField('color', 'Color', '#2563eb')).toEqual({
      defaultValue: '#2563eb',
      id: 'color',
      label: 'Color',
      placeholder: '#2563eb',
      presentation: 'color',
      type: 'text',
    });
  });

  it('rejects ranged numbers outside the range', () => {
    const field = rangeField({
      defaultValue: '2',
      id: 'p',
      label: 'Padding',
      max: 64,
      min: 0,
      step: 1,
      unit: 'px',
    });

    expect(() => rangedNumber(field, { p: '65' })).toThrow(ToolError);
    expect(() => rangedNumber(field, { p: '65' })).toThrow('between 0 and 64');
    expect(rangedNumber(field, {})).toBe(2);
  });

  it('falls back for an empty choice', () => {
    expect(choiceField('', 'a', ['a', 'b'] as const, 'm')).toBe('a');
  });
});
