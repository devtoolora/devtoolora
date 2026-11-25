import type { SerializedToolDefinition } from '@devtoolora/core';
import type { ToolInputSeed, ToolRunnerHost } from '@devtoolora/tool-ui';
import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { seedFromContext } from '../../utils/contextSeed';
import { EditorWorkspace } from '../../components/editor-workspace';
import type { ExtensionToWebviewMessage, WebviewConfig } from '../../types';
import { useWebviewState } from '../../hooks/useWebviewState';
import { getVscode, onHostMessage } from '../../host/vscodeHost';

export type EditorAppProps = {
  config: WebviewConfig;
  host: ToolRunnerHost;
  tools: SerializedToolDefinition[];
};

type ContextSeed = { seed: ToolInputSeed; toolId: string };

function useContextSeed(
  tools: SerializedToolDefinition[],
  setActiveTool: (toolId: string) => void,
) {
  const [contextSeed, setContextSeed] = useState<ContextSeed>();
  const seedCounter = useRef(0);

  const clearContextSeed = useCallback(() => setContextSeed(undefined), []);

  const applyContext = useCallback(
    (toolId: string, text: string) => {
      const tool = tools.find((candidate) => candidate.id === toolId);

      if (!tool) return;

      seedCounter.current += 1;
      const seed = seedFromContext(tool, text, `context:${seedCounter.current}`);

      setContextSeed(seed ? { seed, toolId: tool.id } : undefined);
      setActiveTool(tool.id);
    },
    [setActiveTool, tools],
  );

  return { applyContext, clearContextSeed, contextSeed };
}

export function EditorApp({ config, host, tools }: EditorAppProps): ReactElement {
  useEffect(() => getVscode().postMessage({ type: 'webviewReady' }), []);

  const state = useWebviewState(tools, config);
  const { activeTool, setActiveTool, setFavoriteToolIds } = state;
  const activeToolIdRef = useRef(activeTool.id);

  activeToolIdRef.current = activeTool.id;

  const { applyContext, clearContextSeed, contextSeed } = useContextSeed(tools, setActiveTool);

  const selectTool = useCallback(
    (toolId: string) => {
      if (toolId !== activeToolIdRef.current) clearContextSeed();

      setActiveTool(toolId);
    },
    [clearContextSeed, setActiveTool],
  );

  const handleHostMessage = useCallback(
    (message: ExtensionToWebviewMessage) => {
      if (message.type === 'setActiveTool') selectTool(message.toolId);
      if (message.type === 'setToolContext') applyContext(message.toolId, message.text);
      // The host announces tool changes through setActiveTool; after openTool it posts
      // navigationState with the old tool first, so only its favorites are read.
      if (message.type === 'navigationState') setFavoriteToolIds(message.state.favoriteToolIds);
    },
    [applyContext, selectTool, setFavoriteToolIds],
  );
  const handlerRef = useRef(handleHostMessage);

  handlerRef.current = handleHostMessage;

  useEffect(() => onHostMessage((message) => handlerRef.current(message)), []);

  const applyInitialInput = useEffectEvent(() => {
    if (config.initialInputText !== undefined) {
      applyContext(activeToolIdRef.current, config.initialInputText);
    }
  });

  useEffect(() => applyInitialInput(), []);

  const openTool = useCallback(
    (toolId: string, text?: string) => {
      // Text handed to another tool still belongs to the original selection.
      getVscode().postMessage(
        text === undefined
          ? { toolId, type: 'openTool' }
          : { keepSource: true, toolId, type: 'openTool' },
      );

      if (text === undefined) selectTool(toolId);
      else applyContext(toolId, text);
    },
    [applyContext, selectTool],
  );

  return (
    <EditorWorkspace
      host={host}
      initialInput={contextSeed?.toolId === activeTool.id ? contextSeed.seed : undefined}
      state={state}
      tool={activeTool}
      tools={tools}
      onSelectTool={openTool}
    />
  );
}

export function mountEditorApp(container: HTMLElement, props: EditorAppProps): void {
  createRoot(container).render(<EditorApp {...props} />);
}
