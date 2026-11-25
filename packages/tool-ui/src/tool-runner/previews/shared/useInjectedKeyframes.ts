import { useEffect } from 'react';

export function useInjectedKeyframes(frames: string): void {
  // CSP style-src blocks inline <style>; CSSOM insertion is not governed by CSP.
  useEffect(() => {
    if (!frames) return;

    if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in document)) {
      // Older WebKit has no constructable stylesheets; outside the VS Code CSP a <style> element
      // still works.
      const element = document.createElement('style');

      element.textContent = frames;
      document.head.append(element);

      return () => element.remove();
    }

    const sheet = new CSSStyleSheet();

    try {
      sheet.replaceSync(frames);
    } catch {
      return;
    }

    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (candidate) => candidate !== sheet,
      );
    };
  }, [frames]);
}
