import { runBrowserWorkerTool } from '@devtoolora/browser-catalog';
import type { ToolField } from '@devtoolora/core';

/**
 * Every prop tests read from a field, optional where only some field types have it. Any
 * `ToolField` widens to it, so a test can compare props without narrowing by type.
 */
export type FieldProps = {
  accept?: string;
  defaultValue?: string;
  help?: string;
  id: string;
  label: string;
  maxBytes?: number;
  multiple?: boolean;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  presentation?: string;
  required?: boolean;
  type: ToolField['type'];
  visibleWhen?: ToolField['visibleWhen'];
};

export function fieldsOf(tool: { fields?: FieldProps[] }): FieldProps[] | undefined {
  return tool.fields;
}

export async function run(
  id: string,
  text = '',
  fields: Record<string, string> = {},
): Promise<string> {
  return (await runBrowserWorkerTool(id, { text, fields })).text;
}

export async function result(id: string, text = '', fields: Record<string, string> = {}) {
  return runBrowserWorkerTool(id, { text, fields });
}

export function textDataUri(value: string): string {
  return `data:text/plain;base64,${Buffer.from(value).toString('base64')}`;
}
