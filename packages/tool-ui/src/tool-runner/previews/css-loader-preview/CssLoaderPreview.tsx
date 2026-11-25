import { useEffect, useId, useRef, type ReactElement } from 'react';
import { Button } from '../../../ui';
import { useInjectedKeyframes } from '../shared/useInjectedKeyframes';
import { usePlaybackPaused } from '../shared/usePausedByReducedMotion';
import styles from './CssLoaderPreview.module.scss';

type CssLoaderPreviewProps = { css?: string };

/** The generator's own keyframes block and `.loader` declarations; nothing else is applied. */
function parseLoaderCss(css: string | undefined): { frames: string; rule: string } | undefined {
  const frames = css?.match(/@keyframes [^{]+\{[\s\S]*?\n\}/)?.[0];
  const rule = css?.match(/\n\.loader \{\n([\s\S]*?)\n\}/)?.[1];

  return frames && rule ? { frames, rule } : undefined;
}

export function CssLoaderPreview({ css }: CssLoaderPreviewProps): ReactElement {
  const name = `loader-preview-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const [paused, setPaused] = usePlaybackPaused();
  const loader = useRef<HTMLSpanElement>(null);
  const parsed = parseLoaderCss(css);
  const preset = css?.match(/@keyframes loader-([\w-]+)/)?.[1];
  const declarations = parsed?.rule.replace(/animation: \S+/, `animation: ${name}`);

  useInjectedKeyframes(parsed?.frames.replace(/^@keyframes \S+/, `@keyframes ${name}`) ?? '');

  useEffect(() => {
    if (loader.current && declarations) loader.current.style.cssText = declarations;
  }, [declarations]);

  useEffect(() => {
    loader.current?.style.setProperty('animation-play-state', paused ? 'paused' : 'running');
  }, [declarations, paused]);

  return (
    <section aria-label="Loader preview" className={styles.preview}>
      <div className={styles.heading}>
        <h3>Live preview</h3>
        <span>{preset ? `${preset} loader` : 'Invalid loader'}</span>
        <Button disabled={!parsed} size="sm" variant="secondary" onClick={() => setPaused(!paused)}>
          {paused ? 'Play' : 'Pause'}
        </Button>
      </div>
      <div className={styles.viewport}>
        {parsed ? (
          <span
            aria-label="Loading"
            className={styles.loader}
            data-css-preview="loader"
            ref={loader}
            role="status"
          />
        ) : (
          <p>Waiting for valid CSS…</p>
        )}
      </div>
      <p className={styles.caption}>
        Pause freezes the loader in place. The exported CSS slows it to three times the duration
        under reduced motion instead of stopping it. The stage is not exported.
      </p>
    </section>
  );
}
