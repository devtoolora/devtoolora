// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, vi } from 'vitest';
import { MergeList } from '../src/tool-runner/previews/pdf-pages-preview/MergeList';
import { OrderPages } from '../src/tool-runner/previews/pdf-pages-preview/OrderPages';

vi.mock('../src/tool-runner/previews/pdf-pages-preview/pdfThumbnails', () => ({
  usePdfThumbnails: () => ({ pages: [], status: 'idle' }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function OrderHarness() {
  const [value, setValue] = useState('1, 2, 3');

  return (
    <OrderPages
      byPage={new Map()}
      count={3}
      value={value}
      onFieldChange={(_, next) => setValue(next)}
    />
  );
}

function MergeHarness() {
  const [sources, setSources] = useState([
    { data: 'data:application/pdf;base64,QQ==', name: 'a.pdf' },
    { data: 'data:application/pdf;base64,Qg==', name: 'b.pdf' },
    { data: 'data:application/pdf;base64,Qw==', name: 'c.pdf' },
  ]);

  return (
    <MergeList
      sources={sources}
      onFieldChange={(fieldId, next) => {
        if (fieldId === 'pdfs') setSources(JSON.parse(next));
      }}
    />
  );
}

async function render(element: React.ReactElement) {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  await act(async () => root.render(element));

  const press = async (label: string) => {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

    button.focus();
    await act(async () => button.click());
  };

  const focused = () => document.activeElement?.getAttribute('aria-label');
  const unmount = () => act(async () => root.unmount());

  return { focused, press, unmount };
}

describe('moving pages and files keeps focus on the moved item', () => {
  it('follows the page in Order Pages', async () => {
    const view = await render(<OrderHarness />);

    await view.press('Move page 1 later');
    assert.equal(view.focused(), 'Move page 1 later');
    await view.press('Move page 1 later');
    assert.equal(view.focused(), 'Move page 1 earlier');
    await view.unmount();
  });

  it('follows the file in the merge list', async () => {
    const view = await render(<MergeHarness />);

    await view.press('Move a.pdf down');
    assert.equal(view.focused(), 'Move a.pdf down');
    await view.press('Move a.pdf down');
    assert.equal(view.focused(), 'Move a.pdf up');
    await view.unmount();
  });
});
