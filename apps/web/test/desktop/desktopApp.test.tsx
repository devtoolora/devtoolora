// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopSettingsModal } from '../../src/features/desktop/components/desktop-settings-modal/DesktopSettingsModal';
import { usePrefersLight } from '../../src/features/desktop/hooks/usePrefersLight';
import { DEFAULT_DESKTOP_SETTINGS } from '../../src/features/desktop/utils/desktopSettings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.unstubAllGlobals());

function fakeColorScheme(light: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    matches: light,
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };

  vi.stubGlobal('matchMedia', () => media);

  return (next: boolean) => {
    media.matches = next;
    listeners.forEach((listener) => listener());
  };
}

describe('desktop theme and settings', () => {
  it('follows the OS color scheme while the app is open', async () => {
    const setLight = fakeColorScheme(false);
    const seen: boolean[] = [];

    function Probe() {
      seen.push(usePrefersLight());

      return null;
    }

    const root = createRoot(document.createElement('div'));

    await act(async () => root.render(<Probe />));
    expect(seen.at(-1)).toBe(false);

    await act(async () => setLight(true));
    expect(seen.at(-1)).toBe(true);

    await act(async () => root.unmount());
  });

  it('closes only when both press and release land on the backdrop', async () => {
    fakeColorScheme(false);

    HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
      this.open = true;
    };

    const onClose = vi.fn();
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <DesktopSettingsModal
          isOpen
          settings={DEFAULT_DESKTOP_SETTINGS}
          onClearRecent={() => {}}
          onClose={onClose}
          onResetAppearance={() => {}}
          onUpdateSetting={() => {}}
        />,
      ),
    );

    const dialog = container.querySelector('dialog')!;
    const heading = dialog.querySelector('h2')!;
    const press = (target: Element) =>
      target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const release = () => dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await act(async () => {
      press(heading);
      release();
    });

    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      press(dialog);
      release();
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });
});
