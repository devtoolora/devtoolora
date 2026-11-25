import type { ToolPreviewKind } from '@devtoolora/core';
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import styles from './CssLivePreview.module.scss';
import {
  liveStageCaptions,
  liveStageCaptionNote,
  liveStageClasses,
  liveStageKinds,
  BackdropFrame,
  FilterDemoScene,
  TransformFrame,
  neumorphismViewportStyle,
  type LiveStageKind,
} from './CssLiveStages';

type CssLivePreviewProps = { css?: string; fields: Record<string, string>; kind: ToolPreviewKind };
type PreviewKind = 'grid' | 'flexbox' | 'shadow' | 'radius' | 'triangle' | LiveStageKind;

const previewKinds: Partial<Record<ToolPreviewKind, PreviewKind>> = {
  'css-radius': 'radius',
  'css-shadow': 'shadow',
  'css-flexbox': 'flexbox',
  'css-grid': 'grid',
  'css-triangle': 'triangle',
  ...liveStageKinds,
};

export function isCssLivePreview(preview: ToolPreviewKind | undefined): boolean {
  return preview !== undefined && preview in previewKinds;
}

const captions: Record<PreviewKind, string> = {
  flexbox: 'Search is the featured item. Visual order does not change DOM or reading order.',
  grid: 'Fixed column count. Minimum widths can overflow. Demo cells do not include explicit spans.',
  radius: 'Order: top-left, top-right, bottom-right, bottom-left. Visible arcs depend on box size.',
  shadow: 'First listed layer paints on top. Preview card surface and radius are not exported.',
  triangle: 'Size is border width: base is 2 × Size, height is Size; left/right swap axes.',
  ...liveStageCaptions,
};

// Grid shows one cell per track (6-96); flexbox shows 3 items unwrapped, 8 when wrapping.
function demoItemCount(kind: PreviewKind, fields: Record<string, string>): number {
  if (kind === 'grid')
    return Math.min(96, Math.max(6, Number(fields.columns || 3) * Number(fields.rows || 2)));

  return fields.wrap === 'nowrap' ? 3 : 8;
}

const demoLabels = ['Inbox', 'Search', 'Settings', 'Deploy', 'Preview', 'Console', 'Docs', 'Share'];

type Surface = 'brand' | 'dark' | 'light';

/** Applies only declarations from the validated generator, never a stylesheet or user selector. */
function useAppliedDeclarations(css: string | undefined): {
  container: RefObject<HTMLDivElement | null>;
  featured: RefObject<HTMLSpanElement | null>;
} {
  const container = useRef<HTMLDivElement>(null);
  const featured = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (container.current)
      container.current.style.cssText = css?.match(/^[^{]+\{([^}]*)\}/)?.[1] ?? '';
    if (featured.current)
      featured.current.style.cssText =
        css?.match(/\.layout > \.item--featured\s*\{([^}]*)\}/)?.[1] ?? '';
  }, [css]);

  return { container, featured };
}

type PreviewHeadingProps = {
  hasSurface: boolean;
  surface: Surface;
  onSurfaceChange(surface: Surface): void;
};

function PreviewHeading({
  hasSurface,
  surface,
  onSurfaceChange,
}: PreviewHeadingProps): ReactElement {
  return (
    <div className={styles.heading}>
      <h3>Live preview</h3>
      {hasSurface ? (
        <label className={styles.surface}>
          <span>Surface</span>
          <select
            aria-label="Preview surface"
            value={surface}
            onChange={(event) => onSurfaceChange(event.target.value as Surface)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="brand">Brand tint</option>
          </select>
        </label>
      ) : (
        <span>Scrollable stage · no hidden scaling</span>
      )}
    </div>
  );
}

const containerClasses: Record<PreviewKind, string | undefined> = {
  flexbox: styles.flexbox,
  grid: styles.grid,
  radius: styles.card,
  shadow: styles.card,
  triangle: styles.triangle,
  ...liveStageClasses,
};

type PreviewStageProps = {
  featured: RefObject<HTMLSpanElement | null>;
  fields: Record<string, string>;
  kind: PreviewKind;
};

function PreviewStageContent({ featured, fields, kind }: PreviewStageProps): ReactElement | false {
  if (kind === 'shadow' || kind === 'radius')
    return (
      <>
        <strong>Design system card</strong>
        <span>{kind === 'radius' ? 'Live border radius' : 'Live box shadow'}</span>
        <span className={styles.demoAction}>Continue</span>
      </>
    );

  if (kind === 'filter')
    return fields.target === 'backdrop-filter' ? (
      <strong>Frosted card</strong>
    ) : (
      <FilterDemoScene />
    );

  if (kind === 'transform') return <strong>Card</strong>;

  if (kind === 'glass')
    return (
      <>
        <strong>Glass panel</strong>
        <span>Body text shows how readable copy stays over the blurred backdrop.</span>
      </>
    );

  if (kind === 'neumorphism') return <strong>Soft card</strong>;

  if (kind === 'text-shadow') return <span>Shadowed headline</span>;

  const itemCount = demoItemCount(kind, fields);

  return (
    kind !== 'triangle' &&
    !(kind in liveStageCaptions) && (
      <>
        {Array.from({ length: Number.isFinite(itemCount) ? itemCount : 6 }, (_, index) => (
          <span
            className={index === 1 && kind === 'flexbox' ? styles.featured : styles.item}
            key={index}
            ref={index === 1 && kind === 'flexbox' ? featured : undefined}
          >
            {kind === 'grid' ? `Item ${index + 1}` : demoLabels[index]}
          </span>
        ))}
      </>
    )
  );
}

type StageFrameProps = {
  children: ReactNode;
  css: string;
  fields: Record<string, string>;
  kind: PreviewKind;
};

function StageFrame({ children, css, fields, kind }: StageFrameProps): ReactNode {
  if (kind === 'transform')
    return (
      <TransformFrame
        css={css}
        origin={fields.origin ?? 'center'}
        ownPerspective={css.includes('perspective(')}
      >
        {children}
      </TransformFrame>
    );

  if (kind === 'glass') return <BackdropFrame>{children}</BackdropFrame>;

  return kind === 'filter' && fields.target === 'backdrop-filter' ? (
    <BackdropFrame>{children}</BackdropFrame>
  ) : (
    children
  );
}

export function CssLivePreview({
  css,
  fields,
  kind: previewKind,
}: CssLivePreviewProps): ReactElement {
  const { container, featured } = useAppliedDeclarations(css);
  const kind = previewKinds[previewKind] ?? 'shadow';
  const [surface, setSurface] = useState<Surface>('light');
  const backdrop = kind === 'filter' && fields.target === 'backdrop-filter';
  const hasSurface = kind === 'shadow' || kind === 'radius' || kind === 'text-shadow';
  const note = liveStageCaptionNote(kind, fields);

  return (
    <section
      aria-label="Live CSS preview"
      className={`${styles.preview} ${hasSurface ? (styles[surface] ?? '') : ''}`}
      data-surface={hasSurface ? surface : undefined}
    >
      <PreviewHeading hasSurface={hasSurface} surface={surface} onSurfaceChange={setSurface} />
      <div
        className={styles.viewport}
        style={kind === 'neumorphism' ? neumorphismViewportStyle(css, fields.baseColor) : undefined}
        tabIndex={0}
      >
        {!css ? (
          <p>Waiting for valid CSS…</p>
        ) : (
          <StageFrame css={css} fields={fields} kind={kind}>
            <div
              className={backdrop ? styles.filterCard : containerClasses[kind]}
              data-css-preview={kind}
              ref={container}
            >
              <PreviewStageContent featured={featured} fields={fields} kind={kind} />
            </div>
          </StageFrame>
        )}
      </div>
      <p className={styles.caption}>
        {captions[kind]}
        {note && (
          <span
            aria-hidden={note.isShown ? undefined : true}
            className={note.isShown ? undefined : styles.reserved}
          >
            {` ${note.text}`}
          </span>
        )}
      </p>
    </section>
  );
}
