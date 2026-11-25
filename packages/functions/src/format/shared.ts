import { FunctionError } from '../errors';

export function requiredText(value: string, label: string): string {
  const input = value.trim();

  if (!input) throw new FunctionError('REQUIRED_INPUT', `${label} input is required.`);

  return input;
}
