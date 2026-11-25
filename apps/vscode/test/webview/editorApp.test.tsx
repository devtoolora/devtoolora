// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { ToolRunnerHost } from '@devtoolora/tool-ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vscodeToolMetadata } from '../../src/extension/toolMetadata.generated';
import { EditorApp } from '../../src/webview/client/views/editor-app';
import type {
  ExtensionToWebviewMessage,
  WebviewConfig,
  WebviewState,
} from '../../src/webview/client/types';
import { buttonByText, FakeWorker, fieldControl, installFakeVscode, typeInto } from './fakeVscode';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tools = vscodeToolMetadata.filter((tool) =>
  [
    'slugify',
    'json-format',
    'random-token',
    'basic-auth',
    'base64-encode',
    'cron-explain',
    'json-tree',
    'jwt-parse',
  ].includes(tool.id),
);
const host: ToolRunnerHost = { createWorker: () => new FakeWorker(tools) as unknown as Worker };
const labelOf = (toolId: string, fieldId: string) =>
  tools.find((tool) => tool.id === toolId)?.fields?.find((field) => field.id === fieldId)?.label ??
  '';

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

async function mount(config: WebviewConfig, savedState: WebviewState = {}, appHost = host) {
  const vscode = installFakeVscode(savedState);
  const container = document.body.appendChild(document.createElement('div'));
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(<EditorApp config={{ mode: 'editor', ...config }} host={appHost} tools={tools} />);
  });

  await settle();
  const unmount = () =>
    act(async () => {
      root.unmount();
      container.remove();
    });

  return { container, root, unmount, vscode };
}

const hostMessage = (data: ExtensionToWebviewMessage) =>
  act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });

const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    typeInto(element, value);
  });

const textarea = (container: ParentNode) =>
  container.querySelector('textarea') as HTMLTextAreaElement;

describe('EditorApp', () => {
  it('posts webviewReady and renders the configured tool', async () => {
    const { container, unmount, vscode } = await mount(
      { initialActiveToolId: 'slugify' },
      { activeToolId: 'json-format', favoriteToolIds: ['slugify'] },
    );

    assert.deepEqual(vscode.messages[0], { type: 'webviewReady' });

    assert.equal(container.querySelector('h1')?.textContent, 'Slugify');

    assert.match(
      container.querySelector('[data-testid="run-tool-button"]')?.textContent ?? '',
      /Run Slugify/,
    );

    assert.ok(textarea(container));
    await unmount();
  });

  it('renders the worker failure state when the worker script cannot be fetched', async () => {
    const failingHost: ToolRunnerHost = {
      createWorker: () => {
        throw new Error('Tool worker failed to load (404).');
      },
    };
    const { container, unmount } = await mount({ initialActiveToolId: 'slugify' }, {}, failingHost);
    const alert = container.querySelector('[role="alert"]');

    assert.ok(alert, 'failure alert');
    assert.match(alert.textContent ?? '', /Tool worker failed to load \(404\)\./);

    assert.ok(
      Array.from(alert.querySelectorAll('button')).some((button) =>
        button.textContent?.includes('Retry'),
      ),
    );

    await unmount();
  });

  it('restores a draft per tool, keeps it across tool switches and clears only the active one', async () => {
    const first = await mount({ initialActiveToolId: 'slugify' });

    await type(textarea(first.container), 'slug draft');
    assert.equal(first.vscode.savedState.toolDrafts?.slugify?.input, 'slug draft');

    await hostMessage({ toolId: 'json-format', type: 'setActiveTool' });
    assert.equal(textarea(first.container).value, '');
    await type(textarea(first.container), 'json draft');
    await hostMessage({ toolId: 'slugify', type: 'setActiveTool' });
    assert.equal(textarea(first.container).value, 'slug draft');
    await first.unmount();

    const second = await mount({ initialActiveToolId: 'slugify' }, first.vscode.savedState);

    assert.equal(textarea(second.container).value, 'slug draft');

    await act(async () => {
      buttonByText(second.container, 'Clear').click();
    });

    assert.equal(textarea(second.container).value, '');
    assert.equal(second.vscode.savedState.toolDrafts?.slugify, undefined);
    assert.equal(second.vscode.savedState.toolDrafts?.['json-format']?.input, 'json draft');
    await second.unmount();
  });

  it('does not restore Base64 file content or Basic Auth passwords from saved drafts', async () => {
    const base64 = await mount(
      { initialActiveToolId: 'base64-encode' },
      {
        toolDrafts: {
          'base64-encode': {
            fields: {
              file: 'data:application/octet-stream;base64,/w==',
              fileName: 'private-file.bin',
              inputType: 'file',
              mode: 'decode',
            },
            input: '/w==',
          },
        },
      },
    );

    assert.equal(textarea(base64.container).value, '');
    assert.equal(base64.vscode.savedState.toolDrafts?.['base64-encode']?.fields.file, undefined);

    assert.equal(
      base64.vscode.savedState.toolDrafts?.['base64-encode']?.fields.fileName,
      undefined,
    );

    assert.equal(base64.vscode.savedState.toolDrafts?.['base64-encode']?.fields.mode, 'decode');
    await base64.unmount();

    const auth = await mount(
      { initialActiveToolId: 'basic-auth' },
      {
        toolDrafts: {
          'basic-auth': { fields: { password: 'previous-secret', username: ' demo ' }, input: '' },
        },
      },
    );
    const password = fieldControl(auth.container, labelOf('basic-auth', 'password'));

    assert.equal(password.value, '');
    assert.equal(fieldControl(auth.container, labelOf('basic-auth', 'username')).value, ' demo ');
    await type(password, ' current-secret ');
    assert.equal(auth.vscode.savedState.toolDrafts?.['basic-auth']?.fields.password, undefined);
    assert.equal(auth.vscode.savedState.toolDrafts?.['basic-auth']?.fields.username, ' demo ');

    await act(async () => {
      password.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', metaKey: true }),
      );
    });

    assert.deepEqual(FakeWorker.runs.at(-1), {
      fields: { password: ' current-secret ', username: ' demo ' },
      text: '',
      toolId: 'basic-auth',
    });

    await auth.unmount();
  });

  it('seeds the input from setToolContext and routes cron text into the expression field', async () => {
    const { container, unmount } = await mount({ initialActiveToolId: 'slugify' });

    await hostMessage({ text: '{"a":1}', toolId: 'json-format', type: 'setToolContext' });
    assert.equal(container.querySelector('h1')?.textContent, 'JSON Format');
    assert.equal(textarea(container).value, '{"a":1}');

    await hostMessage({ text: '0 9 * * MON', toolId: 'cron-explain', type: 'setToolContext' });

    assert.equal(
      fieldControl(container, labelOf('cron-explain', 'expression')).value,
      '0 9 * * MON',
    );

    await unmount();
  });

  it('ignores context text for tools without a text input', async () => {
    const { container, unmount, vscode } = await mount({ initialActiveToolId: 'slugify' });

    await hostMessage({ text: 'ignored', toolId: 'random-token', type: 'setToolContext' });
    assert.equal(container.querySelector('h1')?.textContent, 'Token Generator');
    assert.equal(textarea(container), null);
    assert.equal(vscode.savedState.toolDrafts?.['random-token']?.input ?? '', '');
    await unmount();
  });

  it('drops a pending result when the tool changes', async () => {
    const { container, unmount } = await mount({ initialActiveToolId: 'slugify' });

    FakeWorker.respond = false;
    await type(textarea(container), 'abc');

    await act(async () => {
      textarea(container).dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', metaKey: true }),
      );
    });

    assert.equal(FakeWorker.runs.at(-1)?.toolId, 'slugify');
    await hostMessage({ toolId: 'json-format', type: 'setActiveTool' });

    await act(async () => {
      FakeWorker.flush();
    });

    FakeWorker.respond = true;
    assert.equal(container.querySelector('[data-testid="output-panel"] code'), null);
    await unmount();
  });

  it('runs the active tool with Shift+Cmd+R', async () => {
    const { container, unmount } = await mount({ initialActiveToolId: 'slugify' });

    await type(textarea(container), 'abc');

    await act(async () => {
      textarea(container).dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'r', metaKey: true, shiftKey: true }),
      );
    });

    await settle();
    assert.equal(container.querySelector('[data-testid="output-panel"] code')?.textContent, 'ABC');
    await unmount();
  });

  it('hands a recognized result to another tool without running it', async () => {
    const { container, unmount, vscode } = await mount({ initialActiveToolId: 'json-format' });

    await type(textarea(container), '{"name":"Ada"}');

    await act(async () => {
      buttonByText(container, 'Run JSON Format').click();
    });

    await settle();

    assert.equal(
      container.querySelector('[data-testid="output-panel"] code')?.textContent,
      '{"NAME":"ADA"}',
    );

    const handoff = container.querySelector('section[aria-label="Continue with result"]');

    assert.ok(handoff, 'handoff section');
    assert.equal(handoff.querySelector('p')?.textContent, 'Continue with result: Detected JSON.');
    const runsBefore = FakeWorker.runs.length;

    await act(async () => {
      buttonByText(handoff, 'JSON Tree').click();
    });

    await settle();
    assert.equal(container.querySelector('h1')?.textContent, 'JSON Tree');
    assert.equal(textarea(container).value, '{"NAME":"ADA"}');
    assert.equal(container.querySelector('[data-testid="output-panel"] code'), null);
    assert.equal(FakeWorker.runs.length, runsBefore);

    assert.ok(
      vscode.messages.some(
        (message) => message.type === 'openTool' && message.toolId === 'json-tree',
      ),
    );

    await unmount();
  });

  it('keeps the replace target when switching to a suggested tool', async () => {
    const { container, unmount, vscode } = await mount({ initialActiveToolId: 'slugify' });

    await hostMessage({ text: '{"name":"Ada"}', toolId: 'json-format', type: 'setToolContext' });

    await act(async () => {
      buttonByText(
        container.querySelector('section[aria-label="Suggested actions"]')!,
        'JSON Tree',
      ).click();
    });

    assert.deepEqual(vscode.messages.at(-1), {
      keepSource: true,
      toolId: 'json-tree',
      type: 'openTool',
    });

    await unmount();
  });

  it('suggests tools for incoming context and hides them once the user edits', async () => {
    const { container, unmount } = await mount({ initialActiveToolId: 'slugify' });

    await hostMessage({ text: '{"name":"Ada"}', toolId: 'json-format', type: 'setToolContext' });
    const notice = container.querySelector('section[aria-label="Suggested actions"]');

    assert.ok(notice, 'suggestions');
    assert.equal(notice.querySelector('p')?.textContent, 'Detected JSON.');
    assert.ok(buttonByText(notice, 'JSON Tree'));
    await type(textarea(container), '{"name":"Ada","edited":true}');
    assert.equal(container.querySelector('section[aria-label="Suggested actions"]'), null);
    await unmount();
  });

  it('remembers whether Tool info is open and lists related tools', async () => {
    const { container, unmount, vscode } = await mount({ initialActiveToolId: 'json-format' });
    const details = container.querySelector('details') as HTMLDetailsElement;

    assert.equal(details.open, false);

    // jsdom queues the native toggle event once `open` changes.
    await act(async () => {
      details.open = true;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    assert.equal(vscode.savedState.isToolInfoOpen, true);
    const related = container.querySelector('section[aria-label="Continue with"]');

    assert.ok(related, 'related strip');

    await act(async () => {
      buttonByText(related, 'JSON Tree').click();
    });

    assert.equal(container.querySelector('h1')?.textContent, 'JSON Tree');
    assert.deepEqual(vscode.messages.at(-1), { toolId: 'json-tree', type: 'openTool' });
    await unmount();
  });

  it('numbers input lines in the gutter', async () => {
    const { container, unmount } = await mount({ initialActiveToolId: 'slugify' });

    assert.equal(
      container.querySelectorAll('[data-testid="input-panel"] [data-testid="line-number"]').length,
      1,
    );

    await type(textarea(container), 'line1\nline2\nline3');

    assert.equal(
      container.querySelectorAll('[data-testid="input-panel"] [data-testid="line-number"]').length,
      3,
    );

    await unmount();
  });

  it('keeps handed-over text when the host replays navigationState before setActiveTool', async () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const { container, unmount } = await mount({ initialActiveToolId: 'json-format' });

    await hostMessage({ text: token, toolId: 'json-format', type: 'setToolContext' });
    const notice = container.querySelector('section[aria-label="Suggested actions"]');

    assert.ok(notice, 'suggestions');

    await act(async () => {
      buttonByText(notice, 'JWT Debugger').click();
    });

    await hostMessage({
      state: { activeToolId: 'json-format', favoriteToolIds: [], recentTools: [] },
      type: 'navigationState',
    });

    await hostMessage({ toolId: 'jwt-parse', type: 'setActiveTool' });
    assert.equal(container.querySelector('h1')?.textContent, 'JWT Debugger');
    assert.equal(textarea(container).value, token);
    await unmount();
  });

  it('toggles the favorite through the host and mirrors navigationState', async () => {
    const { container, unmount, vscode } = await mount({ initialActiveToolId: 'slugify' });
    const favorite = () =>
      container.querySelector('button[aria-label$=" favorite"]') as HTMLButtonElement;

    assert.equal(favorite().getAttribute('aria-label'), 'Add favorite');

    await act(async () => {
      favorite().click();
    });

    assert.deepEqual(vscode.messages.at(-1), { toolId: 'slugify', type: 'toggleFavorite' });

    await hostMessage({
      state: { activeToolId: 'slugify', favoriteToolIds: ['slugify'], recentTools: [] },
      type: 'navigationState',
    });

    assert.equal(favorite().getAttribute('aria-label'), 'Remove favorite');
    assert.equal(favorite().getAttribute('aria-pressed'), 'true');
    await unmount();
  });
});
