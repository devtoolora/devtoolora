import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { runToolInteractive } from '../src/extension/interactiveRunner';

const vscode = vi.hoisted(() => ({ selection: '' }));

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() {
      return {
        document: { getText: () => vscode.selection },
        selection: { isEmpty: vscode.selection === '' },
      };
    },
    showQuickPick: async (items: Array<{ tool: { id: string } }>) =>
      items.find((item) => item.tool.id === 'json-format'),
  },
}));

beforeEach(() => {
  vscode.selection = '';
});

describe('Run Tool', () => {
  it('opens the picked tool with its draft when nothing is selected', async () => {
    const calls: string[] = [];

    await runToolInteractive(
      undefined,
      async (toolId, text) => void calls.push(`input ${toolId} ${text}`),
      async (toolId) => void calls.push(`active ${toolId}`),
    );

    assert.deepEqual(calls, ['active json-format']);
  });

  it('passes the selection to the picked tool', async () => {
    const calls: string[] = [];

    vscode.selection = '{"a":1}';

    await runToolInteractive(
      undefined,
      async (toolId, text) => void calls.push(`input ${toolId} ${text}`),
      async (toolId) => void calls.push(`active ${toolId}`),
    );

    assert.deepEqual(calls, ['input json-format {"a":1}']);
  });
});
