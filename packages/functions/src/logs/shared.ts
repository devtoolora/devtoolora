import { FunctionError } from '../errors';

export function checkLogInput(text: string): void {
  if (text.length > 1_048_576) throw logError('Log input exceeds 1,048,576 characters.');
}

export function logError(message: string): FunctionError {
  return new FunctionError('INVALID_LOG_INPUT', message);
}
