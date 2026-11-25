// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Accordion, type AccordionItemData } from '../src';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items: AccordionItemData[] = [
  { content: 'One', id: 'one', title: 'First' },
  { content: 'Two', id: 'two', title: 'Second' },
];

function mount() {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  const triggers = () => [...container.querySelectorAll<HTMLButtonElement>('[aria-controls]')];
  const expanded = () => triggers().map((button) => button.getAttribute('aria-expanded'));
  const click = (button: HTMLButtonElement) =>
    act(async () => {
      button.click();
    });

  const ready = act(async () => {
    root.render(<Accordion items={items} />);
  });

  return { click, container, expanded, ready, root, triggers };
}

describe('Accordion', () => {
  it('opens the first item, toggles items and toggles all items', async () => {
    const view = mount();

    await view.ready;
    assert.deepEqual(view.expanded(), ['true', 'false']);

    const [first, second] = view.triggers();

    assert.ok(first && second);
    const panel = document.getElementById(first.getAttribute('aria-controls')!);

    assert.equal(panel?.getAttribute('aria-labelledby'), first.id);
    assert.equal(panel?.getAttribute('role'), 'region');
    assert.equal(second.parentElement?.tagName, 'H3');
    assert.equal(second.parentElement?.textContent, 'Second');

    const secondPanel = document.getElementById(second.getAttribute('aria-controls')!);

    assert.equal(panel?.hasAttribute('inert'), false);
    assert.equal(secondPanel?.hasAttribute('inert'), true);

    await view.click(second);
    assert.deepEqual(view.expanded(), ['true', 'true']);
    assert.equal(secondPanel?.hasAttribute('inert'), false);

    const toggleAll = () =>
      view.container.querySelector<HTMLButtonElement>('[aria-label$="sections"]')!;

    assert.equal(toggleAll().getAttribute('aria-label'), 'Collapse all sections');
    await view.click(toggleAll());
    assert.deepEqual(view.expanded(), ['false', 'false']);
    assert.equal(toggleAll().textContent, 'Expand all');
    await view.click(toggleAll());
    assert.deepEqual(view.expanded(), ['true', 'true']);
    await view.click(first);
    assert.deepEqual(view.expanded(), ['false', 'true']);

    await act(async () => {
      view.root.unmount();
    });
  });
});
