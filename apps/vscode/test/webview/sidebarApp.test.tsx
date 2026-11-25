// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { vscodeToolMetadata } from '../../src/extension/toolMetadata.generated';
import { SidebarApp } from '../../src/webview/client/views/sidebar-app';
import type {
  ExtensionToWebviewMessage,
  WebviewConfig,
  WebviewState,
} from '../../src/webview/client/types';
import { installFakeVscode, typeInto } from './fakeVscode';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tools = vscodeToolMetadata.filter((tool) =>
  [
    'base64-encode',
    'base64-decode',
    'slugify',
    'case-convert',
    'json-format',
    'json-minify',
    'random-token',
  ].includes(tool.id),
);

async function mount(savedState: WebviewState = {}, config: WebviewConfig = {}) {
  const vscode = installFakeVscode(savedState);
  const container = document.body.appendChild(document.createElement('div'));
  const root: Root = createRoot(container);

  await act(async () => {
    root.render(<SidebarApp config={{ mode: 'sidebar', ...config }} tools={tools} />);
  });

  const unmount = () =>
    act(async () => {
      root.unmount();
      container.remove();
    });
  const search = () => container.querySelector('input[type="search"]') as HTMLInputElement;
  const headers = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'));
  const sectionLabels = () =>
    headers().map((header) => header.querySelector('span:nth-of-type(2)')?.textContent);
  const toolButtons = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-tool-id]'));
  const toolIds = () => toolButtons().map((button) => button.dataset.toolId);
  const toggleAll = () =>
    container.querySelector(
      'button[aria-label="Collapse all"], button[aria-label="Expand all"]',
    ) as HTMLButtonElement;

  return {
    container,
    headers,
    search,
    sectionLabels,
    toggleAll,
    toolButtons,
    toolIds,
    unmount,
    vscode,
  };
}

const hostMessage = (data: ExtensionToWebviewMessage) =>
  act(async () => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });

const type = (element: HTMLInputElement, value: string) =>
  act(async () => {
    typeInto(element, value);
  });

const press = (target: EventTarget, key: string, init: KeyboardEventInit = {}) =>
  act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init }),
    );
  });

const click = (element: HTMLElement) =>
  act(async () => {
    element.click();
  });

const activeRow = (container: ParentNode) =>
  container.querySelector<HTMLElement>('[data-active="true"] button[data-tool-id]')?.dataset.toolId;

describe('SidebarApp', () => {
  it('posts webviewReady, renders from saved state, then follows navigationState', async () => {
    const { container, sectionLabels, toolIds, unmount, vscode } = await mount({
      activeToolId: 'slugify',
      favoriteToolIds: ['slugify'],
    });

    assert.deepEqual(vscode.messages, [{ type: 'webviewReady' }]);

    assert.equal(sectionLabels()[0], 'Favorites');
    assert.equal(toolIds()[0], 'slugify');
    assert.equal(activeRow(container), 'slugify');

    await hostMessage({
      state: { activeToolId: 'json-format', favoriteToolIds: ['random-token'], recentTools: [] },
      type: 'navigationState',
    });

    assert.equal(sectionLabels()[0], 'Favorites');
    assert.equal(toolIds()[0], 'random-token');
    assert.equal(activeRow(container), 'json-format');
    await unmount();
  });

  it('shows Ctrl K as the search shortcut off macOS', async () => {
    const userAgent = vi.spyOn(window.navigator, 'userAgent', 'get');

    userAgent.mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const windows = await mount();

    assert.equal(windows.container.querySelector('kbd')?.textContent, 'Ctrl K');
    await windows.unmount();
    userAgent.mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    const mac = await mount();

    assert.equal(mac.container.querySelector('kbd')?.textContent, '⌘ K');
    await mac.unmount();
    userAgent.mockRestore();
  });

  it('persists navigationState so the next boot renders the last known favorites and recents', async () => {
    const { unmount, vscode } = await mount({ collapsedCategories: ['Text'] });
    const state = {
      activeToolId: 'json-format',
      favoriteToolIds: ['random-token'],
      recentTools: [{ timestamp: 1000, toolId: 'slugify' }],
    };

    await hostMessage({ state, type: 'navigationState' });
    assert.deepEqual(vscode.savedState, { ...state, collapsedCategories: ['Text'] });
    await unmount();
  });

  it('renders Recent with relative timestamps and no favorite star', async () => {
    const { container, sectionLabels, unmount } = await mount({
      favoriteToolIds: ['slugify'],
      recentTools: [
        { timestamp: Date.now() - 5000, toolId: 'random-token' },
        { timestamp: Date.now() - 600000, toolId: 'slugify' },
      ],
    });

    assert.deepEqual(sectionLabels().slice(0, 2), ['Favorites', 'Recent']);
    const recent = container.querySelector('[aria-label="Recent"]') as HTMLElement;

    assert.deepEqual(
      Array.from(recent.querySelectorAll('button[data-tool-id]')).map((b) =>
        b.getAttribute('data-tool-id'),
      ),
      ['random-token', 'slugify'],
    );

    assert.deepEqual(
      Array.from(recent.querySelectorAll('time')).map((time) => time.textContent),
      ['just now', '10m ago'],
    );

    assert.equal(recent.querySelector('button[aria-label*="favorites"]'), null);
    await unmount();
  });

  it('maps alias ids onto canonical tools and hides aliases', async () => {
    const { container, toolIds, unmount } = await mount({
      activeToolId: 'base64-decode',
      favoriteToolIds: ['base64-decode', 'json-minify'],
    });
    const favorites = container.querySelector('[aria-label="Favorites"]') as HTMLElement;

    assert.deepEqual(
      Array.from(favorites.querySelectorAll<HTMLButtonElement>('button[data-tool-id]')).map(
        (b) => b.dataset.toolId,
      ),
      ['base64-encode', 'json-format'],
    );

    assert.ok(!toolIds().includes('base64-decode'));
    assert.ok(!toolIds().includes('json-minify'));
    assert.equal(activeRow(container), 'base64-encode');

    assert.equal(
      favorites.querySelector('button[aria-label="Remove Base64 Encode / Decode from favorites"]')
        ?.textContent,
      '★',
    );

    await unmount();
  });

  it('filters on typing, opens the top result on Enter, clears on Escape', async () => {
    const { container, search, sectionLabels, toolIds, unmount, vscode } = await mount();

    await type(search(), 'slug');
    assert.deepEqual(sectionLabels(), ['Search results']);
    assert.deepEqual(toolIds(), ['slugify']);
    await press(search(), 'Enter');
    assert.deepEqual(vscode.messages.at(-1), { toolId: 'slugify', type: 'openTool' });
    await press(search(), 'Escape');
    assert.equal(search().value, '');
    assert.ok(sectionLabels().length >= 3);
    assert.equal(container.querySelector('p'), null);
    await unmount();
  });

  it('shows an empty search result and sends nothing on Enter', async () => {
    const { container, search, toggleAll, unmount, vscode } = await mount();
    const sent = vscode.messages.length;

    await type(search(), 'zzzz');
    assert.equal(container.querySelector('p')?.textContent, 'No tools match this search.');
    assert.equal(toggleAll().disabled, true);
    await press(search(), 'Enter');
    assert.equal(vscode.messages.length, sent);
    await unmount();
  });

  it('expands matching tools while searching even when their category was collapsed', async () => {
    const { headers, search, toolIds, unmount } = await mount({ collapsedCategories: ['Text'] });

    assert.ok(!toolIds().includes('slugify'));
    await type(search(), 'slug');
    assert.equal(headers()[0]?.getAttribute('aria-expanded'), 'true');
    assert.equal(headers()[0]?.disabled, true);
    assert.deepEqual(toolIds(), ['slugify']);
    await unmount();
  });

  it('collapses and expands every section from one toggle and persists the labels', async () => {
    const { headers, search, toggleAll, unmount, vscode } = await mount({
      collapsedCategories: ['Retired category', 'Crypto'],
      favoriteToolIds: ['slugify'],
    });
    const expanded = () => headers().map((header) => header.getAttribute('aria-expanded'));

    assert.deepEqual(expanded(), ['true', 'true', 'true', 'true', 'false']);
    assert.equal(toggleAll().getAttribute('aria-label'), 'Collapse all');

    await click(toggleAll());
    assert.deepEqual(expanded(), ['false', 'false', 'false', 'false', 'false']);

    assert.deepEqual([...(vscode.savedState.collapsedCategories ?? [])].sort(), [
      'Crypto',
      'Encoders',
      'Favorites',
      'Formatters',
      'Retired category',
      'Text',
    ]);

    assert.equal(toggleAll().getAttribute('aria-label'), 'Expand all');

    await click(toggleAll());
    assert.deepEqual(expanded(), ['true', 'true', 'true', 'true', 'true']);
    assert.deepEqual(vscode.savedState.collapsedCategories, ['Retired category']);
    assert.equal(toggleAll().getAttribute('aria-label'), 'Collapse all');

    const encodersHeader = headers()[1];

    assert.ok(encodersHeader);
    await click(encodersHeader);
    assert.deepEqual(vscode.savedState.collapsedCategories, ['Retired category', 'Encoders']);
    await type(search(), 'slug');
    assert.equal(toggleAll().disabled, true);
    await unmount();
  });

  it('focuses the search on Cmd+K and moves focus with ArrowDown and ArrowUp across enabled buttons only', async () => {
    const { container, search, toolButtons, unmount } = await mount();

    await press(window, 'k', { metaKey: true });
    assert.equal(document.activeElement, search());

    await type(search(), 'slug');
    await press(search(), 'ArrowDown');
    assert.equal(document.activeElement, toolButtons()[0]);
    const enabled = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          'button[data-tool-id], button[aria-label*="favorites"]',
        ),
      );

    await press(document.activeElement as HTMLElement, 'ArrowUp');

    assert.equal(
      document.activeElement,
      enabled().at(-1),
      'wraps from the first enabled button to the last',
    );

    await press(document.activeElement as HTMLElement, 'ArrowDown');
    assert.equal(document.activeElement, enabled()[0], 'wraps from the last to the first');
    await unmount();
  });

  it('toggles favorites through the host', async () => {
    const { container, unmount, vscode } = await mount({ favoriteToolIds: ['slugify'] });

    await click(
      container.querySelector(
        'button[aria-label="Add Case Converter to favorites"]',
      ) as HTMLElement,
    );

    assert.deepEqual(vscode.messages.at(-1), { toolId: 'case-convert', type: 'toggleFavorite' });

    await click(
      container.querySelector('button[aria-label="Remove Slugify from favorites"]') as HTMLElement,
    );

    assert.deepEqual(vscode.messages.at(-1), { toolId: 'slugify', type: 'toggleFavorite' });
    await click(container.querySelector('button[data-tool-id="json-format"]') as HTMLElement);
    assert.deepEqual(vscode.messages.at(-1), { toolId: 'json-format', type: 'openTool' });
    await unmount();
  });

  it('sends nothing on Enter with an empty search', async () => {
    const { search, unmount, vscode } = await mount();
    const sent = vscode.messages.length;

    await press(search(), 'Enter');
    assert.equal(vscode.messages.length, sent);
    await unmount();
  });

  it('renders a recent tool whose timestamp is out of the Date range', async () => {
    const { container, unmount } = await mount();

    await hostMessage({
      state: {
        activeToolId: 'slugify',
        favoriteToolIds: [],
        recentTools: [{ timestamp: Number.MAX_VALUE, toolId: 'json-format' }],
      },
      type: 'navigationState',
    });

    const time = container.querySelector('time');

    assert.ok(time, 'the recent row still renders');
    assert.equal(time.getAttribute('datetime'), null);
    await unmount();
  });

  it('exposes the active tool, chevrons and recent times to assistive tech', async () => {
    const { container, headers, unmount } = await mount();

    await hostMessage({
      state: {
        activeToolId: 'slugify',
        favoriteToolIds: [],
        recentTools: [{ timestamp: Date.UTC(2026, 9, 18, 8, 0, 0), toolId: 'json-format' }],
      },
      type: 'navigationState',
    });

    assert.equal(
      container.querySelector<HTMLElement>('button[aria-current="true"]')?.dataset.toolId,
      'slugify',
    );

    assert.equal(container.querySelectorAll('button[aria-current="true"]').length, 1);
    assert.ok(headers().every((header) => header.querySelector('span[aria-hidden="true"]')));

    assert.equal(
      container.querySelector('time')?.getAttribute('datetime'),
      '2026-10-18T08:00:00.000Z',
    );

    await unmount();
  });
});
