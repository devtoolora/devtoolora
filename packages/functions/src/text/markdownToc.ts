import MarkdownIt, { type Token } from 'markdown-it';
import { FunctionError } from '../errors/FunctionError';

export type TocOptions = { bullet: '*' | '-' | 'ordered'; maxLevel: number; minLevel: number };

type Heading = { level: number; rendered: string; source: string };

const maxChars = 1_000_000;

// Patterns exclude their own delimiters inside, so each start scans a bounded run.
function plainText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .join(' ')
    .replace(/!?\[([^[\]]*)\]\([^()]*\)/g, '$1')
    .replace(/<[A-Za-z/!][^<>]*>/g, '')
    .trim();
}

export function githubSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
    .replace(/ /g, '-');
}

/** The github-slugger suffix rule: skips a suffix another heading's anchor already uses. */
export function uniqueSlug(base: string, seen: Map<string, number>): string {
  let slug = base;

  while (seen.has(slug)) {
    const count = (seen.get(base) ?? 0) + 1;

    seen.set(base, count);
    slug = `${base}-${count}`;
  }

  seen.set(slug, 0);

  return slug;
}

export function inlineText(inline: Token | undefined): string {
  return (inline?.children ?? [])
    .map((child) => {
      if (child.type === 'softbreak' || child.type === 'hardbreak') return ' ';

      return ['code_inline', 'image', 'text'].includes(child.type) ? child.content : '';
    })
    .join('')
    .trim();
}

export function frontMatterEnd(lines: string[]): number {
  if (lines[0] !== '---') return -1;

  return lines.findIndex((line, index) => index > 0 && line === '---');
}

function collectHeadings(markdown: string): Heading[] {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const body = lines.slice(frontMatterEnd(lines) + 1).join('\n');
  const tokens = new MarkdownIt('commonmark', { html: true, maxNesting: 64 }).parse(body, {});

  return tokens.flatMap((token, index) => {
    if (token.type !== 'heading_open') return [];

    const inline = tokens[index + 1];

    return [
      {
        level: Number(token.tag.slice(1)),
        rendered: inlineText(inline),
        source: inline?.content ?? '',
      },
    ];
  });
}

function escapeLabel(label: string): string {
  return label.replace(/\\[!-/:-@[-`{-~]|[\\[\]]/g, (match) =>
    match.length === 2 ? match : `\\${match}`,
  );
}

export function markdownToc(
  markdown: string,
  options: TocOptions,
): { headings: number; text: string } {
  if (markdown.length > maxChars)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 characters.');

  if (options.minLevel > options.maxLevel)
    throw new FunctionError('INVALID_TEXT', 'Minimum level must not exceed maximum level.');

  const seen = new Map<string, number>();
  const entries: { label: string; level: number; slug: string }[] = [];

  for (const heading of collectHeadings(markdown)) {
    const label = plainText(heading.source);
    const slug = uniqueSlug(githubSlug(heading.rendered), seen);

    if (label && heading.level >= options.minLevel && heading.level <= options.maxLevel)
      entries.push({ label, level: heading.level, slug });
  }

  const top = entries.reduce((min, entry) => Math.min(min, entry.level), 6);
  const width = options.bullet === 'ordered' ? 3 : 2;
  const marker = options.bullet === 'ordered' ? '1.' : options.bullet;
  const lines = entries.map(
    (entry) =>
      `${' '.repeat((entry.level - top) * width)}${marker} [${escapeLabel(entry.label)}](#${entry.slug})`,
  );

  return { headings: entries.length, text: lines.join('\n') };
}
