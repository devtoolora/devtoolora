// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HeroFlowField } from '../../src/features/hero/HeroFlowField';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../src/lib/whenIdleAfterLoad', () => ({
  whenIdleAfterLoad: (callback: () => void) => {
    callback();

    return () => undefined;
  },
}));

const workers: unknown[] = [];

class FakeWorker {
  onerror: (() => void) | null = null;
  onmessage: (() => void) | null = null;

  constructor() {
    workers.push(this);
  }

  postMessage(): void {}

  terminate(): void {}
}

class FakeObserver {
  disconnect(): void {}

  observe(): void {}
}

function stubTransfer(): void {
  const transferred = new WeakSet<HTMLCanvasElement>();

  HTMLCanvasElement.prototype.transferControlToOffscreen = function transfer(
    this: HTMLCanvasElement,
  ) {
    if (transferred.has(this)) {
      throw new DOMException('Cannot transfer control twice', 'InvalidStateError');
    }

    transferred.add(this);

    return {} as OffscreenCanvas;
  };
}

async function mountHero() {
  const hero = document.body.appendChild(document.createElement('section'));
  const root = createRoot(hero);

  await act(async () =>
    root.render(
      <StrictMode>
        <HeroFlowField isLightTheme={false} />
      </StrictMode>,
    ),
  );

  return { hero, root };
}

describe('HeroFlowField', () => {
  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('ResizeObserver', FakeObserver);
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
    document.body.replaceChildren();
  });

  it('mounts a fresh canvas per effect run', async () => {
    stubTransfer();
    const { hero, root } = await mountHero();

    assert.equal(hero.querySelectorAll('canvas.devtoolora').length, 1);

    assert.equal(
      hero.querySelector('[data-testid="hero-poster"] + canvas.devtoolora')?.ariaHidden,
      'true',
    );

    assert.equal(workers.length, 2);

    assert.equal(
      hero.querySelector<HTMLElement>('[data-testid="hero-poster"]')?.dataset.fallback,
      undefined,
    );

    await act(async () => root.unmount());

    assert.equal(hero.querySelectorAll('canvas').length, 0);
  });

  it('keeps only the poster without OffscreenCanvas', async () => {
    const { hero } = await mountHero();

    assert.equal(workers.length, 0);
    assert.equal(hero.querySelectorAll('canvas').length, 0);

    assert.equal(
      hero.querySelector<HTMLElement>('[data-testid="hero-poster"]')?.dataset.fallback,
      'true',
    );
  });
});
