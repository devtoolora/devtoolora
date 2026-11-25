import flowFieldWorkerUrl from './flowField.worker.ts?worker&url';
import {
  DEFAULT_STAR,
  type FlowFieldCommand,
  type FlowFieldEvent,
  type FlowFieldViewport,
} from './protocol';

export type FlowFieldHandle = {
  dispose(): void;
  setTheme(isLight: boolean): void;
};

type PostCommand = (command: FlowFieldCommand) => void;

const MAX_DPR = 1.75;

const isDocumentLight = (): boolean => document.documentElement.dataset.theme === 'light';

function measureViewport(canvas: HTMLCanvasElement, hero: HTMLElement): FlowFieldViewport | null {
  const rect = canvas.getBoundingClientRect();

  if (rect.width < 2 || rect.height < 2) {
    return null;
  }

  const anchor = hero.querySelector<SVGElement>('.hero-triangle')?.getBoundingClientRect();
  // star centre inside HeroTriangle's 440x420 viewBox is (360, 240)
  const star =
    anchor && anchor.width > 0
      ? {
          x: (anchor.left + (anchor.width * 360) / 440 - rect.left) / rect.width,
          y: 1 - (anchor.top + (anchor.height * 240) / 420 - rect.top) / rect.height,
        }
      : DEFAULT_STAR;

  return {
    dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
    height: rect.height,
    star,
    width: rect.width,
  };
}

function watchHero(canvas: HTMLCanvasElement, hero: HTMLElement, post: PostCommand): () => void {
  const listeners = new AbortController();
  let isHeroVisible = true;
  let isRunning: boolean | null = null;

  const syncRunning = (): void => {
    const shouldRun = isHeroVisible && !document.hidden;

    if (shouldRun !== isRunning) {
      isRunning = shouldRun;
      post({ running: shouldRun, type: 'running' });
    }
  };

  const handlePointerMove = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();

    post({
      active: true,
      type: 'pointer',
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    });
  };

  const themeObserver = new MutationObserver(() =>
    post({ isLight: isDocumentLight(), type: 'theme' }),
  );
  const resizeObserver = new ResizeObserver(() => {
    const viewport = measureViewport(canvas, hero);

    if (viewport) {
      post({ type: 'resize', viewport });
    }
  });
  const intersectionObserver = new IntersectionObserver((entries) => {
    isHeroVisible = entries[0]?.isIntersecting ?? true;
    syncRunning();
  });

  themeObserver.observe(document.documentElement, {
    attributeFilter: ['data-theme'],
    attributes: true,
  });

  resizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);

  const { signal } = listeners;

  hero.addEventListener('pointermove', handlePointerMove, { signal });

  hero.addEventListener(
    'pointerleave',
    () => post({ active: false, type: 'pointer', x: 0.5, y: 0.5 }),
    {
      signal,
    },
  );

  document.addEventListener('visibilitychange', syncRunning, { signal });
  syncRunning();

  return () => {
    listeners.abort();
    themeObserver.disconnect();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
  };
}

export function mountFlowField(
  canvas: HTMLCanvasElement,
  hero: HTMLElement,
  options: { isLightTheme: boolean },
): FlowFieldHandle {
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker(flowFieldWorkerUrl, { type: 'module' });
  const post: PostCommand = (command) => worker.postMessage(command);
  const compact = Math.min(window.innerWidth, window.innerHeight * 1.6) < 820;
  const viewport = measureViewport(canvas, hero) ?? {
    dpr: 1,
    height: 1,
    star: DEFAULT_STAR,
    width: 1,
  };
  let unwatch = (): void => {};

  const dispose = (): void => {
    unwatch();
    worker.terminate();
  };

  const fail = (): void => {
    canvas.dataset.failed = 'true';
    delete canvas.dataset.ready;
    dispose();
  };

  worker.onmessage = ({ data }: MessageEvent<FlowFieldEvent>) => {
    if (data.type === 'failed') {
      fail();

      return;
    }

    canvas.dataset.bufferWidth = String(data.bufferWidth);
    canvas.dataset.bufferHeight = String(data.bufferHeight);
    canvas.dataset.ready = 'true';
  };

  worker.onerror = fail;

  const init: FlowFieldCommand = {
    canvas: offscreen,
    isLight: isDocumentLight() || options.isLightTheme,
    side: compact ? 160 : 256,
    type: 'init',
    viewport,
  };

  worker.postMessage(init, [offscreen]);
  unwatch = watchHero(canvas, hero, post);

  return {
    dispose,
    setTheme: (isLight: boolean) => post({ isLight, type: 'theme' }),
  };
}
