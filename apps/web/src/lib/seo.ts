import type { MetaDescriptor } from 'react-router';

declare const __SITE_URL__: string | undefined;

const siteUrl = typeof __SITE_URL__ === 'undefined' ? undefined : __SITE_URL__;

export function routeMeta(
  title: string,
  description: string,
  path: string,
  origin: string | undefined = siteUrl,
): MetaDescriptor[] {
  const meta: MetaDescriptor[] = [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    // Open Graph needs an absolute image URL, so the card only exists when the origin is known.
    { name: 'twitter:card', content: origin ? 'summary_large_image' : 'summary' },
  ];

  if (origin) {
    const url = `${origin}${path}`;

    meta.push(
      { property: 'og:url', content: url },
      { property: 'og:image', content: `${origin}/og-image.png` },
      { tagName: 'link', rel: 'canonical', href: url },
    );
  }

  return meta;
}
