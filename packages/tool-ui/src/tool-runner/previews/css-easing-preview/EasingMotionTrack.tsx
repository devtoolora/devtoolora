import { parseCubicBezier } from '@devtoolora/functions/css';
import { useEffect, useEffectEvent, useRef, type ReactElement, type RefObject } from 'react';
import { Button } from '../../../ui';
import { usePlaybackPaused } from '../shared/usePausedByReducedMotion';
import styles from './CssEasingPreview.module.scss';

type MotionRunners = {
  curve: RefObject<HTMLDivElement | null>;
  ghost: RefObject<HTMLDivElement | null>;
};

function useMotionLoop(
  paused: boolean,
  timing: string | undefined,
  duration: number,
): MotionRunners {
  const curve = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const isPlayable = Boolean(timing);

  const play = useEffectEvent((): number => {
    const runs: Array<[HTMLDivElement | null, string]> = [
      [curve.current, `transform ${duration}ms ${timing}`],
      [ghost.current, `transform ${duration}ms linear`],
    ];

    for (const [runner] of runs) {
      runner?.style.setProperty('transition', 'none');
      runner?.style.setProperty('transform', 'translateX(0)');
    }

    // Reading layout commits the start position, so the transition restarts from it.
    void curve.current?.offsetWidth;

    for (const [runner, transition] of runs) {
      runner?.style.setProperty('transition', transition);
      runner?.style.setProperty('transform', 'translateX(100%)');
    }

    return duration;
  });

  useEffect(() => {
    if (paused || !isPlayable) return;

    let timer = 0;
    const runners = [curve.current, ghost.current];

    const loop = (): void => {
      timer = window.setTimeout(loop, play() + 900);
    };

    loop();

    return () => {
      window.clearTimeout(timer);

      for (const runner of runners) {
        if (!runner) continue;

        runner.style.setProperty('transform', getComputedStyle(runner).transform);
        runner.style.setProperty('transition', 'none');
      }
    };
  }, [isPlayable, paused]);

  return { curve, ghost };
}

type MotionTrackProps = { css?: string };

export function MotionTrack({ css }: MotionTrackProps): ReactElement {
  const [paused, setPaused] = usePlaybackPaused();
  const points = css && parseCubicBezier(css);
  const duration = Number(css?.match(/transition: transform (\d+(?:\.\d+)?)ms/)?.[1]);
  const timing = points && duration ? `cubic-bezier(${points.join(', ')})` : undefined;
  const isPlayable = Boolean(timing);

  const { curve, ghost } = useMotionLoop(paused, timing, duration);

  return (
    <div className={styles.motion}>
      <Button
        disabled={!isPlayable}
        size="sm"
        variant="secondary"
        onClick={() => setPaused(!paused)}
      >
        {paused ? 'Play' : 'Pause'}
      </Button>

      {timing ? (
        <div aria-hidden="true" className={styles.lanes}>
          <span>Easing</span>
          <div className={styles.track}>
            <div className={styles.runner} data-motion="curve" ref={curve}>
              <span className={styles.block} />
            </div>
          </div>
          <span>Linear</span>
          <div className={styles.track}>
            <div className={styles.runner} data-motion="linear" ref={ghost}>
              <span className={styles.ghost} />
            </div>
          </div>
        </div>
      ) : (
        <p>Waiting for valid CSS…</p>
      )}
    </div>
  );
}
