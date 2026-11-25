import type React from 'react';
import { useEffect, useRef } from 'react';
import { whenIdleAfterLoad } from '@/lib/whenIdleAfterLoad';
import { type FlowFieldHandle, mountFlowField } from './flowField/mountFlowField';
import styles from './HeroFlowField.module.scss';

export interface HeroFlowFieldProps {
  isLightTheme: boolean;
}

const canRenderLive = (): boolean =>
  'transferControlToOffscreen' in HTMLCanvasElement.prototype &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function HeroFlowField({ isLightTheme }: HeroFlowFieldProps): React.JSX.Element {
  const posterRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<FlowFieldHandle | null>(null);
  const isLightRef = useRef(isLightTheme);

  isLightRef.current = isLightTheme;

  useEffect(() => {
    const poster = posterRef.current;
    const hero = poster?.parentElement;

    if (!poster || !hero) {
      return;
    }

    if (!canRenderLive()) {
      poster.dataset.fallback = 'true';

      return;
    }

    // a transferred canvas cannot be handed over again, so every effect run gets its own
    const canvas = document.createElement('canvas');

    canvas.className = `${styles.devToolora} devtoolora`;
    canvas.setAttribute('aria-hidden', 'true');
    poster.after(canvas);

    const cancelStart = whenIdleAfterLoad(() => {
      handleRef.current = mountFlowField(canvas, hero, { isLightTheme: isLightRef.current });
    });

    return () => {
      cancelStart();
      handleRef.current?.dispose();
      handleRef.current = null;
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    handleRef.current?.setTheme(isLightTheme);
  }, [isLightTheme]);

  return (
    <div
      aria-hidden="true"
      className={styles.heroPoster}
      data-testid="hero-poster"
      ref={posterRef}
    />
  );
}
