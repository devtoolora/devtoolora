// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import type { SerializedToolDefinition, ToolContent } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { HelpTabs } from '../../src/webview/client/components/help-tabs';

const fixtures = vi.hoisted((): Record<string, ToolContent> => ({
  'single-help': { help: 'Builds a token.' },
}));
const pendingLoads = vi.hoisted((): Array<Promise<unknown>> => []);

vi.mock('@devtoolora/browser-catalog/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@devtoolora/browser-catalog/content')>();

  return {
    ...actual,
    loadToolContent: (id: string) => {
      const load = Promise.resolve(fixtures[id] ?? actual.loadToolContent(id));

      pendingLoads.push(load);

      return load;
    },
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base: SerializedToolDefinition = {
  category: 'Crypto',
  description: 'Generate a token.',
  id: 'random-token',
  inputKind: 'optionalText',
  name: 'Token Generator',
  outputKind: 'text',
  supportsSelection: true,
};

async function mount(tool: SerializedToolDefinition) {
  const opened: boolean[] = [];
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  await act(async () => {
    root.render(<HelpTabs isOpen={false} tool={tool} onOpenChange={(open) => opened.push(open)} />);
  });

  // The texts load as a separate chunk after the first render.
  await act(async () => {
    await Promise.allSettled(pendingLoads);
  });

  const tabs = () => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panel = () => container.querySelector<HTMLElement>('[role="tabpanel"]');
  const press = (tab: HTMLButtonElement, key: string) =>
    act(async () => {
      tab.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
    });

  return { container, opened, panel, press, root, tabs };
}

describe('HelpTabs', () => {
  it('renders one tab per loaded section with keyboard roving and a FAQ definition list', async () => {
    const { container, opened, panel, press, root, tabs } = await mount(base);

    assert.equal(container.querySelector('summary')?.textContent, 'Tool info');

    assert.equal(
      container.querySelector('[role="tablist"]')?.getAttribute('aria-label'),
      'Tool documentation',
    );

    assert.ok(tabs().length > 1);
    assert.equal(tabs().at(-1)?.textContent, 'FAQ');

    const [first, second] = tabs();

    assert.ok(first && second);
    assert.equal(first.getAttribute('aria-selected'), 'true');
    assert.ok(panel()?.textContent);

    await press(first, 'ArrowRight');
    assert.equal(second.getAttribute('aria-selected'), 'true');
    assert.equal(second.tabIndex, 0);
    assert.equal(first.tabIndex, -1);
    assert.ok(panel()?.textContent);
    await press(second, 'End');

    assert.ok(panel()?.querySelector('dl dt')?.textContent);
    assert.ok(panel()?.querySelector('dl dd')?.textContent);

    const details = container.querySelector('details') as HTMLDetailsElement;

    // jsdom queues the native toggle event once `open` changes.
    await act(async () => {
      details.open = true;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    assert.deepEqual(opened, [true]);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders a single section without a tablist and nothing without documentation', async () => {
    const single = await mount({ ...base, id: 'single-help' });

    assert.equal(single.container.querySelector('[role="tablist"]'), null);
    assert.match(single.container.textContent ?? '', /Builds a token\./);

    await act(async () => {
      single.root.unmount();
    });

    const empty = await mount({ ...base, id: 'no-such-tool' });

    assert.equal(empty.container.querySelector('details'), null);

    await act(async () => {
      empty.root.unmount();
    });
  });
});
