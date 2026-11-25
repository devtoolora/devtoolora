// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'vitest';
import { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { CssLoaderPreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let reducedMotion = false;

window.matchMedia = () =>
  ({
    addEventListener() {},
    matches: reducedMotion,
    removeEventListener() {},
  }) as unknown as MediaQueryList;

const css = [
  '/* <span class="loader" role="status" aria-label="Loading"></span> */',
  '@keyframes loader-ring {',
  '  to { transform: rotate(360deg); }',
  '}',
  '',
  '.loader {',
  '  box-sizing: border-box;',
  '  width: 48px;',
  '  height: 48px;',
  '  border: 4px solid #cbd5e1;',
  '  border-top-color: #2563eb;',
  '  border-radius: 50%;',
  '  animation: loader-ring 800ms linear infinite;',
  '}',
  '',
  '@media (prefers-reduced-motion: reduce) {',
  '  .loader {',
  '    animation-duration: 2400ms;',
  '  }',
  '}',
].join('\n');

async function render(output: string | undefined = css) {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  await act(async () => {
    root.render(<CssLoaderPreview css={output} />);
  });

  return { container, root };
}

const injected = (): string =>
  document.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .map((rule) => rule.cssText)
    .join('');

describe('CssLoaderPreview', () => {
  beforeEach(() => {
    reducedMotion = false;
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('renders one status loader under a private keyframes name and removes it on unmount', async () => {
    const { container, root } = await render();
    const loader = container.querySelectorAll('[role="status"]');

    assert.equal(loader.length, 1);
    assert.equal(loader[0]?.getAttribute('aria-label'), 'Loading');
    assert.equal(loader[0]?.getAttribute('data-css-preview'), 'loader');
    assert.match(injected(), /@keyframes loader-preview-\w+/);
    assert.doesNotMatch(injected(), /@keyframes loader-ring/);
    assert.ok(container.querySelector('button')?.textContent?.includes('Pause'));

    await act(async () => root.unmount());
    assert.equal(injected(), '');
  });

  it('starts paused under reduced motion and Play resumes it', async () => {
    reducedMotion = true;

    const { container } = await render();
    const button = container.querySelector('button');
    const loader = container.querySelector<HTMLElement>('[role="status"]');

    assert.equal(button?.textContent, 'Play');
    assert.equal(loader?.style.animationPlayState, 'paused');

    await act(async () => button?.click());
    assert.equal(button?.textContent, 'Pause');
    assert.equal(loader?.style.animationPlayState, 'running');
  });

  it('waits for valid CSS without a loader', async () => {
    const { container } = await render('');

    assert.equal(container.querySelector('[role="status"]'), null);
    assert.match(container.textContent ?? '', /Waiting for valid CSS/);
  });
});

describe('first render', () => {
  it('prerenders playing so hydration matches; the preference applies on the client', () => {
    for (const matches of [true, false]) {
      reducedMotion = matches;
      const html = renderToString(<CssLoaderPreview css={css} />);

      assert.equal(html.includes('>Play<'), false, String(matches));
      assert.equal(html.includes('>Pause<'), true, String(matches));
    }

    reducedMotion = false;
  });

  it('pauses after hydration once reduced motion is on', async () => {
    const container = document.body.appendChild(document.createElement('div'));

    container.innerHTML = renderToString(<CssLoaderPreview css={css} />);
    assert.ok(container.querySelector('button')?.textContent?.includes('Pause'));

    reducedMotion = true;

    let root: ReturnType<typeof hydrateRoot> | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, <CssLoaderPreview css={css} />);
      });

      assert.equal(container.querySelector('button')?.textContent, 'Play');

      assert.equal(
        container.querySelector<HTMLElement>('[role="status"]')?.style.animationPlayState,
        'paused',
      );
    } finally {
      reducedMotion = false;
      await act(async () => root?.unmount());
    }
  });
});
