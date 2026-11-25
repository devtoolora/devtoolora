import { describe, expect, it } from 'vitest';
import { routeMeta } from '../src/lib/seo';

describe('routeMeta', () => {
  it('adds absolute og:image, og:url and canonical when an origin is known', () => {
    const meta = routeMeta('T', 'D', '/tools', 'https://example.com');

    expect(meta).toContainEqual({
      property: 'og:image',
      content: 'https://example.com/og-image.png',
    });

    expect(meta).toContainEqual({ property: 'og:url', content: 'https://example.com/tools' });
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' });

    expect(meta).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://example.com/tools',
    });
  });

  it('emits no og:image and keeps twitter:card summary without an origin', () => {
    const meta = routeMeta('T', 'D', '/tools', undefined);

    expect(meta.some((entry) => 'property' in entry && entry.property === 'og:image')).toBe(false);
    expect(meta).toContainEqual({ name: 'twitter:card', content: 'summary' });
  });
});
