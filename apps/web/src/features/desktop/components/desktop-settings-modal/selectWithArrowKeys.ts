import type React from 'react';

const arrowSteps: Partial<Record<string, number>> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
};

export function selectWithArrowKeys<T>(
  event: React.KeyboardEvent<HTMLElement>,
  items: readonly T[],
  selected: T,
  onSelect: (item: T) => void,
): void {
  const step = arrowSteps[event.key];

  if (!step) return;

  event.preventDefault();

  const current = items.indexOf(selected);
  const index = current === -1 ? 0 : (current + step + items.length) % items.length;
  const item = items[index];

  if (item === undefined) return;

  onSelect(item);
  event.currentTarget.querySelectorAll<HTMLElement>(':scope > button')[index]?.focus();
}
