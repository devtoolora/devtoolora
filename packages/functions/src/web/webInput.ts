import { FunctionError } from '../errors';

export function required(value: string, label: string): string {
  const input = value.trim();

  if (!input) throw webError(`${label} input is required.`);

  return input;
}

export function webError(message: string): FunctionError {
  return new FunctionError('INVALID_WEB_INPUT', message);
}
