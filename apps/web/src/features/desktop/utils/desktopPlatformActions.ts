import { isTauri } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, stat, writeFile } from '@tauri-apps/plugin-fs';
import type { FileToolField, ToolPlatformActions } from '@devtoolora/tool-ui';
import { extensionsForAccept, mimeTypeForFile } from './desktopFileTypes';

function base64(bytes: Uint8Array): string {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || 'file';
}

async function pickFiles(field: FileToolField) {
  const extensions = extensionsForAccept(field.accept);
  const selected = await open({
    multiple: Boolean(field.multiple),
    filters: extensions.length ? [{ name: field.label, extensions }] : undefined,
  });

  if (!selected) return undefined;

  const paths = Array.isArray(selected) ? selected : [selected];

  return Promise.all(
    paths.map(async (path) => {
      const name = fileName(path);

      if (field.maxBytes && (await stat(path)).size > field.maxBytes)
        throw new Error(`File must be at most ${field.maxBytes / 1024 / 1024} MiB.`);

      const bytes = await readFile(path);

      if (field.maxBytes && bytes.length > field.maxBytes)
        throw new Error(`File must be at most ${field.maxBytes / 1024 / 1024} MiB.`);

      return { name, data: `data:${mimeTypeForFile(name, field.accept)};base64,${base64(bytes)}` };
    }),
  );
}

export const desktopPlatformActions: ToolPlatformActions | undefined = isTauri()
  ? {
      pickFiles,
      async saveFile(file) {
        const extension = file.fileName.split('.').pop();
        const path = await save({
          defaultPath: file.fileName,
          filters: extension ? [{ name: file.mimeType, extensions: [extension] }] : undefined,
        });

        if (!path) return false;

        await writeFile(path, file.bytes);

        return true;
      },
      copyText: writeText,
    }
  : undefined;
