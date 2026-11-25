import type { ToolResult, ToolResultAction } from '@devtoolora/core';
import { type ReactNode, type Ref } from 'react';
import type { ToolPanelDensity, ToolPlatformActions } from '../../types';

export type ToolOutputPanelProps = {
  actions?: ReactNode;
  canRetry: boolean;
  density?: ToolPanelDensity;
  error: string;
  footer?: ReactNode;
  isRunning: boolean;
  isStale?: boolean;
  outputGutter?: ReactNode;
  outputLabel?: string;
  outputRef?: Ref<HTMLPreElement>;
  platformActions?: ToolPlatformActions;
  result?: ToolResult;
  resultActions?: ToolResultAction[];
  /** Scrolls a new error into view and focuses it; set after a manual run, never an auto-run. */
  shouldRevealError?: boolean;
  toolName: string;
  visualPreview?: ReactNode;
  onRetry(): void;
  onReverse?(): void;
};
