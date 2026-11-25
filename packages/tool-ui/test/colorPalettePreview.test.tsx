// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { ColorPalettePreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ColorPalettePreview', () => {
  it('shows APCA Lc next to the WCAG ratio', () => {
    const html = renderToString(
      <ColorPalettePreview scheme="complementary" text="#2563eb" valid />,
    );

    assert.match(html, /APCA Lc 74\.9/);
  });

  it('shows a negative Lc for light text on black', () => {
    const html = renderToString(
      <ColorPalettePreview scheme="complementary" text="#ffffff" valid />,
    );

    assert.match(html, /Lc\s*-\d/);
  });

  it('falls back to the browser clipboard when the host copy fails', async () => {
    const copied: string[] = [];

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void copied.push(text) },
    });

    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const platformActions = {
      copyText: async () => {
        throw new Error('no host clipboard');
      },
      saveFile: async () => false,
    };

    await act(async () => {
      root.render(
        <ColorPalettePreview
          platformActions={platformActions}
          scheme="complementary"
          text="#2563eb"
          valid
        />,
      );
    });

    const swatch = container.querySelector<HTMLButtonElement>('[data-palette-token]')!;

    await act(async () => {
      swatch.click();
    });

    assert.equal(copied.length, 1);
    assert.match(container.querySelector('[aria-live="polite"]')?.textContent ?? '', /^Copied #/);

    await act(async () => {
      root.unmount();
    });
  });
});
