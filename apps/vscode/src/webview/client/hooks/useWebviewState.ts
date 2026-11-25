import type { SerializedToolDefinition } from '@devtoolora/core';
import { useCallback, useEffect, useState } from 'react';
import { clampEditorSplitPercent, normalizeToolDrafts } from '../utils/state';
import type { ToolDraft, WebviewConfig } from '../types';
import { getVscode } from '../host/vscodeHost';

function sameDraft(a: ToolDraft | undefined, b: ToolDraft | undefined): boolean {
  if (!a || !b) return a === b;

  return a.input === b.input && JSON.stringify(a.fields) === JSON.stringify(b.fields);
}

export function useWebviewState(tools: SerializedToolDefinition[], config: WebviewConfig) {
  const [saved] = useState(() => getVscode().getState() ?? {});
  const [activeToolId, setActiveToolId] = useState(() => {
    const knownId = (toolId: string | undefined) =>
      tools.some((tool) => tool.id === toolId) ? toolId : undefined;

    return knownId(config.initialActiveToolId) ?? knownId(saved.activeToolId) ?? tools[0]?.id ?? '';
  });
  const [drafts, setDrafts] = useState(() => normalizeToolDrafts(tools, saved.toolDrafts));
  const [editorSplitPercent, setSplitPercent] = useState(() =>
    clampEditorSplitPercent(saved.editorSplitPercent),
  );
  const [favoriteToolIds, setFavorites] = useState(() => new Set(saved.favoriteToolIds ?? []));
  const [isToolInfoOpen, setToolInfoOpen] = useState(saved.isToolInfoOpen === true);

  useEffect(() => {
    getVscode().setState({
      ...saved,
      activeToolId,
      editorSplitPercent,
      isToolInfoOpen,
      toolDrafts: drafts,
    });
  }, [activeToolId, drafts, editorSplitPercent, isToolInfoOpen, saved]);

  const saveDraft = useCallback((toolId: string, draft: ToolDraft | undefined) => {
    setDrafts((current) => {
      if (sameDraft(current[toolId], draft)) return current;

      const next = { ...current };

      if (draft) next[toolId] = draft;
      else delete next[toolId];

      return next;
    });
  }, []);

  const setActiveTool = useCallback(
    (toolId: string) => {
      if (tools.some((tool) => tool.id === toolId)) setActiveToolId(toolId);
    },
    [tools],
  );

  const setEditorSplitPercent = useCallback(
    (percent: number) => setSplitPercent(clampEditorSplitPercent(percent)),
    [],
  );

  const setFavoriteToolIds = useCallback((ids: string[]) => setFavorites(new Set(ids)), []);

  const activeTool = tools.find((tool) => tool.id === activeToolId) ?? tools[0];

  if (!activeTool) throw new Error('The editor webview needs at least one tool.');

  return {
    activeTool,
    drafts,
    editorSplitPercent,
    favoriteToolIds,
    isToolInfoOpen,
    saveDraft,
    setActiveTool,
    setEditorSplitPercent,
    setFavoriteToolIds,
    setToolInfoOpen,
  };
}

export type WebviewStateHandle = ReturnType<typeof useWebviewState>;
