import { ToolError, type ToolField, type ToolFieldCondition } from '@devtoolora/core';

export function choiceField<T extends string>(
  value: string | undefined,
  fallback: T,
  choices: readonly T[],
  message: string,
): T {
  if (value === undefined || value === '') return fallback;
  if (!(choices as readonly string[]).includes(value)) throw new ToolError(message);

  return value as T;
}

export function booleanField(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  if (value !== 'true' && value !== 'false')
    throw new ToolError('Checkbox values must be true or false.');

  return value === 'true';
}

export function colorField(id: string, label: string, defaultValue: string): ToolField {
  return {
    defaultValue,
    id,
    label,
    placeholder: defaultValue,
    presentation: 'color',
    type: 'text',
  };
}

export function rangeField(config: {
  defaultValue: string;
  help?: string;
  id: string;
  label: string;
  max: number;
  min: number;
  step?: number;
  unit?: string;
  visibleWhen?: ToolFieldCondition | ToolFieldCondition[];
}): ToolField {
  const { max, min, step, unit, ...rest } = config;

  return { ...rest, range: { max, min, step, unit }, type: 'number' };
}

export function rangedNumber(field: ToolField, values: Record<string, string>): number {
  if (field.type !== 'number' || !field.range)
    throw new ToolError(`${field.label} is not a ranged number field.`);

  const { max, min, step } = field.range;

  return numericField(
    values[field.id],
    field.label,
    min,
    max,
    Number(field.defaultValue),
    step === undefined ? 0 : (String(step).split('.')[1]?.length ?? 0),
  );
}

export function numericField(
  value: string | undefined,
  label: string,
  min: number,
  max: number,
  fallback: number,
  decimals = 0,
): number {
  if (value === undefined) return fallback;

  const raw = value.trim();
  const number = Number(raw);

  if (
    !/^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(raw) ||
    !Number.isFinite(number) ||
    number < min ||
    number > max ||
    Math.round(number * 10 ** decimals) / 10 ** decimals !== number
  )
    throw new ToolError(
      `${label} must be ${decimals === 0 ? 'a whole number' : 'a number'} between ${min} and ${max}${decimals === 0 ? '' : ` with up to ${decimals} decimals`}. Out-of-range values are not clamped.`,
    );

  return number;
}
