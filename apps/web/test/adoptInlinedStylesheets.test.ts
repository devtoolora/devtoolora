// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  adoptInlinedStylesheets,
  dropOrphanedInlineStyles,
} from '../src/lib/adoptInlinedStylesheets';

function mount(): { link: HTMLLinkElement; style: HTMLStyleElement } {
  document.head.innerHTML =
    '<style data-inline-href="/a.css"></style><link rel="stylesheet" href="/a.css#" media="print">';

  return {
    link: document.head.querySelector('link') as HTMLLinkElement,
    style: document.head.querySelector('style') as HTMLStyleElement,
  };
}

describe('dropOrphanedInlineStyles', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('keeps the inline style while its link is still connected', () => {
    const { style } = mount();

    adoptInlinedStylesheets();
    dropOrphanedInlineStyles();

    expect(style.isConnected).toBe(true);
  });

  it('removes the inline style once its pending link was removed', () => {
    const { link, style } = mount();

    adoptInlinedStylesheets();
    link.remove();
    dropOrphanedInlineStyles();

    expect(style.isConnected).toBe(false);
  });
});
