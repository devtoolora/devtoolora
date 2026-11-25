import { canRunTool, isToolFileMode, type SerializedToolDefinition } from '@devtoolora/core';
import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ToolPlatformActions } from '../types';
import { ToolVisualPreview } from '../previews';
import { useToolInputs, type ToolInputSeed } from './useToolInputs';
import { useToolRunner, type ToolRunnerHost } from './useToolRunner';

export type UseToolWorkspaceOptions = {
  host: ToolRunnerHost;
  initialDefinition?: SerializedToolDefinition;
  initialInput?: ToolInputSeed;
  metadataId: string;
  platformActions?: ToolPlatformActions;
  onInputsChange?(text: string, fields: Record<string, string>): void;
};

export type ToolWorkspaceState = {
  canRun: boolean;
  handleClear(): void;
  handleKeyDown(event: KeyboardEvent<HTMLElement>): void;
  handleReverse?(): void;
  handleRun(): void;
  inputs: ReturnType<typeof useToolInputs>;
  isStale: boolean;
  outputLabel?: string;
  runner: ReturnType<typeof useToolRunner>;
  shouldRevealError: boolean;
  tool?: SerializedToolDefinition;
  visualPreview?: ReactNode;
};

function fileOutputLabel(fields: Record<string, string>): string {
  if (fields.mode === 'decode') return 'Recovered file';

  return fields.fileOutput === 'data-uri' ? 'Data URI' : 'Base64 file bytes';
}

function outputLabelFor(
  tool: SerializedToolDefinition,
  fields: Record<string, string>,
): string | undefined {
  if (isToolFileMode(tool, fields)) return fileOutputLabel(fields);
  if (!tool.textConversion) return undefined;

  return fields.mode === 'decode'
    ? tool.textConversion.decodedLabel
    : tool.textConversion.encodedLabel;
}

type WorkspaceInputs = ReturnType<typeof useToolInputs>;
type WorkspaceRunner = ReturnType<typeof useToolRunner>;

function useStaleResult(
  runner: WorkspaceRunner,
  inputs: WorkspaceInputs,
  tool: SerializedToolDefinition | undefined,
): boolean {
  const [isStale, setIsStale] = useState(false);
  const { clearResult, discardPending } = runner;

  useEffect(() => {
    if (!tool?.freshResults) return;

    if (tool.autoRun) {
      discardPending();
      setIsStale(true);
    } else {
      clearResult();
    }
  }, [clearResult, discardPending, inputs.fields, inputs.text, tool]);

  useEffect(() => setIsStale(false), [runner.error, runner.result]);

  return isStale;
}

function useRunTrigger(
  runner: WorkspaceRunner,
  inputs: WorkspaceInputs,
  tool: SerializedToolDefinition | undefined,
): Pick<ToolWorkspaceState, 'canRun' | 'handleKeyDown' | 'handleRun' | 'shouldRevealError'> {
  // Runs wait for the worker's own definition, which decides the shared or the isolated worker.
  const canRun = Boolean(runner.tool) && canRunTool(tool, inputs.text, inputs.fields);
  const { clearResult, runTool } = runner;
  const [shouldRevealError, setShouldRevealError] = useState(false);

  const run = useCallback(
    (isManual: boolean) => {
      if (!tool || !canRun) return;

      setShouldRevealError(isManual);
      runTool(tool.id, { text: inputs.text, fields: inputs.fields });
    },
    [canRun, inputs.fields, inputs.text, runTool, tool],
  );
  const handleRun = useCallback(() => run(true), [run]);

  useEffect(() => {
    if (!tool?.autoRun) return;

    if (!canRun) {
      clearResult();

      return;
    }

    const timeout = window.setTimeout(() => run(false), 250);

    return () => window.clearTimeout(timeout);
  }, [canRun, clearResult, run, tool?.autoRun]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canRun || !(event.metaKey || event.ctrlKey) || event.key !== 'Enter') return;

    event.preventDefault();
    handleRun();
  };

  return { canRun, handleKeyDown, handleRun, shouldRevealError };
}

function reverseResult(
  tool: SerializedToolDefinition,
  inputs: WorkspaceInputs,
  runner: WorkspaceRunner,
): void {
  if (!runner.result) return;

  const isFileMode = isToolFileMode(tool, inputs.fields);

  if (isFileMode && inputs.fields.mode === 'decode' && runner.result.artifact) {
    const artifact = runner.result.artifact;

    inputs.onFieldChange('file', `data:${artifact.mimeType};base64,${artifact.base64}`);
    inputs.onFieldChange('fileName', artifact.fileName);
    inputs.onTextChange('');
  } else {
    inputs.onTextChange(runner.result.text || (isFileMode ? (inputs.fields.file ?? '') : ''));
  }

  inputs.onFieldChange('mode', inputs.fields.mode === 'decode' ? 'encode' : 'decode');
  runner.clearResult();
}

export function useToolWorkspace({
  host,
  initialDefinition,
  initialInput,
  metadataId,
  platformActions,
  onInputsChange,
}: UseToolWorkspaceOptions): ToolWorkspaceState {
  const runner = useToolRunner(host, metadataId);
  const hasInitialDefinition =
    runner.definitionStatus === 'loading' && initialDefinition?.id === metadataId;
  const tool = runner.tool ?? (hasInitialDefinition ? initialDefinition : undefined);
  const inputs = useToolInputs(tool, initialInput, onInputsChange);
  const { clearResult } = runner;
  const { clearInputs } = inputs;

  useEffect(() => {
    clearResult();
  }, [clearResult, metadataId]);

  const isStale = useStaleResult(runner, inputs, tool);
  const runTrigger = useRunTrigger(runner, inputs, tool);

  const handleClear = useCallback(() => {
    clearInputs();
    clearResult();
  }, [clearInputs, clearResult]);

  const state = { ...runTrigger, handleClear, inputs, isStale, runner, tool };

  if (!tool) return state;

  return {
    ...state,
    handleReverse: tool.textConversion ? () => reverseResult(tool, inputs, runner) : undefined,
    outputLabel: outputLabelFor(tool, inputs.fields),
    visualPreview: (
      <ToolVisualPreview
        fields={inputs.fields}
        platformActions={platformActions}
        result={runner.result}
        text={inputs.text}
        tool={tool}
        onFieldChange={inputs.onFieldChange}
        onSampleApply={inputs.onSampleApply}
      />
    ),
  };
}
