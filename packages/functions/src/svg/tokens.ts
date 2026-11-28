export type SvgToken = { index: number; text: string };

const sections = [
  { close: '-->', open: '<!--' },
  { close: ']]>', open: '<![CDATA[' },
  { close: '?>', open: '<?' },
];

/**
 * Splits markup into comments, CDATA sections, processing instructions and tags, exactly as
 * /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<(?:"[^"]*"|'[^']*'|[^'">])*>/g would,
 * in linear time. That regex rescans to the end of the text from every "<" that never closes.
 */
export function* svgTokens(text: string): Generator<SvgToken> {
  const find = createFinder(text);
  const failedTag = new Uint8Array(text.length);

  for (let index = text.indexOf('<'); index !== -1;) {
    const end = sectionEnd(text, index, find) ?? tagEnd(text, index, find, failedTag);

    if (end === undefined) {
      index = text.indexOf('<', index + 1);

      continue;
    }

    yield { index, text: text.slice(index, end) };
    index = text.indexOf('<', end);
  }
}

function sectionEnd(
  text: string,
  index: number,
  find: (term: string, from: number) => number,
): number | undefined {
  for (const { close, open } of sections) {
    if (!text.startsWith(open, index)) continue;

    const at = find(close, index + open.length);

    if (at !== -1) return at + close.length;
  }

  return undefined;
}

/**
 * Ends the tag at its first ">" outside quotes. A start that fails marks the unquoted positions it
 * crossed: any later start that reaches one of them continues identically and fails too.
 */
function tagEnd(
  text: string,
  index: number,
  find: (term: string, from: number) => number,
  failedTag: Uint8Array,
): number | undefined {
  const crossed: number[] = [];

  for (let at = index + 1; at < text.length && failedTag[at] === 0; at += 1) {
    const char = text[at]!;

    crossed.push(at);

    if (char === '>') return at + 1;
    if (char !== '"' && char !== "'") continue;

    const close = find(char, at + 1);

    if (close === -1) break;

    at = close;
  }

  for (const at of crossed) failedTag[at] = 1;

  return undefined;
}

/** indexOf that remembers its last answer per term, so repeated searches do not rescan the text. */
function createFinder(text: string): (term: string, from: number) => number {
  const cache = new Map<string, { at: number; from: number }>();

  return (term, from) => {
    const last = cache.get(term);

    if (last && from >= last.from && (last.at === -1 || last.at >= from)) return last.at;

    const at = text.indexOf(term, from);

    cache.set(term, { at, from });

    return at;
  };
}
