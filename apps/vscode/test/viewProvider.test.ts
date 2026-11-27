import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import { DevTooloraViewProvider } from '../src/webview/DevTooloraViewProvider';

type Listener = (message: unknown) => Promise<void>;

type FakePanel = {
  dispose(): void;
  posted: unknown[];
  receive(message: unknown): Promise<void>;
};

const vscode = vi.hoisted(() => ({
  errors: [] as string[],
  panels: [] as FakePanel[],
  toolData: [] as string[],
}));

vi.mock('../src/webview/webviewHtml', () => ({
  renderWebviewHtml: ({ toolData }: { toolData: string }) => {
    vscode.toolData.push(toolData);

    return '<html></html>';
  },
}));

vi.mock('vscode', () => ({
  Uri: { joinPath: () => ({ toString: () => 'vscode-resource:/worker.js' }) },
  ViewColumn: { Beside: -2 },
  window: {
    createWebviewPanel: () => {
      const listeners: Listener[] = [];
      const disposeListeners: Array<() => void> = [];
      const posted: unknown[] = [];
      // A webview drops messages until its script has loaded and said so.
      let loaded = false;
      const panel = {
        dispose: () => disposeListeners.forEach((listener) => listener()),
        onDidDispose: (listener: () => void) => disposeListeners.push(listener),
        posted,
        receive: async (message: unknown) => {
          if ((message as { type?: string }).type === 'webviewReady') loaded = true;

          for (const listener of listeners) await listener(message);
        },
        reveal: () => undefined,
        title: '',
        webview: {
          asWebviewUri: (uri: unknown) => uri,
          html: '',
          onDidReceiveMessage: (listener: Listener) => listeners.push(listener),
          postMessage: async (message: unknown) => loaded && posted.push(message),
        },
      };

      vscode.panels.push(panel);

      return panel;
    },
    showErrorMessage: async (message: string) => void vscode.errors.push(message),
  },
}));

function createProvider(): DevTooloraViewProvider {
  const state = new Map<string, unknown>();

  return new DevTooloraViewProvider(
    { fsPath: '/extension' } as never,
    {
      get: (key: string) => state.get(key),
      keys: () => [...state.keys()],
      update: async (key: string, value: unknown) => void state.set(key, value),
    } as never,
  );
}

beforeEach(() => {
  vscode.errors.length = 0;
  vscode.panels.length = 0;
  vscode.toolData.length = 0;
});

describe('DevTooloraViewProvider', () => {
  it('shows a failed result action instead of throwing', async () => {
    const provider = createProvider();

    provider.onResultAction(async () => {
      throw new Error('EACCES: permission denied');
    });

    await provider.openActiveTool('json-format');

    await assert.doesNotReject(
      vscode.panels[0]!.receive({
        action: 'save',
        result: { text: '' },
        type: 'resultAction',
      }),
    );

    assert.equal(vscode.errors.length, 1);
    assert.match(vscode.errors[0]!, /EACCES/);
  });

  it('shows the input of the last command sent while the panel loads', async () => {
    const provider = createProvider();

    await provider.openToolWithInput('json-format', 'A', undefined);
    await provider.openToolWithInput('json-format', 'B', undefined);
    assert.equal(vscode.panels.length, 1);

    await vscode.panels[0]!.receive({ type: 'webviewReady' });

    assert.deepEqual(
      vscode.panels[0]!.posted.filter(
        (message) => (message as { type: string }).type === 'setToolContext',
      ),
      [{ text: 'B', toolId: 'json-format', type: 'setToolContext' }],
    );
  });

  it('creates one panel for two commands at once', async () => {
    const provider = createProvider();

    await Promise.all([
      provider.openActiveTool('json-format'),
      provider.openActiveTool('json-format'),
    ]);

    assert.equal(vscode.panels.length, 1);
  });

  it('keeps the new panel when an old one reports its disposal late', async () => {
    const provider = createProvider();

    await provider.openActiveTool('json-format');
    vscode.panels[0]!.dispose();
    await provider.openActiveTool('json-format');
    vscode.panels[0]!.dispose();
    await provider.openActiveTool('json-format');

    assert.equal(vscode.panels.length, 2);
  });

  it('keeps the replace target when the panel opens a suggested tool', async () => {
    const provider = createProvider();
    const sources: unknown[] = [];
    const source = { selection: 'selection', uri: 'file:///a.json', version: 1 };

    provider.onResultAction(async (_action, _result, target) => void sources.push(target));
    await provider.openToolWithInput('json-format', '{"a":1}', source as never);
    await vscode.panels[0]!.receive({ keepSource: true, toolId: 'json-tree', type: 'openTool' });

    await vscode.panels[0]!.receive({
      action: 'replace',
      result: { text: '' },
      type: 'resultAction',
    });

    await vscode.panels[0]!.receive({ toolId: 'json-format', type: 'openTool' });

    await vscode.panels[0]!.receive({
      action: 'replace',
      result: { text: '' },
      type: 'resultAction',
    });

    assert.deepEqual(sources, [source, undefined]);
  });

  it('inserts at the cursor of a tool opened without a selection', async () => {
    const provider = createProvider();
    const targets: unknown[] = [];
    const cursor = { selection: 'cursor', uri: 'file:///a.html', version: 1 };

    provider.onResultAction(async (_action, _result, target) => void targets.push(target));
    await provider.openActiveTool('lorem-ipsum', { source: cursor as never });

    await vscode.panels[0]!.receive({
      action: 'insert',
      result: { text: '' },
      type: 'resultAction',
    });

    assert.deepEqual(targets, [cursor]);
  });

  it('sends the sidebar only the catalog fields and the panel full tools', async () => {
    const provider = createProvider();
    const webview = {
      asWebviewUri: (uri: unknown) => uri,
      html: '',
      onDidReceiveMessage: () => undefined,
      options: {},
      postMessage: async () => true,
    };

    provider.resolveWebviewView({ webview } as never);
    await provider.openActiveTool('json-format');

    const [sidebarData, panelData] = vscode.toolData;
    const sidebarTool = (JSON.parse(sidebarData!) as Array<Record<string, unknown>>).find(
      (tool) => tool.id === 'json-format',
    );
    const panelTool = (JSON.parse(panelData!) as Array<Record<string, unknown>>).find(
      (tool) => tool.id === 'json-format',
    );

    assert.deepEqual(Object.keys(sidebarTool!).sort(), [
      'badge',
      'category',
      'description',
      'id',
      'keywords',
      'name',
    ]);

    assert.ok(panelTool!.samples);
    assert.ok(sidebarData!.length < 200_000);
  });
});
