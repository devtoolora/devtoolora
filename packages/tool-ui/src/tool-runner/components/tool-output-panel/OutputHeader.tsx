import type { ToolResult, ToolResultAction } from '@devtoolora/core';
import { Copy, Download, RotateCw } from 'lucide-react';
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Button } from '../../../ui';
import styles from './ToolOutputPanel.module.scss';

type OutputStatusProps = {
  canRetry: boolean;
  error: string;
  hasResult: boolean;
  isRunning: boolean;
  shouldRevealError?: boolean;
  onRetry(): void;
};

export function OutputStatus({
  canRetry,
  error,
  hasResult,
  isRunning,
  shouldRevealError = false,
  onRetry,
}: OutputStatusProps): ReactElement {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error || !shouldRevealError) return;

    alertRef.current?.scrollIntoView({ block: 'nearest' });
    alertRef.current?.focus();
  }, [error, shouldRevealError]);

  return (
    <>
      {isRunning && !hasResult && (
        <p className={styles.outputPlaceholder} data-testid="output-placeholder" role="status">
          Processing locally…
        </p>
      )}
      {error && (
        <div className={styles.toolError} ref={alertRef} role="alert" tabIndex={-1}>
          <p>{error}</p>
          {canRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              <RotateCw size={14} />
              Retry worker
            </Button>
          )}
        </div>
      )}
      {!isRunning && !error && !hasResult && (
        <p className={styles.outputPlaceholder} data-testid="output-placeholder">
          Your result will appear here.
        </p>
      )}
    </>
  );
}

type OutputHeadingActionsProps = {
  actions?: ReactNode;
  canSaveText: boolean;
  result?: ToolResult;
  resultActions?: ToolResultAction[];
  onCopy(): void;
  onReverse?(): void;
  onSaveText(): void;
};

export function OutputHeadingActions({
  actions,
  canSaveText,
  result,
  resultActions,
  onCopy,
  onReverse,
  onSaveText,
}: OutputHeadingActionsProps): ReactElement {
  return (
    <div className={styles.panelActions} data-testid="panel-actions">
      {result && onReverse && (
        <Button size="sm" variant="secondary" onClick={onReverse}>
          Use result &amp; reverse
        </Button>
      )}
      {result && (!resultActions || resultActions.includes('copy')) && (
        <Button size="sm" variant="ghost" onClick={onCopy}>
          <Copy size={14} />
          Copy
        </Button>
      )}
      {result && canSaveText && (
        <Button size="sm" variant="ghost" onClick={onSaveText}>
          <Download size={14} />
          Save
        </Button>
      )}
      {result && actions}
    </div>
  );
}
