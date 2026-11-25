import { FunctionError } from '../errors';

export function devError(message: string): FunctionError {
  return new FunctionError('INVALID_DEV_INPUT', message);
}
