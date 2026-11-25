import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { generateWebManifest } from '@devtoolora/functions/web';

const icons =
  '/icons/icon-192.png 192x192 image/png any\n/icons/icon-512.png 512x512 image/png maskable';

describe('web manifest', () => {
  it('writes only the set members', () => {
    const out = generateWebManifest({
      backgroundColor: '#ffffff',
      display: 'standalone',
      icons,
      name: 'Dev Toolora',
      scope: '/',
      shortName: 'Signal',
      startUrl: '/',
      themeColor: '#0f172a',
    });

    assert.deepEqual(JSON.parse(out.json), {
      name: 'Dev Toolora',
      short_name: 'Signal',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#0f172a',
      background_color: '#ffffff',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    });

    assert.equal(out.installable, true);
    assert.equal(out.iconCount, 2);
    assert.deepEqual(out.findings, []);

    assert.deepEqual(
      JSON.parse(
        generateWebManifest({
          categories: 'productivity, utilities',
          dir: 'ltr',
          lang: 'en-US',
          name: 'A',
          orientation: 'portrait',
        }).json,
      ).categories,
      ['productivity', 'utilities'],
    );
  });

  it('infers icon sizes and types and reports installability', () => {
    const out = generateWebManifest({ icons: '/icon-192.png', name: 'A' });

    assert.deepEqual(JSON.parse(out.json).icons, [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ]);

    assert.equal(out.installable, false);

    assert.deepEqual(
      out.findings.map((f) => f.level),
      ['high', 'low'],
    );

    assert.equal(
      generateWebManifest({ name: 'A', shortName: 'A very long short name' }).findings.find(
        (f) => f.level === 'medium',
      )?.message,
      'Short name is longer than 12 characters and may be truncated.',
    );

    assert.ok(
      generateWebManifest({ name: 'A', scope: '/other/', startUrl: '/app/' }).findings.some(
        (f) => f.level === 'medium' && /scope/.test(f.message),
      ),
    );

    assert.ok(
      generateWebManifest({ display: 'browser', name: 'A' }).findings.some(
        (f) => f.level === 'info',
      ),
    );

    assert.ok(
      generateWebManifest({ lang: 'english', name: 'A' }).findings.some(
        (f) => f.level === 'medium' && /BCP 47/.test(f.message),
      ),
    );
  });

  it('parses multiple purposes and sizes', () => {
    const out = generateWebManifest({
      icons:
        '/a.png 192x192 image/png any maskable\n/b.png 192x192 512x512 image/png\n/c.svg any image/svg+xml',
      name: 'A',
    });
    const parsed = JSON.parse(out.json).icons;

    assert.equal(parsed[0].purpose, 'any maskable');
    assert.equal(parsed[1].sizes, '192x192 512x512');
    assert.equal(parsed[1].purpose, undefined);
    assert.equal(parsed[2].sizes, 'any');
    assert.equal(out.installable, true);
    assert.ok(!out.findings.some((f) => /maskable/.test(f.message)));

    assert.ok(
      !generateWebManifest({ name: 'A', scope: '/', startUrl: './index.html' }).findings.some((f) =>
        /scope/.test(f.message),
      ),
    );

    assert.throws(
      () => generateWebManifest({ icons: 'x'.repeat(2001), name: 'A' }),
      /Icons exceed 2,000 characters\./,
    );
  });

  it('validates fields', () => {
    assert.throws(() => generateWebManifest({ name: ' ' }), /Name is required\./);

    assert.throws(
      () => generateWebManifest({ name: 'A', themeColor: 'blueish' }),
      /Theme color "blueish" is not a CSS color\./,
    );

    assert.throws(
      () => generateWebManifest({ display: 'popup', name: 'A' }),
      /Display must be standalone, fullscreen, minimal-ui or browser\./,
    );

    assert.throws(
      () =>
        generateWebManifest({
          icons: Array.from({ length: 51 }, (_, i) => `/i${i}.png`).join('\n'),
          name: 'A',
        }),
      /Icons exceed 50 entries\./,
    );

    assert.throws(
      () => generateWebManifest({ description: 'x'.repeat(2001), name: 'A' }),
      /Description exceeds 2,000 characters\./,
    );
  });
});
