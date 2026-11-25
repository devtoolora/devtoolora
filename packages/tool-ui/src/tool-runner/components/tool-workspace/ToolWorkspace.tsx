import type { SerializedToolDefinition } from '@devtoolora/core';
import { RotateCw } from 'lucide-react';
import { useEffect, useEffectEvent, type ReactElement, type ReactNode } from 'react';
import { Button } from '../../../ui';
import { ToolInputPanel } from '../tool-input-panel';
import { ToolOutputPanel } from '../tool-output-panel';
import { RuntimeStatus } from '../runtime-status';
import type { ToolPlatformActions } from '../../types';
import type { ToolRunnerHost } from '../../hooks/useToolRunner';
import type { RuntimeWorkerState } from '../../hooks/useRuntimeWorker';
import { runtimeDownloadNote } from '../../hooks/runtimeDownloadNote';
import { useToolWorkspace, type ToolWorkspaceState } from '../../hooks/useToolWorkspace';
import { hasShareableSettings, settingsFromSearch, settingsLink } from './settingsLink';
import styles from './ToolWorkspace.module.scss';

type ToolWorkspaceSurface = 'desktop' | 'page';

export type ToolWorkspaceProps = {
  backLink?: ReactNode;
  host: ToolRunnerHost;
  initialDefinition?: SerializedToolDefinition;
  metadataId: string;
  platformActions?: ToolPlatformActions;
  shareSettings?: boolean;
  /** `desktop` fills the desktop app's tool stage and follows its glass surface. */
  surface?: ToolWorkspaceSurface;
  onDefinitionLoad(tool?: SerializedToolDefinition): void;
};

const rootClasses: Record<ToolWorkspaceSurface, string> = {
  desktop: `${styles.workspace} ${styles.desktop} tool-workspace`,
  page: `${styles.workspace} tool-workspace`,
};

type WorkspaceFallbackProps = Pick<ToolWorkspaceProps, 'backLink'> & {
  runner: ToolWorkspaceState['runner'];
  tool?: SerializedToolDefinition;
};

function WorkspaceFallback({ backLink, runner, tool }: WorkspaceFallbackProps): ReactElement {
  if (runner.runtime.status === 'unavailable') {
    return (
      <div className={styles.runtimeUnavailable}>
        <RuntimeStatus message={runner.runtime.message} variant="error" />
      </div>
    );
  }

  if (runner.definitionStatus === 'loading' && !tool) {
    return <div className={styles.workspaceLoading}>Loading local tool…</div>;
  }

  return (
    <div className={styles.workspaceFailure} role="alert">
      <p className={styles.eyebrow}>Worker unavailable</p>
      <h2>{tool ? 'The local worker stopped.' : 'This tool could not be loaded.'}</h2>
      <p>
        {runner.definitionError ||
          'The browser worker catalog does not contain this tool definition.'}
      </p>
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" onClick={runner.retryWorker}>
          <RotateCw size={15} />
          Retry
        </Button>
        {backLink}
      </div>
    </div>
  );
}

type RuntimeNoticeProps = {
  host: ToolRunnerHost;
  state: RuntimeWorkerState;
  tool: SerializedToolDefinition;
};

function RuntimeNotice({ host, state, tool }: RuntimeNoticeProps): ReactElement | null {
  const { runtime } = tool;

  if (!runtime) return null;

  return (
    <>
      {host.runtimeSource === 'download' && (
        <p className={styles.runtimeNote}>{runtimeDownloadNote(runtime)}</p>
      )}

      {state.status === 'loading' && (
        <RuntimeStatus progress={state.progress} runtime={runtime} variant="loading" />
      )}
    </>
  );
}

async function copySettingsLink(
  tool: SerializedToolDefinition,
  fields: Record<string, string>,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(settingsLink(tool, fields, window.location.href));

    return true;
  } catch {
    return false;
  }
}

export function ToolWorkspace({
  backLink,
  host,
  initialDefinition,
  metadataId,
  platformActions,
  shareSettings = false,
  surface = 'page',
  onDefinitionLoad,
}: ToolWorkspaceProps): ReactElement {
  const workspace = useToolWorkspace({ host, initialDefinition, metadataId, platformActions });
  const { inputs, runner, tool } = workspace;

  useEffect(() => onDefinitionLoad(tool), [onDefinitionLoad, tool]);

  // Once per tool id, not again when the worker swaps in its own definition.
  const applySharedSettings = useEffectEvent(() => {
    if (!shareSettings || !tool) return;

    for (const [fieldId, value] of Object.entries(settingsFromSearch(tool, window.location.search)))
      inputs.onFieldChange(fieldId, value);
  });

  useEffect(() => applySharedSettings(), [shareSettings, tool?.id]);

  if (runner.definitionStatus === 'error' || runner.runtime.status === 'unavailable' || !tool)
    return <WorkspaceFallback backLink={backLink} runner={runner} tool={tool} />;

  return (
    <div className={rootClasses[surface]} onKeyDown={workspace.handleKeyDown}>
      <ToolInputPanel
        canRun={workspace.canRun}
        fields={inputs.fields}
        isRunning={runner.isRunning}
        notice={<RuntimeNotice host={host} state={runner.runtime} tool={tool} />}
        platformActions={platformActions}
        text={inputs.text}
        tool={tool}
        onClear={workspace.handleClear}
        onCopySettingsLink={
          shareSettings && hasShareableSettings(tool)
            ? () => copySettingsLink(tool, inputs.fields)
            : undefined
        }
        onFieldChange={inputs.onFieldChange}
        onRun={workspace.handleRun}
        onSampleApply={inputs.onSampleApply}
        onTextChange={inputs.onTextChange}
      />

      <ToolOutputPanel
        canRetry={runner.canRetry}
        error={runner.error}
        isRunning={runner.isRunning}
        isStale={workspace.isStale}
        outputLabel={workspace.outputLabel}
        platformActions={platformActions}
        result={runner.result}
        resultActions={runner.result?.resultActions ?? tool.resultActions}
        shouldRevealError={workspace.shouldRevealError}
        toolName={tool.name}
        visualPreview={workspace.visualPreview}
        onRetry={runner.retryWorker}
        onReverse={workspace.handleReverse}
      />
    </div>
  );
}
