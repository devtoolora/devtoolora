import * as vscode from 'vscode';
import type { SerializedToolDefinition, ToolResultAction } from '@devtoolora/core';
import { tools } from './toolRegistry';
import { getSelectedText } from './resultActions';
import { buildContextToolPickerEntries } from './contextToolPicker';

export async function runToolInteractive(
  preferredAction: ToolResultAction | undefined,
  openToolWithInput: (toolId: string, text: string) => Promise<void>,
  openActiveTool: (toolId: string) => Promise<void>,
): Promise<void> {
  const candidates = tools.filter(
    (tool) => !tool.aliasOf && (preferredAction !== 'replace' || tool.supportsSelection),
  );
  const picked = await vscode.window.showQuickPick(
    candidates.map((tool) => ({
      label: tool.name,
      description: tool.category,
      detail: tool.description,
      tool,
    })),
    { title: 'Dev Toolora: Run Tool', matchOnDescription: true, matchOnDetail: true },
  );

  if (!picked) {
    return;
  }

  const text = getSelectedText();

  // Without a selection the tool keeps its saved draft instead of an empty input.
  await (text ? openToolWithInput(picked.tool.id, text) : openActiveTool(picked.tool.id));
}

export async function suggestToolsForSelection(
  openToolWithInput: (toolId: string, text: string) => Promise<void>,
): Promise<void> {
  const selectionText = getSelectedText();

  if (!selectionText) {
    return;
  }

  type PickerItem = vscode.QuickPickItem & { tool?: SerializedToolDefinition };
  const entries = buildContextToolPickerEntries(
    selectionText,
    tools.filter((tool) => tool.supportsSelection),
  );
  const items: PickerItem[] = entries.map((entry) =>
    entry.kind === 'separator'
      ? { label: entry.label, kind: vscode.QuickPickItemKind.Separator }
      : {
          label: entry.tool.name,
          description: entry.description,
          detail: entry.tool.description,
          tool: entry.tool,
        },
  );
  const picked = await vscode.window.showQuickPick(items, {
    title: 'Dev Toolora: Suggest Tools for Selection',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  if (picked?.tool) {
    await openToolWithInput(picked.tool.id, selectionText);
  }
}
