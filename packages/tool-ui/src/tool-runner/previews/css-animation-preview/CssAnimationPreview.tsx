import { useId, useState, type ReactElement } from 'react';
import { Button } from '../../../ui';
import { useInjectedKeyframes } from '../shared/useInjectedKeyframes';
import { usePlaybackPaused } from '../shared/usePausedByReducedMotion';
import styles from './CssAnimationPreview.module.scss';

type CssAnimationPreviewProps = { css?: string };

export function CssAnimationPreview({ css }: CssAnimationPreviewProps): ReactElement {
  const name = `motion-preview-${useId().replace(/[^a-z0-9]/gi, '')}`;
  const [paused, setPaused] = usePlaybackPaused();
  const [revision, setRevision] = useState(0);

  // Only generator-validated frames enter the preview, under a private animation name.
  const frames =
    css?.split('\n\n.element')[0]?.replace(/^@keyframes [^{]+/, `@keyframes ${name} `) ?? '';
  const animation = css?.match(/\.element \{ animation: ([^;]+); \}/)?.[1]?.replace(/^\S+/, name);

  useInjectedKeyframes(frames);

  return (
    <section aria-label="Animation preview" className={styles.preview}>
      <h3>Live motion preview</h3>
      <div className={styles.actions}>
        <Button
          disabled={!animation}
          size="sm"
          variant="secondary"
          onClick={() => setPaused(!paused)}
        >
          {paused ? 'Play' : 'Pause'}
        </Button>
        <Button
          disabled={!animation}
          size="sm"
          variant="secondary"
          onClick={() => setRevision(revision + 1)}
        >
          Replay
        </Button>
      </div>
      <div className={styles.stage}>
        {animation ? (
          <div
            className={styles.card}
            data-css-preview="keyframes"
            key={`${css}-${revision}`}
            style={{ animation, animationPlayState: paused ? 'paused' : 'running' }}
          >
            Motion sample
          </div>
        ) : (
          <p>Waiting for valid animation CSS…</p>
        )}
      </div>
      <p>
        Playback controls are preview-only. Reduced-motion preference starts paused; add appropriate
        handling to your exported CSS.
      </p>
    </section>
  );
}
