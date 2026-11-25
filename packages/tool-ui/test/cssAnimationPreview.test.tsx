// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { CssAnimationPreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let reducedMotion = false;

// jsdom has no matchMedia; the component reads the reduced-motion preference through it.
window.matchMedia = () =>
  ({
    addEventListener() {},
    matches: reducedMotion,
    removeEventListener() {},
  }) as unknown as MediaQueryList;

const css =
  '@keyframes pulse {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n\n.element { animation: pulse 1s ease infinite; }';

describe('CssAnimationPreview', () => {
  it('injects the keyframes through CSSOM instead of a <style> element (blocked by the VS Code CSP)', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () => {
      root.render(<CssAnimationPreview css={css} />);
    });

    assert.equal(document.querySelector('style'), null);
    const card = container.querySelector<HTMLElement>('[data-css-preview="keyframes"]');

    assert.match(card?.style.animation ?? '', /motion-preview-/);
    assert.equal(document.adoptedStyleSheets.length, 1);

    assert.match(
      [...(document.adoptedStyleSheets[0]?.cssRules ?? [])].map((rule) => rule.cssText).join(),
      /@keyframes motion-preview-/,
    );

    await act(async () => {
      root.unmount();
    });

    assert.equal(document.adoptedStyleSheets.length, 0);
  });
});

describe('first render', () => {
  it('prerenders playing so hydration matches; the preference applies on the client', () => {
    for (const matches of [true, false]) {
      reducedMotion = matches;
      const html = renderToString(<CssAnimationPreview css="" />);

      assert.equal(html.includes('>Play<'), false, String(matches));
      assert.equal(html.includes('>Pause<'), true, String(matches));
    }

    reducedMotion = false;
  });
});
