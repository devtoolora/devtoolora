import type { ToolResult, ToolResultAction } from '@devtoolora/core';
import { Button } from '@devtoolora/tool-ui';
import type { ReactElement } from 'react';
import { getVscode } from '../../host/vscodeHost';

type ResultActionsProps = {
  actions: ToolResultAction[];
  result: ToolResult;
};

// Copy and Save live in the shared output panel.
const editorActions: Array<[ToolResultAction, string]> = [
  ['replace', 'Replace selection'],
  ['insert', 'Insert at cursor'],
  ['scratch', 'Open in editor'],
];

export function ResultActions({ actions, result }: ResultActionsProps): ReactElement {
  return (
    <>
      {editorActions
        .filter(([action]) => actions.includes(action))
        .map(([action, label]) => (
          <Button
            key={action}
            size="sm"
            variant="ghost"
            onClick={() => getVscode().postMessage({ action, result, type: 'resultAction' })}
          >
            {label}
          </Button>
        ))}
    </>
  );
}
