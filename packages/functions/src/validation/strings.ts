import { FunctionError } from '../errors';

export function nonEmptyString(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new FunctionError('REQUIRED_STRING', `${label} is required.`);
  }

  return normalized;
}

export function oneOf<const Value extends string>(
  value: string,
  allowed: readonly Value[],
  label: string,
): Value {
  if (!allowed.includes(value as Value)) {
    throw new FunctionError('UNSUPPORTED_VALUE', `${label} must be one of: ${allowed.join(', ')}.`);
  }

  return value as Value;
}

const lineBreakOrControl = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]');

export function assertSingleLine(value: string, label: string): void {
  if (lineBreakOrControl.test(value))
    throw new FunctionError('SINGLE_LINE', `${label} must be one line without control characters.`);
}
