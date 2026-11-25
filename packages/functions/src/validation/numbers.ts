import { FunctionError } from '../errors';

export function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new FunctionError('INVALID_NUMBER', `${label} must be a finite number.`);
  }

  return value;
}

export function boundedNumber(value: number, label: string, min: number, max: number): number {
  finiteNumber(value, label);

  if (value < min || value > max) {
    throw new FunctionError('NUMBER_OUT_OF_RANGE', `${label} must be between ${min} and ${max}.`);
  }

  return value;
}

export function boundedInteger(value: number, label: string, min: number, max: number): number {
  boundedNumber(value, label, min, max);

  if (!Number.isInteger(value)) {
    throw new FunctionError('INVALID_INTEGER', `${label} must be an integer.`);
  }

  return value;
}
