import * as vscode from 'vscode';
import type { SerializedToolDefinition } from '@devtoolora/core';
import { DevTooloraViewProvider } from './webview/DevTooloraViewProvider';
import { getTool } from './extension/toolRegistry';
import { base64EncodeFiles } from './extension/fileEncoding';
import { runToolInteractive, suggestToolsForSelection } from './extension/interactiveRunner';
import { applyResult, getResultSource } from './extension/resultActions';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new DevTooloraViewProvider(context.extensionUri, context.globalState);
  const openToolWithInput = (toolId: string, text: string): Promise<void> =>
    provider.openToolWithInput(toolId, text, getResultSource());
  const openActiveTool = (toolId: string): Promise<void> =>
    provider.openActiveTool(toolId, { source: getResultSource() });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DevTooloraViewProvider.viewType, provider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devToolora.openToolbox', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.devToolora');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devToolora.runTool', async () => {
      await runToolInteractive(undefined, openToolWithInput, openActiveTool);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devToolora.openActiveTool', async () => {
      await provider.openActiveTool();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devToolora.transformSelection', async () => {
      await runToolInteractive('replace', openToolWithInput, openActiveTool);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devToolora.suggestToolsForSelection', async () => {
      await suggestToolsForSelection(openToolWithInput);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'devToolora.base64EncodeFile',
      async (uri?: vscode.Uri, selected?: vscode.Uri[]) => {
        await base64EncodeFiles(uri, selected);
      },
    ),
  );

  provider.onResultAction(applyResult);
}

export function getToolForTests(id: string): SerializedToolDefinition {
  return getTool(id);
}
