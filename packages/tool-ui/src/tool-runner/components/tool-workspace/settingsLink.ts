import type { SerializedToolDefinition } from '@devtoolora/core';

type Field = NonNullable<SerializedToolDefinition['fields']>[number];

/**
 * Options only: free text, passwords and files can hold private input, so they never enter a link.
 */
function shareable(field: Field): boolean {
  return (
    field.type === 'select' ||
    field.type === 'checkboxGroup' ||
    field.type === 'checkbox' ||
    field.type === 'number'
  );
}

function valid(field: Field, value: string): boolean {
  if (value.length > 64) return false;
  if (field.type === 'select') return field.options.some((option) => option.value === value);
  if (field.type === 'checkboxGroup')
    return value
      .split(',')
      .every((item) => !item || field.options.some((option) => option.value === item));
  if (field.type === 'checkbox') return value === 'true' || value === 'false';

  return value.trim() !== '' && Number.isFinite(Number(value));
}

export function hasShareableSettings(tool: SerializedToolDefinition): boolean {
  return Boolean(tool.fields?.some(shareable));
}

export function settingsLink(
  tool: SerializedToolDefinition,
  fields: Record<string, string>,
  href: string,
): string {
  const url = new URL(href);

  url.search = '';
  url.hash = '';

  for (const field of tool.fields ?? []) {
    const value = fields[field.id];

    if (
      shareable(field) &&
      value !== undefined &&
      value !== (field.defaultValue ?? '') &&
      valid(field, value)
    )
      url.searchParams.set(field.id, value);
  }

  return url.toString();
}

export function settingsFromSearch(
  tool: SerializedToolDefinition,
  search: string,
): Record<string, string> {
  const params = new URLSearchParams(search);

  return Object.fromEntries(
    (tool.fields ?? [])
      .filter(
        (field) =>
          shareable(field) && params.has(field.id) && valid(field, params.get(field.id) ?? ''),
      )
      .map((field) => [field.id, params.get(field.id) ?? '']),
  );
}
