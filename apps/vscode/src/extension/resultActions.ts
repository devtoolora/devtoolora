import * as vscode from 'vscode';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ToolResult, ToolResultAction } from '@devtoolora/core';

export type ResultSource = {
  selection: vscode.Selection;
  uri: vscode.Uri;
  version: number;
};

export async function applyResult(
  action: ToolResultAction,
  result: ToolResult,
  source: ResultSource | undefined,
): Promise<void> {
  switch (action) {
    case 'replace':
      await replaceSelection(result.text, source);

      break;
    case 'insert':
      await insertAtCursor(result.text, source);

      break;
    case 'copy':
      await vscode.env.clipboard.writeText(result.text);
      vscode.window.showInformationMessage('Result copied.');

      break;
    case 'scratch':
      await openScratch(result);

      break;
    case 'save':
      await saveResultArtifact(result, source);

      break;
  }
}

export function getSelectedText(): string {
  const editor = vscode.window.activeTextEditor;

  if (!editor || editor.selection.isEmpty) {
    return '';
  }

  return editor.document.getText(editor.selection);
}

// Captured when a tool opens: once its webview panel has focus, VS Code reports no active editor.
export function getResultSource(): ResultSource | undefined {
  const editor = vscode.window.activeTextEditor;

  return (
    editor && {
      selection: editor.selection,
      uri: editor.document.uri,
      version: editor.document.version,
    }
  );
}

export async function openScratch(result: Pick<ToolResult, 'text' | 'language'>): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content: result.text,
    language: result.language ?? 'plaintext',
  });

  await vscode.window.showTextDocument(document, { preview: false });
}

// Any edit since the tool opened can move the selection, so only an unchanged document is edited.
function isSourceUnchanged(source: ResultSource | undefined): source is ResultSource {
  return vscode.workspace.textDocuments.some(
    (document) =>
      !document.isClosed &&
      document.uri.toString() === source?.uri.toString() &&
      document.version === source.version,
  );
}

async function applyOrScratch(edit: vscode.WorkspaceEdit, text: string): Promise<void> {
  if (!(await vscode.workspace.applyEdit(edit))) await openScratch({ text });
}

async function replaceSelection(text: string, source: ResultSource | undefined): Promise<void> {
  if (!isSourceUnchanged(source)) {
    await openScratch({ text });

    return;
  }

  const edit = new vscode.WorkspaceEdit();

  edit.replace(source.uri, source.selection, text);
  await applyOrScratch(edit, text);
}

async function insertAtCursor(text: string, source: ResultSource | undefined): Promise<void> {
  if (!isSourceUnchanged(source)) {
    await openScratch({ text });

    return;
  }

  const edit = new vscode.WorkspaceEdit();

  edit.insert(source.uri, source.selection.active, text);
  await applyOrScratch(edit, text);
}

function defaultSaveUri(fileName: string, source: ResultSource | undefined): vscode.Uri {
  if (source?.uri.scheme === 'file') return vscode.Uri.joinPath(source.uri, '..', fileName);

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;

  return workspaceFolder
    ? vscode.Uri.joinPath(workspaceFolder, fileName)
    : vscode.Uri.file(join(homedir(), fileName));
}

async function saveResultArtifact(
  result: ToolResult,
  source: ResultSource | undefined,
): Promise<void> {
  const artifact = result.artifact ?? result.artifacts?.[0];
  const target = await vscode.window.showSaveDialog({
    defaultUri: defaultSaveUri(artifact?.fileName ?? 'devtoolora-result.txt', source),
    saveLabel: 'Save result',
  });

  if (!target) {
    return;
  }

  const bytes = artifact
    ? Buffer.from(artifact.base64, 'base64')
    : Buffer.from(result.text, 'utf8');

  await vscode.workspace.fs.writeFile(target, bytes);
  vscode.window.showInformationMessage(`Saved ${target.fsPath}.`);
}
