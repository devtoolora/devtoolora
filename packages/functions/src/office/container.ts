import { readZip } from '../binary/unzip';
import { FunctionError } from '../errors';
import { bytesToUtf8 } from '../binary/utf8';
import type { XmlDocument } from '@rgrove/parse-xml';
import { parseXmlDocument } from '../format/xmlDocument';

const odfMimetype = 'application/vnd.oasis.opendocument';

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

/** The first ZIP entry of an OpenDocument file is a stored `mimetype`. */
function isOpenDocument(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || bytes.length < 30) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const start = 30 + nameLength + extraLength;
  const name = bytesToUtf8(bytes.subarray(30, 30 + nameLength));

  return (
    name === 'mimetype' &&
    view.getUint16(8, true) === 0 &&
    bytesToUtf8(bytes.subarray(start, start + view.getUint32(18, true))).startsWith(odfMimetype)
  );
}

export function assertOfficeZip(bytes: Uint8Array, kind: 'docx' | 'xlsx'): void {
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]))
    throw new FunctionError(
      'UNSUPPORTED_OFFICE',
      `This is a legacy .xls/.doc or a password-protected file, not a .${kind} file. Save it as .${kind} without a password and try again.`,
    );

  if (isOpenDocument(bytes))
    throw new FunctionError(
      'UNSUPPORTED_OFFICE',
      `This is an OpenDocument file. .ods/.odt are not supported; save it as .${kind} and try again.`,
    );
}

const noun = { docx: 'document', xlsx: 'workbook' } as const;

export function notOfficeFile(kind: 'docx' | 'xlsx'): FunctionError {
  return new FunctionError(`INVALID_${kind.toUpperCase()}`, `This is not a .${kind} file.`);
}

export function readOfficeZip(
  bytes: Uint8Array,
  kind: 'docx' | 'xlsx',
  include: (name: string) => boolean,
): Map<string, Uint8Array> {
  try {
    return readZip(bytes, { include });
  } catch (error) {
    if (!(error instanceof FunctionError)) throw error;

    if (error.message === 'The file is not a valid ZIP archive.') throw notOfficeFile(kind);

    if (error.code === 'ZIP_LIMIT')
      throw new FunctionError(
        `${kind.toUpperCase()}_LIMIT`,
        `This .${kind} file is too large to convert (a part inflates past its size limit).`,
      );

    throw new FunctionError(
      `INVALID_${kind.toUpperCase()}`,
      `The ${noun[kind]} looks corrupt: ${error.message}`,
    );
  }
}

export function officeXml(
  entries: Map<string, Uint8Array>,
  path: string,
  kind: 'docx' | 'xlsx',
): XmlDocument | undefined {
  const bytes = entries.get(path);

  if (!bytes) return undefined;

  try {
    return parseXmlDocument(bytesToUtf8(bytes), { maxLength: 30_000_000, maxNodes: 3_000_000 });
  } catch (error) {
    if (!(error instanceof FunctionError)) throw error;

    if (error.code === 'XML_LIMIT')
      throw new FunctionError(`${kind.toUpperCase()}_LIMIT`, `${path} is too large to read.`);

    throw new FunctionError(
      `INVALID_${kind.toUpperCase()}`,
      `The ${noun[kind]} looks corrupt: ${path} is not valid XML.`,
    );
  }
}

export const officeMaxBytes = 20 * 1024 * 1024;

export function corruptOffice(kind: 'docx' | 'xlsx', message: string): FunctionError {
  return new FunctionError(
    `INVALID_${kind.toUpperCase()}`,
    `The ${noun[kind]} looks corrupt: ${message}`,
  );
}

export function resolveOfficePart(directory: string, target: string): string {
  const parts: string[] = [];

  for (const part of (target.startsWith('/') ? target.slice(1) : `${directory}${target}`).split(
    '/',
  )) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }

  return parts.join('/');
}
