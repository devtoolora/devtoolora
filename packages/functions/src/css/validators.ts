import { FunctionError } from '../errors';

export function strictChoices(
  options: Record<string, string | number>,
  choices: Record<string, string[]>,
): void {
  for (const [key, allowed] of Object.entries(choices))
    if (!allowed.includes(String(options[key])))
      throw cssError(
        `Choose a listed ${key} value. Unknown options are not replaced with defaults.`,
      );
}

export function oneOf(value: string, allowed: string[], fallback: string): string {
  return allowed.includes(value) ? value : fallback;
}

export function bounded(value: number, label: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max)
    throw cssError(`${label} must be between ${min} and ${max}.`);

  return Math.round(value * 100) / 100;
}

export function integer(value: number, label: string, min: number, max: number): number {
  if (!Number.isInteger(value)) throw cssError(`${label} must be a whole number.`);

  return bounded(value, label, min, max);
}

export function cssError(message: string): FunctionError {
  return new FunctionError('INVALID_CSS', message);
}
