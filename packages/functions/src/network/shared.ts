import { FunctionError } from '../errors';

export function networkError(code: string, message: string): FunctionError {
  return new FunctionError(code, message);
}

export function required(value: string, label: string): string {
  if (value.length > 128)
    throw networkError('INPUT_TOO_LARGE', `${label} input exceeds 128 characters.`);

  const input = value.trim();

  if (!input) throw networkError('REQUIRED_INPUT', `${label} input is required.`);

  return input;
}
