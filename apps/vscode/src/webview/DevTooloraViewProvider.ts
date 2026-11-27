import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import type { SerializedToolDefinition, ToolResult, ToolResultAction } from '@devtoolora/core';
import type { ResultSource } from '../extension/resultActions';
import { tools } from '../extension/toolRegistry';
import type {
  ExtensionToWebviewMessage,
  SidebarTool,
  WebviewToExtensionMessage,
} from './client/types';
import { renderWebviewHtml } from './webviewHtml';

type RecentTool = {
  timestamp: number;
  toolId: string;
};

type NavigationState = {
  activeToolId: string;
  favoriteToolIds: string[];
  recentTools: RecentTool[];
};

const FAVORITES_KEY = 'devToolora.favoriteToolIds';
const ACTIVE_TOOL_KEY = 'devToolora.activeToolId';
const RECENTS_KEY = 'devToolora.recentTools';

export class DevTooloraViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'devToolora.toolbox';
  static readonly editorPanelViewType = 'devToolora.activeTool';

  private view?: vscode.WebviewView;
  private editorPanel?: vscode.WebviewPanel;
  private editorReady = false;
  // A webview drops messages until it has loaded; only the latest one still matters then.
  private pendingEditorMessage?: ExtensionToWebviewMessage;
  private activeToolId: string;
  private favoriteToolIds: string[];
  private recentTools: RecentTool[];
  private resultSource?: ResultSource;
  private resultActionHandler?: (
    action: ToolResultAction,
    result: ToolResult,
    source: ResultSource | undefined,
  ) => Promise<void>;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly globalState: vscode.Memento,
  ) {
    const validToolIds = new Set(tools.map((tool) => tool.id));

    this.activeToolId = normalizeToolId(globalState.get<string>(ACTIVE_TOOL_KEY), validToolIds);
    this.favoriteToolIds = normalizeToolIds(globalState.get<string[]>(FAVORITES_KEY), validToolIds);

    this.recentTools = normalizeRecentTools(
      globalState.get<RecentTool[]>(RECENTS_KEY),
      validToolIds,
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview, 'sidebar', this.activeToolId);
    this.bindWebviewMessages(webviewView.webview);
  }

  async openActiveTool(
    toolId = this.activeToolId,
    { keepSource = false, source }: { keepSource?: boolean; source?: ResultSource } = {},
  ): Promise<void> {
    // A tool opened without editor input must never write into an earlier command's selection.
    if (!keepSource) this.resultSource = source;

    await this.setActiveTool(toolId ?? tools[0]?.id);
    const activeTool = this.getActiveTool();

    if (!activeTool) {
      return;
    }

    if (this.editorPanel) {
      this.editorPanel.reveal();
      this.editorPanel.title = activeTool.name;
      await this.postToEditor({ type: 'setActiveTool', toolId: activeTool.id });

      return;
    }

    this.createEditorPanel(activeTool);
  }

  async openToolWithInput(
    toolId: string,
    text: string,
    source: ResultSource | undefined,
  ): Promise<void> {
    const tool = tools.find((candidate) => candidate.id === toolId);

    if (!tool) {
      return;
    }

    this.resultSource = source;

    await this.setActiveTool(tool.id);

    if (this.editorPanel) {
      this.editorPanel.reveal();
      this.editorPanel.title = tool.name;
      await this.postToEditor({ type: 'setToolContext', toolId: tool.id, text });

      return;
    }

    this.createEditorPanel(tool, text);
  }

  private createEditorPanel(tool: SerializedToolDefinition, text?: string): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      DevTooloraViewProvider.editorPanelViewType,
      tool.name,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
        retainContextWhenHidden: true,
      },
    );

    this.editorPanel = panel;
    this.editorReady = false;
    this.pendingEditorMessage = undefined;
    panel.webview.html = this.getHtml(panel.webview, 'editor', tool.id, text);

    this.bindWebviewMessages(panel.webview, async () => {
      if (this.editorPanel !== panel) return;

      this.editorReady = true;

      const pending = this.pendingEditorMessage;

      this.pendingEditorMessage = undefined;
      if (pending) await panel.webview.postMessage(pending);
    });

    panel.onDidDispose(() => {
      if (this.editorPanel === panel) this.editorPanel = undefined;
    });

    return panel;
  }

  private async postToEditor(message: ExtensionToWebviewMessage): Promise<void> {
    if (this.editorReady) await this.editorPanel?.webview.postMessage(message);
    else this.pendingEditorMessage = message;
  }

  onResultAction(
    handler: (
      action: ToolResultAction,
      result: ToolResult,
      source: ResultSource | undefined,
    ) => Promise<void>,
  ): void {
    this.resultActionHandler = handler;
  }

  private bindWebviewMessages(webview: vscode.Webview, onReady?: () => Promise<void>): void {
    webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      if (message.type === 'resultAction') {
        try {
          await this.resultActionHandler?.(message.action, message.result, this.resultSource);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);

          void vscode.window.showErrorMessage(`Dev Toolora: ${reason}`);
        }

        return;
      }

      if (message.type === 'webviewReady') {
        await onReady?.();
        await this.postNavigationState();

        return;
      }

      if (message.type === 'openTool') {
        await this.recordRecentTool(message.toolId);
        await this.openActiveTool(message.toolId, { keepSource: message.keepSource === true });

        return;
      }

      if (message.type === 'toggleFavorite') {
        await this.toggleFavorite(message.toolId);
      }
    });
  }

  private async recordRecentTool(toolId: string): Promise<void> {
    const canonicalId = tools.find((tool) => tool.id === toolId)?.aliasOf ?? toolId;

    if (!tools.some((tool) => tool.id === canonicalId)) {
      return;
    }

    const updated = [
      { timestamp: Date.now(), toolId: canonicalId },
      ...this.recentTools.filter((item) => item.toolId !== canonicalId),
    ].slice(0, 15);

    this.recentTools = updated;
    await this.globalState.update(RECENTS_KEY, updated);
    await this.postNavigationState();
  }

  private async setActiveTool(toolId: string | undefined): Promise<void> {
    const tool = tools.find((candidate) => candidate.id === toolId) ?? tools[0];

    if (!tool) {
      return;
    }

    const hasChanged = tool.id !== this.activeToolId;

    this.activeToolId = tool.id;
    await this.globalState.update(ACTIVE_TOOL_KEY, this.activeToolId);

    if (this.editorPanel) {
      this.editorPanel.title = tool.name;
    }

    if (hasChanged) {
      await this.postToWebviews({ type: 'setActiveTool', toolId: tool.id });
    }

    await this.postNavigationState();
  }

  private getActiveTool() {
    return tools.find((tool) => tool.id === this.activeToolId) ?? tools[0];
  }

  private async postToWebviews(message: unknown): Promise<void> {
    await this.view?.webview.postMessage(message);
    await this.editorPanel?.webview.postMessage(message);
  }

  private getNavigationState(): NavigationState {
    return {
      activeToolId: this.activeToolId,
      favoriteToolIds: this.favoriteToolIds,
      recentTools: this.recentTools,
    };
  }

  private async postNavigationState(): Promise<void> {
    await this.postToWebviews({ type: 'navigationState', state: this.getNavigationState() });
  }

  private async toggleFavorite(toolId: string): Promise<void> {
    if (!tools.some((tool) => tool.id === toolId)) {
      return;
    }

    toolId = tools.find((tool) => tool.id === toolId)?.aliasOf ?? toolId;

    this.favoriteToolIds = normalizeToolIds(
      this.favoriteToolIds,
      new Set(tools.map((tool) => tool.id)),
    );

    this.favoriteToolIds = this.favoriteToolIds.includes(toolId)
      ? this.favoriteToolIds.filter((id) => id !== toolId)
      : [...this.favoriteToolIds, toolId];

    await this.globalState.update(FAVORITES_KEY, this.favoriteToolIds);
    await this.postNavigationState();
  }

  private getHtml(
    webview: vscode.Webview,
    mode: 'sidebar' | 'editor',
    initialActiveToolId?: string,
    initialInputText?: string,
  ): string {
    const nonce = getNonce();
    const toolData = JSON.stringify(mode === 'sidebar' ? tools.map(toSidebarTool) : tools);
    const workerUri = webview
      .asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'worker.js'),
      )
      .toString();
    const appConfig = JSON.stringify({
      mode,
      initialActiveToolId,
      initialInputText,
      workerUri,
    });

    return renderWebviewHtml({
      appConfig,
      extensionUri: this.extensionUri,
      webview,
      nonce,
      toolData,
    });
  }
}

function normalizeToolIds(toolIds: string[] | undefined, validToolIds: Set<string>): string[] {
  return Array.from(
    new Set(
      (toolIds ?? [])
        .filter((toolId) => validToolIds.has(toolId))
        .map((toolId) => tools.find((tool) => tool.id === toolId)?.aliasOf ?? toolId),
    ),
  );
}

function normalizeToolId(toolId: string | undefined, validToolIds: Set<string>): string {
  return toolId && validToolIds.has(toolId) ? toolId : (tools[0]?.id ?? '');
}

function normalizeRecentTools(
  items: RecentTool[] | undefined,
  validToolIds: Set<string>,
): RecentTool[] {
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const result: RecentTool[] = [];

  for (const item of items) {
    if (!item || typeof item.toolId !== 'string' || typeof item.timestamp !== 'number') continue;

    const canonicalId = tools.find((t) => t.id === item.toolId)?.aliasOf ?? item.toolId;

    if (!validToolIds.has(canonicalId) || seen.has(canonicalId)) continue;

    seen.add(canonicalId);
    result.push({ timestamp: item.timestamp, toolId: canonicalId });
  }

  return result.slice(0, 15);
}

function toSidebarTool({
  aliasOf,
  badge,
  category,
  description,
  id,
  keywords,
  name,
}: SerializedToolDefinition): SidebarTool {
  return { aliasOf, badge, category, description, id, keywords, name };
}

function getNonce(): string {
  return randomBytes(16).toString('base64url');
}
