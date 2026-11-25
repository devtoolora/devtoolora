import type { SerializedToolDefinition } from '@devtoolora/core';
import {
  RuntimeStatus,
  ToolInputPanel,
  ToolOutputPanel,
  useToolWorkspace,
  type ToolInputSeed,
  type ToolRunnerHost,
  type ToolWorkspaceState,
} from '@devtoolora/tool-ui';
import { type ReactElement, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { ContextTools } from '../context-tools';
import { HelpTabs } from '../help-tabs';
import { LineGutter } from '../line-gutter';
import { RelatedTools } from '../related-tools';
import { ResultActions } from '../result-actions';
import { SplitPane } from '../split-pane';
import { ToolHeader } from '../tool-header';
import styles from './EditorWorkspace.module.scss';
import { RunnerStatus } from '../runner-status';
import { draftFromInputs } from '../../utils/state';
import type { ToolDraft } from '../../types';
import type { WebviewStateHandle } from '../../hooks/useWebviewState';
import { getVscode } from '../../host/vscodeHost';
import { vscodePlatformActions } from '../../host/vscodePlatformActions';

type EditorWorkspaceProps = {
  host: ToolRunnerHost;
  initialInput?: ToolInputSeed;
  state: WebviewStateHandle;
  tool: SerializedToolDefinition;
  tools: SerializedToolDefinition[];
  onSelectTool(toolId: string, text?: string): void;
};

function draftSeed(toolId: string, draft: ToolDraft | undefined): ToolInputSeed {
  return { fields: draft?.fields, key: `draft:${toolId}`, text: draft?.input };
}

type EditorOutputProps = {
  outputRef: RefObject<HTMLPreElement | null>;
  runnerTool: SerializedToolDefinition;
  toolId: string;
  tools: SerializedToolDefinition[];
  workspace: ToolWorkspaceState;
  onSelectTool(toolId: string, text?: string): void;
};

type EditorInputProps = {
  contextText: string;
  runnerTool: SerializedToolDefinition;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  tools: SerializedToolDefinition[];
  workspace: ToolWorkspaceState;
  onSelectTool(toolId: string, text?: string): void;
  onTextChange(value: string): void;
};

function useRunShortcut(handleRun: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        handleRun();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);
}

function EditorOutput({
  outputRef,
  runnerTool,
  toolId,
  tools,
  workspace,
  onSelectTool,
}: EditorOutputProps): ReactElement {
  const { runner } = workspace;
  const result = runner.result;

  return (
    <ToolOutputPanel
      actions={
        result && (
          <ResultActions
            actions={
              result.resultActions ??
              runnerTool.resultActions ?? ['replace', 'insert', 'copy', 'scratch']
            }
            result={result}
          />
        )
      }
      canRetry={runner.canRetry}
      density="compact"
      error={runner.error}
      footer={
        result && (
          <ContextTools
            activeToolId={toolId}
            intro="Continue with result: "
            label="Continue with result"
            text={result.text}
            tools={tools}
            onSelectTool={onSelectTool}
          />
        )
      }
      isRunning={runner.isRunning}
      isStale={workspace.isStale}
      outputGutter={
        result && <LineGutter scrollRef={outputRef} text={result.text} variant="output" />
      }
      outputLabel={workspace.outputLabel}
      outputRef={outputRef}
      platformActions={vscodePlatformActions}
      result={result}
      resultActions={result?.resultActions ?? runnerTool.resultActions}
      shouldRevealError={workspace.shouldRevealError}
      toolName={runnerTool.name}
      visualPreview={workspace.visualPreview}
      onRetry={runner.retryWorker}
      onReverse={workspace.handleReverse}
    />
  );
}

function EditorInput({
  contextText,
  runnerTool,
  textareaRef,
  tools,
  workspace,
  onSelectTool,
  onTextChange,
}: EditorInputProps): ReactElement {
  const { inputs, runner } = workspace;

  return (
    <ToolInputPanel
      canRun={workspace.canRun}
      density="compact"
      fields={inputs.fields}
      inputGutter={<LineGutter scrollRef={textareaRef} text={inputs.text} variant="input" />}
      isRunning={runner.isRunning}
      notice={
        <>
          {runner.runtime.status === 'loading' && runnerTool.runtime && (
            <RuntimeStatus
              progress={runner.runtime.progress}
              runtime={runnerTool.runtime}
              variant="loading"
            />
          )}

          {contextText && (
            <ContextTools
              label="Suggested actions"
              text={contextText}
              tools={tools}
              onSelectTool={onSelectTool}
            />
          )}
        </>
      }
      platformActions={vscodePlatformActions}
      text={inputs.text}
      textareaRef={textareaRef}
      tool={runnerTool}
      onClear={workspace.handleClear}
      onFieldChange={inputs.onFieldChange}
      onRun={workspace.handleRun}
      onSampleApply={inputs.onSampleApply}
      onTextChange={onTextChange}
    />
  );
}

type DraftedToolWorkspaceOptions = Pick<
  EditorWorkspaceProps,
  'host' | 'initialInput' | 'state' | 'tool'
>;

function useDraftedToolWorkspace({
  host,
  initialInput,
  state,
  tool,
}: DraftedToolWorkspaceOptions): ToolWorkspaceState {
  const { saveDraft } = state;
  const onInputsChange = useCallback(
    (text: string, fields: Record<string, string>) =>
      saveDraft(tool.id, draftFromInputs(tool, text, fields)),
    [saveDraft, tool],
  );

  return useToolWorkspace({
    host,
    initialInput: initialInput ?? draftSeed(tool.id, state.drafts[tool.id]),
    metadataId: tool.id,
    platformActions: vscodePlatformActions,
    onInputsChange,
  });
}

function useSeedSuggestion(
  initialInput: ToolInputSeed | undefined,
  onTextChange: (value: string) => void,
) {
  const [dismissedSeedKey, setDismissedSeedKey] = useState<string>();
  const contextText =
    initialInput?.text && dismissedSeedKey !== initialInput.key ? initialInput.text : '';

  const handleTextChange = (value: string) => {
    setDismissedSeedKey(initialInput?.key);
    onTextChange(value);
  };

  return { contextText, handleTextChange };
}

export function EditorWorkspace({
  host,
  initialInput,
  state,
  tool,
  tools,
  onSelectTool,
}: EditorWorkspaceProps): ReactElement {
  const workspace = useDraftedToolWorkspace({ host, initialInput, state, tool });
  const { handleRun, inputs, runner } = workspace;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const { contextText, handleTextChange } = useSeedSuggestion(initialInput, inputs.onTextChange);

  useRunShortcut(handleRun);

  const runnerTool = workspace.tool;

  const handleFavoriteToggle = () =>
    getVscode().postMessage({ toolId: tool.id, type: 'toggleFavorite' });

  return (
    <main className={styles.workspace} onKeyDown={workspace.handleKeyDown}>
      <ToolHeader
        isFavorite={state.favoriteToolIds.has(tool.aliasOf ?? tool.id)}
        tool={tool}
        onToggleFavorite={handleFavoriteToggle}
      />
      <RunnerStatus hasTool={Boolean(runnerTool)} runner={runner} />
      {runnerTool &&
        runner.definitionStatus === 'ready' &&
        runner.runtime.status !== 'unavailable' && (
          <SplitPane
            end={
              <EditorOutput
                outputRef={outputRef}
                runnerTool={runnerTool}
                toolId={tool.id}
                tools={tools}
                workspace={workspace}
                onSelectTool={onSelectTool}
              />
            }
            percent={state.editorSplitPercent}
            start={
              <EditorInput
                contextText={contextText}
                runnerTool={runnerTool}
                textareaRef={textareaRef}
                tools={tools}
                workspace={workspace}
                onSelectTool={onSelectTool}
                onTextChange={handleTextChange}
              />
            }
            onPercentChange={state.setEditorSplitPercent}
          />
        )}
      <HelpTabs isOpen={state.isToolInfoOpen} tool={tool} onOpenChange={state.setToolInfoOpen} />
      <RelatedTools tool={tool} tools={tools} onSelectTool={onSelectTool} />
    </main>
  );
}
