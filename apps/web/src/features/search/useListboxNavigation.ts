import { useState } from 'react';

type ListboxKey = { key: string; preventDefault(): void };

/**
 * Arrow keys move the active option and stop at both ends; Enter returns the active index. The
 * index stays inside the current list, so a list that shrinks or empties never points past it.
 */
export function useListboxNavigation(count: number) {
  const [index, setActiveIndex] = useState(0);
  const activeIndex = count === 0 ? -1 : Math.min(index, count - 1);

  const handleKeyDown = (event: ListboxKey): number | undefined => {
    if (activeIndex === -1) return undefined;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(Math.min(activeIndex + 1, count - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(Math.max(activeIndex - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();

      return activeIndex;
    }

    return undefined;
  };

  return {
    activeIndex,
    onActiveIndexChange: setActiveIndex,
    onKeyDown: handleKeyDown,
    reset: () => setActiveIndex(0),
  };
}
