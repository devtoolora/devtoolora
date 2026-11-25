// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useListboxNavigation } from '../src/features/search/useListboxNavigation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderNavigation(initialCount: number) {
  const state: { current?: ReturnType<typeof useListboxNavigation> } = {};
  let count = initialCount;

  function Probe() {
    state.current = useListboxNavigation(count);

    return null;
  }

  const root = createRoot(document.createElement('div'));
  const render = () => act(async () => root.render(<Probe />));
  let picked: number | undefined;

  const press = async (key: string) => {
    await act(async () => {
      picked = state.current?.onKeyDown(new KeyboardEvent('keydown', { key }));
    });

    return picked;
  };

  await render();

  return {
    get activeIndex() {
      return state.current?.activeIndex;
    },
    press,
    setCount: async (next: number) => {
      count = next;
      await render();
    },
    unmount: () => act(async () => root.unmount()),
  };
}

describe('useListboxNavigation', () => {
  it('moves within the list and stops at both ends', async () => {
    const view = await renderNavigation(3);

    await view.press('ArrowUp');
    expect(view.activeIndex).toBe(0);
    await view.press('ArrowDown');
    await view.press('ArrowDown');
    await view.press('ArrowDown');
    expect(view.activeIndex).toBe(2);
    expect(await view.press('Enter')).toBe(2);
    await view.unmount();
  });

  it('never points past an empty or shrunken list', async () => {
    const view = await renderNavigation(0);

    await view.press('ArrowDown');
    expect(view.activeIndex).toBe(-1);
    expect(await view.press('Enter')).toBeUndefined();

    await view.setCount(3);
    expect(view.activeIndex).toBe(0);
    await view.press('ArrowDown');
    await view.press('ArrowDown');
    await view.setCount(1);
    expect(view.activeIndex).toBe(0);
    expect(await view.press('Enter')).toBe(0);
    await view.unmount();
  });
});
