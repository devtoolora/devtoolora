import { useEffect, useRef, useState } from 'react';
import type { YRange } from './easingPlotGeometry';

const refitMs = 200;

export function useEasedRange([bottom, top]: YRange): YRange {
  const [shown, setShown] = useState<YRange>([bottom, top]);
  const current = useRef<YRange>(shown);

  useEffect(() => {
    const [fromBottom, fromTop] = current.current;

    if (fromBottom === bottom && fromTop === top) return;

    const show = (range: YRange): void => {
      current.current = range;
      setShown(range);
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      show([bottom, top]);

      return;
    }

    const start = performance.now();
    let frame = 0;

    // performance.now(), not the rAF timestamp: some environments use a different clock for it.
    const step = (): void => {
      const progress = Math.min(1, (performance.now() - start) / refitMs);
      const eased = 1 - (1 - progress) ** 3;

      show([fromBottom + (bottom - fromBottom) * eased, fromTop + (top - fromTop) * eased]);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [bottom, top]);

  return shown;
}
