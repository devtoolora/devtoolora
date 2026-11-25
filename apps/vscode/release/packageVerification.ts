import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;

export const REQUIRED_PACKAGE_FILES = [
  'extension/package.json',
  'extension/dist/extension.js',
  'extension/dist/THIRD_PARTY_LICENSES.md',
  'extension/dist/webview/index.html',
  'extension/dist/webview/assets/main.js',
  'extension/dist/webview/assets/main.css',
  'extension/dist/webview/assets/app.js',
  'extension/dist/webview/assets/sidebarApp.js',
  'extension/dist/webview/assets/worker.js',
  'extension/dist/webview/assets/pdfjs.js',
  'extension/dist/webview/assets/runtime/libheif.js',
  'extension/dist/webview/assets/runtime/libheif.wasm',
  'extension/dist/webview/assets/runtime/tesseract-core-simd-lstm.js',
  'extension/dist/webview/assets/runtime/tesseract-core-simd-lstm.wasm',
  'extension/dist/webview/assets/runtime/eng.traineddata.gzip',
  'extension/dist/webview/assets/runtime/ces.traineddata.gzip',
  'extension/dist/webview/assets/runtime/runtime-manifest.json',
  'extension/dist/webview/assets/runtime/THIRD_PARTY_NOTICES.txt',
  'extension/media/icon.png',
  'extension/media/icon.svg',
] as const;

export const MAX_PACKAGE_BYTES = 12 * 1024 * 1024;
export const MAX_PACKAGE_FILES = 350;

const FORBIDDEN_PACKAGE_PATHS = [
  'extension/src/',
  'extension/test/',
  'extension/release/',
  'extension/scripts/',
];

export interface ZipEntry {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  path: string;
  uncompressedSize: number;
}

export interface PackageVerificationSummary {
  byteSize: number;
  entryCount: number;
}

interface VscePackageApi {
  pack(options: {
    cwd: string;
    dependencies?: boolean;
    packagePath: string;
    prepublish?: boolean;
    useYarn?: boolean;
  }): Promise<{ files: unknown[]; packagePath: string }>;
}

function assertRange(buffer: Buffer, offset: number, length: number, context: string): void {
  if (offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`Invalid VSIX archive: ${context} is outside the archive bounds.`);
  }
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const earliestOffset = Math.max(0, buffer.length - (22 + MAX_ZIP_COMMENT_LENGTH));

  for (let offset = buffer.length - 22; offset >= earliestOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error('Invalid VSIX archive: end-of-directory record was not found.');
}

export function readZipEntries(buffer: Buffer): ZipEntry[] {
  const endOffset = findEndOfCentralDirectory(buffer);

  assertRange(buffer, endOffset, 22, 'end-of-directory record');

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);

  assertRange(buffer, centralDirectoryOffset, centralDirectorySize, 'central directory');

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    assertRange(buffer, offset, 46, 'central directory entry');

    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid VSIX archive: central directory entry signature is invalid.');
    }

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const entryLength = 46 + nameLength + extraLength + commentLength;

    assertRange(buffer, offset, entryLength, 'central directory entry data');

    entries.push({
      compressedSize: buffer.readUInt32LE(offset + 20),
      compressionMethod: buffer.readUInt16LE(offset + 10),
      path: buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
    });

    offset += entryLength;
  }

  return entries;
}

export function assertRequiredPackageFiles(entries: readonly ZipEntry[]): void {
  const paths = new Set(entries.map((entry) => entry.path));
  const missingFiles = REQUIRED_PACKAGE_FILES.filter((file) => !paths.has(file));

  if (missingFiles.length > 0) {
    throw new Error(
      `VSIX is missing required file${missingFiles.length === 1 ? '' : 's'}: ${missingFiles.join(', ')}.`,
    );
  }
}

export function assertPackageContents(entries: readonly ZipEntry[]): void {
  assertRequiredPackageFiles(entries);

  if (entries.length > MAX_PACKAGE_FILES) {
    throw new Error(`VSIX has ${entries.length} files; maximum is ${MAX_PACKAGE_FILES}.`);
  }

  const paths = entries.map((entry) => entry.path);
  const forbidden = paths.filter(
    (path) =>
      FORBIDDEN_PACKAGE_PATHS.some((prefix) => path.startsWith(prefix)) || path.endsWith('.map'),
  );

  if (forbidden.length > 0) {
    throw new Error(`VSIX contains excluded build files: ${forbidden.join(', ')}.`);
  }
}

function destinationForEntry(destination: string, entryPath: string): string {
  const normalizedPath = entryPath.replace(/\\/g, '/');

  if (normalizedPath.startsWith('/') || normalizedPath.split('/').includes('..')) {
    throw new Error(`Invalid VSIX archive: unsafe entry path "${entryPath}".`);
  }

  const destinationRoot = resolve(destination);
  const outputPath = resolve(destinationRoot, ...normalizedPath.split('/'));
  const outputRelativePath = relative(destinationRoot, outputPath);

  if (outputRelativePath === '..' || outputRelativePath.startsWith(`..${sep}`)) {
    throw new Error(`Invalid VSIX archive: unsafe entry path "${entryPath}".`);
  }

  return outputPath;
}

function unzipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const { localHeaderOffset } = entry;

  assertRange(buffer, localHeaderOffset, 30, 'local file header');

  if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Invalid VSIX archive: local header for "${entry.path}" is invalid.`);
  }

  const nameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + nameLength + extraLength;

  assertRange(buffer, dataOffset, entry.compressedSize, `compressed data for "${entry.path}"`);
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  let data: Buffer;

  if (entry.compressionMethod === 0) {
    data = compressedData;
  } else if (entry.compressionMethod === 8) {
    data = inflateRawSync(compressedData);
  } else {
    throw new Error(`Invalid VSIX archive: unsupported compression for "${entry.path}".`);
  }

  if (data.length !== entry.uncompressedSize) {
    throw new Error(`Invalid VSIX archive: uncompressed size mismatch for "${entry.path}".`);
  }

  return data;
}

export function extractZipArchive(
  archive: Buffer,
  entries: readonly ZipEntry[],
  destination: string,
): void {
  for (const entry of entries) {
    const outputPath = destinationForEntry(destination, entry.path);

    if (entry.path.endsWith('/')) {
      mkdirSync(outputPath, { recursive: true });

      continue;
    }

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, unzipEntry(archive, entry));
  }
}

export function smokeTestPackagedBundle(extensionDirectory: string): void {
  const bundlePath = join(extensionDirectory, 'dist', 'extension.js');

  if (!existsSync(bundlePath)) {
    throw new Error('VSIX is missing extension/dist/extension.js.');
  }

  const stubRoot = mkdtempSync(join(tmpdir(), 'devtoolora-vscode-stub-'));

  try {
    const vscodeStubDirectory = join(stubRoot, 'vscode');

    mkdirSync(vscodeStubDirectory, { recursive: true });
    writeFileSync(join(vscodeStubDirectory, 'index.js'), 'module.exports = {};\n');

    const source =
      "const extension=require('./dist/extension.js');const qr=extension.getToolForTests('qr-code-generator');const svg=extension.getToolForTests('svg-optimizer');const schema=extension.getToolForTests('json-schema-validator');for(const tool of [qr,svg,schema]){if(!tool.id||!tool.name)throw new Error('Tool metadata did not load');if('run' in tool)throw new Error('VS Code host exposed executable tool runners')}if(!qr.capabilities.includes('browserWorker'))throw new Error('Browser worker capability missing');";
    const result = spawnSync(process.execPath, ['-e', source], {
      cwd: extensionDirectory,
      encoding: 'utf8',
      env: { ...process.env, NODE_PATH: stubRoot },
    });

    if (result.status !== 0) {
      throw new Error(
        `Packaged extension bundle failed: ${(result.stderr || result.stdout || 'unknown error').trim()}`,
      );
    }
  } finally {
    rmSync(stubRoot, { force: true, recursive: true });
  }
}

export function verifyPackagedVsix(vsixPath: string): PackageVerificationSummary {
  const archive = readFileSync(vsixPath);
  const entries = readZipEntries(archive);

  if (archive.byteLength > MAX_PACKAGE_BYTES) {
    throw new Error(
      `VSIX is ${(archive.byteLength / (1024 * 1024)).toFixed(2)} MB; maximum is ${(MAX_PACKAGE_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
    );
  }

  assertPackageContents(entries);

  const extractionDirectory = mkdtempSync(join(tmpdir(), 'devtoolora-vsix-extract-'));

  try {
    extractZipArchive(archive, entries, extractionDirectory);
    const extensionDirectory = join(extractionDirectory, 'extension');

    smokeTestPackagedBundle(extensionDirectory);
  } finally {
    rmSync(extractionDirectory, { force: true, recursive: true });
  }

  return {
    byteSize: statSync(vsixPath).size,
    entryCount: entries.length,
  };
}

function loadVscePackageApi(projectRoot: string): VscePackageApi {
  const requireFromProject = createRequire(join(projectRoot, 'package.json'));

  return requireFromProject('@vscode/vsce/out/package') as VscePackageApi;
}

export async function createVsix(extensionRoot: string, outputPath: string): Promise<void> {
  await loadVscePackageApi(extensionRoot).pack({
    cwd: extensionRoot,
    dependencies: false,
    packagePath: outputPath,
    prepublish: false,
    useYarn: false,
  });
}

export async function verifyFreshPackage(
  extensionRoot: string,
): Promise<PackageVerificationSummary> {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'devtoolora-package-'));
  const vsixPath = join(temporaryDirectory, 'devtoolora.vsix');

  try {
    await createVsix(extensionRoot, vsixPath);

    return verifyPackagedVsix(vsixPath);
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}
