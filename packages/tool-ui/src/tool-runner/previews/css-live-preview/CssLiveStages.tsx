import type { ToolPreviewKind } from '@devtoolora/core';
import { cssColorHex } from '@devtoolora/functions/css';
import { useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import styles from './CssLivePreview.module.scss';

export type LiveStageKind =
  'filter' | 'glass' | 'gradient' | 'neumorphism' | 'text-shadow' | 'transform';

export const liveStageKinds: Partial<Record<ToolPreviewKind, LiveStageKind>> = {
  'css-filter': 'filter',
  'css-glass': 'glass',
  'css-gradient': 'gradient',
  'css-mesh': 'gradient',
  'css-neumorphism': 'neumorphism',
  'css-text-shadow': 'text-shadow',
  'css-transform': 'transform',
};

export const liveStageCaptions: Record<LiveStageKind, string> = {
  filter: 'The demo scene is drawn with CSS and is not exported.',
  transform:
    'The dashed outline marks the original position and the dot marks transform-origin. The stage scrolls so large values are never clipped; the card, outline and stage perspective are not exported.',
  'text-shadow':
    'First listed layer paints on top. Text color, size and weight are not exported; the surface only helps you judge contrast.',
  glass:
    'The card sits over a patterned backdrop so the blur is visible. Text contrast depends on what is behind the panel; the backdrop and sample text are not exported.',
  neumorphism:
    'The viewport takes the base color. Neumorphic edges are low contrast and are not a focus or state indicator on their own; the card size and label are not exported.',
  gradient:
    'The swatch fills the stage; translucent colors show the checkerboard behind it. Its size and radius are not exported.',
};

const captionNotes: Partial<Record<LiveStageKind, string>> = {
  filter:
    'backdrop-filter only shows on a translucent element, so the card sits over a patterned backdrop.',
  gradient: 'Older browsers keep the first line.',
};

export function liveStageCaptionNote(
  kind: string,
  fields: Record<string, string>,
): { isShown: boolean; text: string } | undefined {
  const text = captionNotes[kind as LiveStageKind];

  if (!text) return undefined;

  return {
    isShown:
      kind === 'filter'
        ? fields.target === 'backdrop-filter'
        : (fields.interpolation ?? 'default') !== 'default',
    text,
  };
}

export const liveStageClasses: Record<LiveStageKind, string | undefined> = {
  filter: styles.filterStage,
  glass: styles.glassCard,
  neumorphism: styles.neumorphismCard,
  gradient: styles.gradient,
  'text-shadow': styles.textShadow,
  transform: styles.transformCard,
};

export function neumorphismViewportStyle(
  css: string | undefined,
  rawBaseColor: string | undefined,
): CSSProperties | undefined {
  if (!css || !rawBaseColor?.trim()) return undefined;

  let baseColor: string;

  try {
    baseColor = cssColorHex(rawBaseColor, 'Base color');
  } catch {
    return undefined;
  }

  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) =>
    parseInt(baseColor.slice(start, start + 2), 16),
  );

  return {
    backgroundColor: baseColor,
    color: red * 0.299 + green * 0.587 + blue * 0.114 > 140 ? '#334155' : '#cbd5e1',
  };
}

function PatternedBackdrop(): ReactElement {
  return <div aria-hidden="true" className={styles.patternedBackdrop} data-patterned-backdrop />;
}

export function BackdropFrame({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className={styles.backdropFrame}>
      <PatternedBackdrop />
      {children}
    </div>
  );
}

/** Built from CSS shapes only: the VS Code webview CSP blocks image files. */
export function FilterDemoScene(): ReactElement {
  return (
    <div className={styles.scene} data-demo-scene>
      <span className={styles.sun} />
      <span className={styles.hillBack} />
      <span className={styles.hillFront} />
      <span className={styles.swatches}>
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </span>
    </div>
  );
}

const axisOffset = (origin: string, start: string, end: string): string => {
  if (origin.includes(start)) return '0%';

  return origin.includes(end) ? '100%' : '50%';
};

const originOffsets = (origin: string): { left: string; top: string } => ({
  left: axisOffset(origin, 'left', 'right'),
  top: axisOffset(origin, 'top', 'bottom'),
});

const nearestShift = (start: number, end: number, viewStart: number, viewEnd: number): number =>
  start < viewStart ? start - viewStart : Math.max(0, Math.min(end - viewEnd, start - viewStart));

function revealCard(viewport: HTMLElement, card: Element): void {
  const view = viewport.getBoundingClientRect();
  const box = card.getBoundingClientRect();

  viewport.scrollLeft += nearestShift(box.left, box.right, view.left, view.right);
  viewport.scrollTop += nearestShift(box.top, box.bottom, view.top, view.bottom);
}

export function TransformFrame({
  children,
  css,
  origin,
  ownPerspective,
}: {
  children: ReactNode;
  css: string;
  origin: string;
  ownPerspective: boolean;
}): ReactElement {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = stage.current?.parentElement;

    if (!viewport) return;

    viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
  }, []);

  useEffect(() => {
    const viewport = stage.current?.parentElement;
    const card = stage.current?.querySelector('[data-css-preview="transform"]');

    if (!viewport || !card) return;

    // The parent applies the new declarations in its own later effect; measure next frame.
    const frame = requestAnimationFrame(() => revealCard(viewport, card));

    return () => cancelAnimationFrame(frame);
  }, [css]);

  return (
    <div className={styles.transformStage} data-transform-stage ref={stage}>
      <div className={styles.transformFrame} data-perspective={ownPerspective ? 'own' : 'stage'}>
        <div aria-hidden="true" className={styles.transformOutline} data-transform-outline />
        {children}
        <span
          aria-hidden="true"
          className={styles.transformOrigin}
          data-origin={origin}
          data-transform-origin-dot
          style={originOffsets(origin)}
        />
      </div>
    </div>
  );
}
