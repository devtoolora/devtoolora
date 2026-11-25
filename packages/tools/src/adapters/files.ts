import { ToolError } from '@devtoolora/core';
import { base64Encode, createZip, parseDataUri } from '@devtoolora/functions/binary';

export interface ToolFile {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
}

export function fileBytesFromField(
  value: string | undefined,
  label: string,
): { bytes: Uint8Array; mimeType: string } {
  if (!value) {
    throw new ToolError(`${label} is required.`);
  }

  try {
    return parseDataUri(value);
  } catch {
    throw new ToolError(`${label} must be a data URI file value.`);
  }
}

export function filesFromField(value: string | undefined, label: string): ToolFile[] {
  if (!value) {
    throw new ToolError(`${label} is required.`);
  }

  let entries: Array<{ data: string; name: string }>;

  try {
    entries = JSON.parse(value) as Array<{ data: string; name: string }>;
  } catch {
    throw new ToolError(`${label} must contain selected files.`);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ToolError(`${label} is required.`);
  }

  return entries.map((entry, index) => {
    const file = fileBytesFromField(entry.data, `${label} ${index + 1}`);

    return { name: entry.name || `file-${index + 1}`, ...file };
  });
}

export function zipArtifact(
  files: Array<{ bytes: Uint8Array; name: string }>,
  fileName: string,
): { base64: string; fileName: string; mimeType: string } {
  if (files.length === 0) {
    throw new ToolError('At least one file is required.');
  }

  return {
    base64: base64Encode(createZip(files)),
    mimeType: 'application/zip',
    fileName,
  };
}
