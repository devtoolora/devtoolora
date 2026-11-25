import { FunctionError } from '../errors';

export type MetaTagsOptions = {
  description: string;
  image?: string;
  imageAlt?: string;
  locale?: string;
  robots?: string;
  siteName?: string;
  title: string;
  twitterCard?: string;
  twitterSite?: string;
  type?: string;
  url?: string;
};

export type MetaTagsReport = {
  html: string;
  preview: string;
  suggestions: string[];
};

export const metaTagLimits = {
  description: 160,
  descriptionMinimum: 50,
  title: 60,
  titleMinimum: 10,
};

const pageTypes = new Set([
  'article',
  'book',
  'music.song',
  'product',
  'profile',
  'video.movie',
  'video.other',
  'website',
]);
const robotsValues = new Set([
  'index, follow',
  'index, nofollow',
  'noindex, follow',
  'noindex, nofollow',
]);

export function buildMetaTags(options: MetaTagsOptions): MetaTagsReport {
  const title = singleLine(options.title, 'Title', 300);
  const description = singleLine(options.description, 'Description', 1000);
  const suggestions: string[] = [];
  const url = options.url?.trim() ? absoluteUrl(options.url.trim(), 'Page URL') : undefined;
  const image = resolveMetaImage(options.image, url, suggestions);

  const type = options.type?.trim() || 'website';

  if (!pageTypes.has(type)) throw metaError(`og:type "${type}" is not a standard Open Graph type.`);

  const robots = options.robots?.trim() || 'index, follow';

  if (!robotsValues.has(robots))
    throw metaError('Robots must be index or noindex, follow or nofollow.');

  const card = options.twitterCard?.trim() || (image ? 'summary_large_image' : 'summary');

  if (card !== 'summary' && card !== 'summary_large_image')
    throw metaError('The X card must be summary or summary_large_image.');

  const siteName = options.siteName?.trim()
    ? singleLine(options.siteName, 'Site name', 200)
    : undefined;
  const imageAlt = options.imageAlt?.trim()
    ? singleLine(options.imageAlt, 'Image alt text', 420)
    : undefined;
  const twitterSite = options.twitterSite?.trim() ? twitterHandle(options.twitterSite) : undefined;
  const locale = options.locale?.trim() || undefined;

  if (locale && !/^[a-z]{2,3}_[A-Z]{2}$/.test(locale))
    throw metaError('og:locale uses language_TERRITORY, such as en_US or cs_CZ.');

  suggestions.push(...metaSuggestions({ card, description, image, imageAlt, title, url }));

  const html = metaTagsHtml({
    card,
    description,
    image,
    imageAlt,
    locale,
    robots,
    siteName,
    title,
    twitterSite,
    type,
    url,
  });

  return {
    html,
    preview: previewSvg({ card, description, image, siteName, title, url }),
    suggestions,
  };
}

function resolveMetaImage(
  rawImage: string | undefined,
  url: string | undefined,
  suggestions: string[],
): string | undefined {
  if (!rawImage?.trim()) return undefined;

  const raw = rawImage.trim();

  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) return absoluteUrl(raw, 'Image URL');
  if (!url)
    throw metaError(
      'og:image needs an absolute URL such as https://example.com/og.png, or a page URL to resolve a relative path against.',
    );

  const image = new URL(raw, url).href;

  suggestions.push(`The relative image path was resolved against the page URL: ${image}.`);

  return image;
}

type MetaSuggestionInput = {
  card: string;
  description: string;
  image?: string;
  imageAlt?: string;
  title: string;
  url?: string;
};

function metaSuggestions(input: MetaSuggestionInput): string[] {
  const { card, description, image, imageAlt, title, url } = input;
  const suggestions: string[] = [];
  const titleLength = [...title].length;
  const descriptionLength = [...description].length;

  if (titleLength > metaTagLimits.title)
    suggestions.push(
      `The title is ${characters(titleLength)}; search results usually cut titles after about ${metaTagLimits.title}.`,
    );
  if (titleLength < metaTagLimits.titleMinimum)
    suggestions.push(
      `The title is only ${characters(titleLength)}; a descriptive title of 30–60 characters works better.`,
    );
  if (descriptionLength > metaTagLimits.description)
    suggestions.push(
      `The description is ${characters(descriptionLength)}; snippets usually cut after about ${metaTagLimits.description}.`,
    );
  if (descriptionLength < metaTagLimits.descriptionMinimum)
    suggestions.push(
      `The description is only ${characters(descriptionLength)}; aim for 70–160 so search engines are less likely to replace it.`,
    );
  if (!url)
    suggestions.push(
      'Add the page URL: og:url and rel="canonical" tell platforms which address to show and count shares for.',
    );
  else if (url.startsWith('http:'))
    suggestions.push('The page URL uses http; use the https address if the site has one.');
  else if (/[?#]/.test(url))
    suggestions.push(
      'The page URL has a query or fragment; canonical URLs usually leave out tracking parameters.',
    );
  if (!image)
    suggestions.push(
      'Add an image: without og:image most platforms show a small text-only card. 1200×630 pixels suits large cards.',
    );
  else if (!imageAlt)
    suggestions.push('Add image alt text so screen readers can describe the preview image.');
  if (card === 'summary_large_image' && !image)
    suggestions.push(
      'summary_large_image needs an image; X falls back to a small card without one.',
    );

  return suggestions;
}

type MetaHtmlInput = MetaSuggestionInput & {
  locale?: string;
  robots: string;
  siteName?: string;
  twitterSite?: string;
  type: string;
};

function metaTagsHtml(input: MetaHtmlInput): string {
  const { card, description, image, imageAlt, locale, robots, siteName, title } = input;
  const { twitterSite, type, url } = input;
  const line = (tag: string) => `${tag}\n`;

  return [
    '<!-- Search -->\n',
    line(`<title>${escapeHtml(title)}</title>`),
    line(`<meta name="description" content="${escapeHtml(description)}">`),
    url ? line(`<link rel="canonical" href="${escapeHtml(url)}">`) : '',
    robots !== 'index, follow' ? line(`<meta name="robots" content="${robots}">`) : '',
    '\n<!-- Open Graph: Facebook, LinkedIn, Slack, Discord, WhatsApp -->\n',
    line(`<meta property="og:type" content="${type}">`),
    url ? line(`<meta property="og:url" content="${escapeHtml(url)}">`) : '',
    line(`<meta property="og:title" content="${escapeHtml(title)}">`),
    line(`<meta property="og:description" content="${escapeHtml(description)}">`),
    siteName ? line(`<meta property="og:site_name" content="${escapeHtml(siteName)}">`) : '',
    locale ? line(`<meta property="og:locale" content="${locale}">`) : '',
    image ? line(`<meta property="og:image" content="${escapeHtml(image)}">`) : '',
    image && imageAlt
      ? line(`<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`)
      : '',
    '\n<!-- X (Twitter); title, description and image fall back to Open Graph -->\n',
    line(`<meta name="twitter:card" content="${card}">`),
    twitterSite ? line(`<meta name="twitter:site" content="${escapeHtml(twitterSite)}">`) : '',
    image && imageAlt
      ? line(`<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">`)
      : '',
  ]
    .join('')
    .trimEnd();
}

type PreviewOptions = {
  card: string;
  description: string;
  image?: string;
  siteName?: string;
  title: string;
  url?: string;
};

function previewSvg(options: PreviewOptions): string {
  const width = 640;
  const host = options.url ? new URL(options.url).host : 'example.com';
  const path = options.url
    ? new URL(options.url).pathname.split('/').filter(Boolean).map(decodeSafe)
    : [];
  const parts: string[] = [];
  let y = 28;

  parts.push(label(24, y, 'Search result'));
  y += 26;

  parts.push(
    `<circle cx="38" cy="${y + 2}" r="12" fill="#e8eaed"/><text x="38" y="${y + 6}" font-size="11" text-anchor="middle" fill="#5f6368">${escapeHtml(host.slice(0, 1).toUpperCase())}</text>`,
  );

  parts.push(
    `<text x="58" y="${y - 2}" font-size="13" fill="#202124">${escapeHtml(fit(options.siteName ?? host, 13, 520))}</text>`,
  );

  parts.push(
    `<text x="58" y="${y + 14}" font-size="12" fill="#4d5156">${escapeHtml(fit([`https://${host}`, ...path].join(' › '), 12, 520))}</text>`,
  );

  y += 44;

  parts.push(
    `<text x="24" y="${y}" font-size="20" fill="#1a0dab">${escapeHtml(fit(options.title, 20, 592))}</text>`,
  );

  y += 24;

  for (const text of wrap(options.description, 14, 592, 2)) {
    parts.push(`<text x="24" y="${y}" font-size="14" fill="#4d5156">${escapeHtml(text)}</text>`);
    y += 21;
  }

  y += 24;

  parts.push(
    label(
      24,
      y,
      options.card === 'summary' ? 'Link card (small image)' : 'Link card (large image)',
    ),
  );

  y += 14;
  const cardWidth = width - 48;

  y +=
    options.card === 'summary'
      ? summaryCardSvg(parts, { cardWidth, host, options, y })
      : largeCardSvg(parts, { cardWidth, host, options, y });

  const height = y + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Arial, Helvetica, sans-serif"><rect width="${width}" height="${height}" rx="16" fill="#f6f8fa"/>${parts.join('')}</svg>`;
}

type CardLayout = { cardWidth: number; host: string; options: PreviewOptions; y: number };

function summaryCardSvg(parts: string[], { cardWidth, host, options, y }: CardLayout): number {
  const cardHeight = 124;

  parts.push(
    `<rect x="24" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#ffffff" stroke="#d0d7de"/>`,
  );

  parts.push(imageBox(25, y + 1, cardHeight - 2, cardHeight - 2, options.image, '12 0 0 12'));
  const textX = 24 + cardHeight + 16;
  const textWidth = cardWidth - cardHeight - 32;

  parts.push(
    `<text x="${textX}" y="${y + 32}" font-size="12" fill="#57606a">${escapeHtml(fit(host, 12, textWidth))}</text>`,
  );

  parts.push(
    `<text x="${textX}" y="${y + 56}" font-size="15" font-weight="700" fill="#1f2328">${escapeHtml(fit(options.title, 15, textWidth))}</text>`,
  );

  wrap(options.description, 13, textWidth, 2).forEach((text, index) =>
    parts.push(
      `<text x="${textX}" y="${y + 80 + index * 19}" font-size="13" fill="#57606a">${escapeHtml(text)}</text>`,
    ),
  );

  return cardHeight;
}

function largeCardSvg(parts: string[], { cardWidth, host, options, y }: CardLayout): number {
  const imageHeight = Math.round(cardWidth / 1.91);
  const cardHeight = imageHeight + 92;

  parts.push(
    `<rect x="24" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#ffffff" stroke="#d0d7de"/>`,
  );

  parts.push(imageBox(25, y + 1, cardWidth - 2, imageHeight, options.image, 'top'));

  parts.push(
    `<text x="40" y="${y + imageHeight + 26}" font-size="12" fill="#57606a">${escapeHtml(fit(host.toUpperCase(), 12, cardWidth - 32))}</text>`,
  );

  parts.push(
    `<text x="40" y="${y + imageHeight + 50}" font-size="16" font-weight="700" fill="#1f2328">${escapeHtml(fit(options.title, 16, cardWidth - 32))}</text>`,
  );

  parts.push(
    `<text x="40" y="${y + imageHeight + 73}" font-size="14" fill="#57606a">${escapeHtml(fit(options.description, 14, cardWidth - 32))}</text>`,
  );

  return cardHeight;
}

function imageBox(
  x: number,
  y: number,
  width: number,
  height: number,
  image: string | undefined,
  corners: string,
): string {
  const clip =
    corners === 'top'
      ? `M${x} ${y + 11}a11 11 0 0 1 11-11h${width - 22}a11 11 0 0 1 11 11v${height - 11}h-${width}z`
      : `M${x} ${y + 11}a11 11 0 0 1 11-11h${width - 11}v${height}h-${width - 11}a11 11 0 0 1-11-11z`;
  const caption = image ? fit(image.replace(/^https?:\/\//, ''), 12, width - 24) : 'No og:image';

  return `<path d="${clip}" fill="${image ? '#dbe4ee' : '#eef1f4'}"/><text x="${x + width / 2}" y="${y + height / 2 - 4}" font-size="${width > 200 ? 15 : 12}" text-anchor="middle" fill="#57606a">${image ? 'og:image' : ''}</text><text x="${x + width / 2}" y="${y + height / 2 + 16}" font-size="12" text-anchor="middle" fill="#6e7781">${escapeHtml(caption)}</text>`;
}

function label(x: number, y: number, text: string): string {
  return `<text x="${x}" y="${y}" font-size="11" font-weight="700" letter-spacing="0.8" fill="#6e7781">${escapeHtml(text.toUpperCase())}</text>`;
}

function fit(text: string, size: number, width: number): string {
  if (measure(text, size) <= width) return text;

  let result = '';

  for (const character of text) {
    if (measure(`${result}${character}…`, size) > width) break;

    result += character;
  }

  return `${result.trimEnd()}…`;
}

function wrap(text: string, size: number, width: number, lines: number): string[] {
  const output: string[] = [];
  let current = '';
  const words = text.split(/\s+/).filter(Boolean);

  for (const [index, word] of words.entries()) {
    const candidate = current ? `${current} ${word}` : word;

    if (measure(candidate, size) <= width) {
      current = candidate;

      continue;
    }

    if (output.length === lines - 1) {
      output.push(fit(`${candidate} ${words.slice(index + 1).join(' ')}`.trim(), size, width));

      return output;
    }

    if (current) output.push(current);

    current = measure(word, size) > width ? fit(word, size, width) : word;
  }

  if (current) output.push(current);

  return output.slice(0, lines);
}

/** Approximate Arial advance widths, close enough to show where platforms truncate. */
function measure(text: string, size: number): number {
  let units = 0;

  for (const character of text) {
    if (/[iljI.,:;'|!]/.test(character)) units += 0.28;
    else if (/[ frt()[\]\-]/.test(character)) units += 0.36;
    else if (/[mwMW]/.test(character)) units += 0.86;
    else if (/[A-Z]/.test(character)) units += 0.68;
    else if (/[　-鿿가-힯]/.test(character)) units += 1;
    else units += 0.55;
  }

  return units * size;
}

function absoluteUrl(value: string, label: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw metaError(`${label} must be an absolute URL such as https://example.com/page.`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    throw metaError(`${label} must start with https:// or http://.`);

  return parsed.href;
}

function twitterHandle(value: string): string {
  const handle = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, '')
    .replace(/^@?/, '@');

  if (!/^@\w{1,15}$/.test(handle))
    throw metaError(
      'The X account must be a handle such as @example (letters, digits and _ only, up to 15).',
    );

  return handle;
}

function singleLine(value: string, label: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();

  if (!text) throw metaError(`${label} input is required.`);
  if ([...text].length > max) throw metaError(`${label} must be at most ${max} characters.`);

  return text;
}

function characters(count: number): string {
  return `${count} ${count === 1 ? 'character' : 'characters'}`;
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function metaError(message: string): FunctionError {
  return new FunctionError('INVALID_WEB_INPUT', message);
}
