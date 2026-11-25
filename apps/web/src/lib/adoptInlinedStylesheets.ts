// A detached link no longer sits next to its style, so the pairing is remembered here.
const pending = new Map<HTMLStyleElement, HTMLLinkElement>();

// Hands inlined route CSS back to its `media="print"` link, so React Router can remove it on
// navigation as it would without inlining.
export function adoptInlinedStylesheets(): void {
  for (const style of document.querySelectorAll<HTMLStyleElement>('style[data-inline-href]')) {
    const link = style.nextElementSibling;

    if (!(link instanceof HTMLLinkElement) || link.media !== 'print') continue;
    if (link.getAttribute('href')?.replace(/#$/, '') !== style.dataset.inlineHref) continue;

    link.media = 'all';

    // A link that fails to load never fires `load`, so its inline copy stays.
    if (link.sheet) style.remove();
    else {
      pending.set(style, link);

      link.addEventListener(
        'load',
        () => {
          pending.delete(style);
          style.remove();
        },
        { once: true },
      );
    }
  }
}

export function dropOrphanedInlineStyles(): void {
  for (const [style, link] of pending) {
    if (link.isConnected) continue;

    pending.delete(style);
    style.remove();
  }
}
