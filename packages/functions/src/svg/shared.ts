/**
 * Skips the XML declaration, comments, processing instructions and a doctype before the root <svg>;
 * a doctype with an internal subset is returned so its entities keep working.
 */
export function splitSvgProlog(source: string): { body: string; doctype?: string } | undefined {
  const prolog = /\s+|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!doctype\b[^[>]*(\[[\s\S]*?\]\s*)?>/iy;
  let index = 0;
  let doctype: string | undefined;

  for (let match = prolog.exec(source); match; match = prolog.exec(source)) {
    if (match[1]) doctype = match[0];

    index = prolog.lastIndex;
  }

  const body = source.slice(index).trimEnd();

  return /^<svg[\s/>]/i.test(body) ? { body, doctype } : undefined;
}
