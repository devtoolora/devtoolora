import { ToolError } from '@devtoolora/core';
import { FunctionError } from '@devtoolora/functions/errors';

export function withToolError<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof FunctionError) {
      throw new ToolError(error.message);
    }

    throw error;
  }
}

export async function withToolErrorAsync<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof FunctionError) {
      throw new ToolError(error.message);
    }

    throw error;
  }
}
