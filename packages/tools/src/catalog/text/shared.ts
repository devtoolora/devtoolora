import { ToolError } from '@devtoolora/core';

export function checkbox(
  fields: Record<string, string>,
  id: string,
  label: string,
  fallback = true,
): boolean {
  const value = fields[id];

  if (value === undefined) return fallback;
  if (value !== 'true' && value !== 'false') throw new ToolError(`${label} must be true or false.`);

  return value === 'true';
}
