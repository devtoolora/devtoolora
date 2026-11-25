import type {
  JsonTreeNode,
  ToolResult as CoreToolResult,
  ToolResultAction,
} from '@devtoolora/core';

type ToolResult = {
  artifact?: {
    base64: string;
    fileName: string;
    mimeType: string;
  };
  artifacts?: Array<{
    base64: string;
    fileName: string;
    mimeType: string;
  }>;
  asciiArt?: CoreToolResult['asciiArt'];
  batch?: {
    failed: Array<{ message: string; name: string }>;
    succeeded: number;
    total: number;
  };
  htmlPreview?: CoreToolResult['htmlPreview'];
  jsonDiff?: CoreToolResult['jsonDiff'];
  jsonTable?: CoreToolResult['jsonTable'];
  jsonTree?: { expandedLevels?: number; nodes: JsonTreeNode[] };
  language?: string;
  noWrap?: CoreToolResult['noWrap'];
  previewDataUri?: string;
  regex?: CoreToolResult['regex'];
  resultActions?: ToolResultAction[];
  summary?: string;
  text: string;
  textDiff?: CoreToolResult['textDiff'];
};

type WebviewMode = 'sidebar' | 'editor';

export type WebviewConfig = {
  initialActiveToolId?: string;
  initialInputText?: string;
  mode?: WebviewMode;
  workerUri?: string;
};

type RecentTool = {
  timestamp: number;
  toolId: string;
};

export type NavigationState = {
  activeToolId: string;
  favoriteToolIds: string[];
  recentTools: RecentTool[];
};

export type ToolDraft = {
  fields: Record<string, string>;
  input: string;
};

export type WebviewState = {
  activeToolId?: string;
  collapsedCategories?: string[];
  editorSplitPercent?: number;
  favoriteToolIds?: string[];
  isToolInfoOpen?: boolean;
  recentTools?: RecentTool[];
  toolDrafts?: Record<string, ToolDraft>;
};

export type WebviewToExtensionMessage =
  | { action: ToolResultAction; result: ToolResult; type: 'resultAction' }
  | { keepSource?: true; toolId: string; type: 'openTool' }
  | { toolId: string; type: 'toggleFavorite' }
  | { type: 'webviewReady' };

export type ExtensionToWebviewMessage =
  | { toolId: string; type: 'setActiveTool' }
  | { text: string; toolId: string; type: 'setToolContext' }
  | { state: NavigationState; type: 'navigationState' };

export type VscodeApi = {
  getState(): WebviewState | undefined;
  postMessage(message: WebviewToExtensionMessage): void;
  setState(state: WebviewState): void;
};
