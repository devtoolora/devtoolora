import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

type MoveDirection = 'earlier' | 'later';

type MoveFocus = {
  listRef: RefObject<HTMLOListElement | null>;
  onMoved(index: number, direction: MoveDirection): void;
};

/**
 * Moving an item re-renders the list, which drops focus from its arrow button. Focus returns to
 * the same arrow on the item's new position, or the other one once that end is reached.
 */
export function useMoveFocus(order: string): MoveFocus {
  const listRef = useRef<HTMLOListElement>(null);
  const [target, setTarget] = useState<{
    direction: MoveDirection;
    index: number;
    order: string;
  }>();

  useLayoutEffect(() => {
    if (!target || target.order === order) return;

    const buttons = [
      ...(listRef.current?.children[target.index]?.querySelectorAll<HTMLButtonElement>(
        'button[data-move]',
      ) ?? []),
    ].filter((button) => !button.disabled);

    (buttons.find((button) => button.dataset.move === target.direction) ?? buttons[0])?.focus();
    setTarget(undefined);
  }, [order, target]);

  return {
    listRef,
    onMoved: (index, direction) => setTarget({ direction, index, order }),
  };
}
