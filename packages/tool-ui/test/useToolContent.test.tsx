// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it, vi } from 'vitest';
import { loadToolContent } from '@devtoolora/browser-catalog/content';
import type { ToolContent } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useToolContent } from '../src';

vi.mock('@devtoolora/browser-catalog/content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@devtoolora/browser-catalog/content')>();

  return { ...actual, loadToolContent: vi.fn(actual.loadToolContent) };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Tool = { aliasOf?: string; id: string };

async function mount(tool: Tool | undefined) {
  const seen: Array<ToolContent | undefined> = [];
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  function Probe({ value }: { value: Tool | undefined }) {
    seen.push(useToolContent(value));

    return null;
  }

  await act(async () => root.render(<Probe value={tool} />));

  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  const rerender = (next: Tool | undefined) => act(async () => root.render(<Probe value={next} />));

  return { rerender, root, seen, settle };
}

describe('useToolContent', () => {
  it('loads the canonical tool texts, also for an alias', async () => {
    const { root, seen, settle } = await mount({ aliasOf: 'json-format', id: 'json-minify' });

    assert.equal(seen[0], undefined);
    await settle();
    assert.match(seen.at(-1)?.faq?.[0]?.question ?? '', /JSON Format/);
    assert.match(seen.at(-1)?.documentation?.[0]?.title ?? '', /JSON formatting/);

    await act(async () => root.unmount());
  });

  it('returns undefined without a tool and drops texts of the previous tool', async () => {
    const { rerender, root, seen, settle } = await mount(undefined);

    await settle();
    assert.equal(seen.at(-1), undefined);

    await rerender({ id: 'json-format' });
    await settle();
    assert.ok(seen.at(-1)?.faq?.length);

    await rerender({ id: 'no-such-tool' });
    assert.equal(seen.at(-1), undefined);
    await settle();
    assert.equal(seen.at(-1), undefined);

    await act(async () => root.unmount());
  });

  it('ignores a slow load of the previous tool that resolves after switching', async () => {
    const resolvers: Record<string, (content: ToolContent) => void> = {};

    vi.mocked(loadToolContent)
      .mockImplementationOnce(
        (id) => new Promise<ToolContent>((resolve) => (resolvers[id] = resolve)),
      )
      .mockImplementationOnce(
        (id) => new Promise<ToolContent>((resolve) => (resolvers[id] = resolve)),
      );

    const { rerender, root, seen } = await mount({ id: 'tool-a' });

    await rerender({ id: 'tool-b' });
    await act(async () => resolvers['tool-b']?.({ help: 'B' }));
    await act(async () => resolvers['tool-a']?.({ help: 'A' }));

    assert.equal(seen.at(-1)?.help, 'B');
    assert.ok(seen.every((content) => content?.help !== 'A'));

    await act(async () => root.unmount());
  });
});
