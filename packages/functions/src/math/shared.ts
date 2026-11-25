import { FunctionError } from '../errors';

export function required(value: string, label: string): string {
  const input = value.trim();

  if (!input) throw mathError(`${label} input is required.`);

  return input;
}

export function mathError(message: string): FunctionError {
  return new FunctionError('INVALID_MATH', message);
}

export function formatDouble(value: number): string {
  return String(Number(value.toPrecision(15)));
}
