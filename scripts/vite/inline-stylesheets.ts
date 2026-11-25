const STYLESHEET_LINK = /<link rel="stylesheet" href="([^"]+)"\/>/g;
// Inlined CSS resolves url() against the page; only root-relative, data: and absolute URLs survive.
const RELATIVE_URL = /url\(\s*(?!['"]?(?:[/#]|data:|https?:))/i;

// The link stays (media="print" stops it blocking) so React hydrates the head it rendered.
export function inlineStylesheets(html: string, readStylesheet: (href: string) => string): string {
  return html.replace(STYLESHEET_LINK, (_link, href: string) => {
    const path = href.replace(/#$/, '');
    const css = readStylesheet(path);

    if (/<\/style/i.test(css)) throw new Error(`${path} would close its inline style element.`);
    if (RELATIVE_URL.test(css)) throw new Error(`${path} has a relative url() reference.`);

    return `<style data-inline-href="${path}">${css}</style><link rel="stylesheet" href="${href}" media="print"/>`;
  });
}
