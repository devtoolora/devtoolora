import type { ToolResult } from '@devtoolora/core';
import { useEffect, useState } from 'react';
import type { SavedToolFile, ToolPlatformActions } from '../../types';
import { base64Bytes, downloadFile, textFileName } from './outputDownloads';

export type ToolArtifact = NonNullable<ToolResult['artifact']>;

export type OutputActions = {
  copyStatus: string;
  handleArtifactDownload(artifact: ToolArtifact): void;
  handleCopy(): Promise<void>;
  handleCopyTreeText(text: string): Promise<void>;
  handleSaveText(): void;
  saveStatus: string;
};

export async function copyWithFallback(
  platformActions: ToolPlatformActions | undefined,
  text: string,
): Promise<void> {
  const copied = await platformActions?.copyText(text).then(
    () => true,
    () => false,
  );

  if (!copied) await navigator.clipboard.writeText(text);
}

async function saveNative(platformActions: ToolPlatformActions, file: SavedToolFile) {
  try {
    const saved = await platformActions.saveFile(file);

    return saved ? `Saved ${file.fileName}.` : '';
  } catch {
    downloadFile(file);

    return `Native save failed; downloaded ${file.fileName} instead.`;
  }
}

export function useOutputActions(
  freshResult: ToolResult | undefined,
  platformActions: ToolPlatformActions | undefined,
  toolName: string,
): OutputActions {
  const [copyStatus, setCopyStatus] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => setCopyStatus(''), [freshResult?.text]);
  useEffect(() => setSaveStatus(''), [freshResult]);

  const handleCopy = async () => {
    if (!freshResult) return;

    try {
      await copyWithFallback(platformActions, freshResult.text);
      setCopyStatus('Copied.');
    } catch {
      setCopyStatus('Copy failed.');
    }
  };

  const save = (file: SavedToolFile) => {
    if (platformActions) void saveNative(platformActions, file).then(setSaveStatus);
    else downloadFile(file);
  };

  const handleSaveText = () => {
    if (!freshResult) return;

    save({
      bytes: new TextEncoder().encode(freshResult.text),
      fileName: textFileName(toolName, freshResult),
      mimeType: 'text/plain;charset=utf-8',
    });
  };

  const handleArtifactDownload = (artifact: ToolArtifact) =>
    save({
      bytes: base64Bytes(artifact.base64),
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
    });

  return {
    copyStatus,
    handleArtifactDownload,
    handleCopy,
    handleCopyTreeText: (text) => copyWithFallback(platformActions, text),
    handleSaveText,
    saveStatus,
  };
}
