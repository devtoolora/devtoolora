import * as vscode from 'vscode';
import { openScratch } from './resultActions';

function targetFiles(
  uri: vscode.Uri | undefined,
  selected: vscode.Uri[] | undefined,
): vscode.Uri[] {
  if (selected && selected.length > 0) return selected;

  return uri ? [uri] : [];
}

export async function base64EncodeFiles(
  uri: vscode.Uri | undefined,
  selected: vscode.Uri[] | undefined,
): Promise<void> {
  const uris = targetFiles(uri, selected);

  if (uris.length === 0) {
    vscode.window.showWarningMessage('Select a file to Base64 encode.');

    return;
  }

  for (const file of uris) {
    const bytes = await vscode.workspace.fs.readFile(file);

    await openScratch({ language: 'plaintext', text: Buffer.from(bytes).toString('base64') });
  }
}
