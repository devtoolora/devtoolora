import type { ToolField } from '@devtoolora/core';

export type PickedToolFile = {
  data: string;
  name: string;
};

export type SavedToolFile = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

export type FileToolField = ToolField & { type: 'file' };

export type ToolPanelDensity = 'comfortable' | 'compact';

export type ToolPlatformActions = {
  copyText(text: string): Promise<void>;
  pickFiles?(field: FileToolField): Promise<PickedToolFile[] | undefined>;
  saveFile(file: SavedToolFile): Promise<boolean>;
};
