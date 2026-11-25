import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildUtmLink, renderUtmReport } from '@devtoolora/functions/web';

describe('utm', () => {
  it('appends utm parameters and keeps the rest of the URL', () => {
    const report = buildUtmLink({
      campaign: 'Spring Sale',
      lowercase: true,
      medium: 'email',
      source: 'Newsletter',
      url: 'https://example.com/page?ref=1#top',
    });

    assert.equal(
      report.url,
      'https://example.com/page?ref=1&utm_source=newsletter&utm_medium=email&utm_campaign=spring+sale#top',
    );

    assert.deepEqual(report.parameters, [
      { name: 'utm_source', value: 'newsletter' },
      { name: 'utm_medium', value: 'email' },
      { name: 'utm_campaign', value: 'spring sale' },
    ]);

    assert.deepEqual(report.findings, [
      { level: 'info', message: 'Spaces in utm_campaign are encoded as "+".' },
    ]);

    assert.equal(
      buildUtmLink({ source: 'new', url: 'https://example.com/?utm_source=old&x=1' }).url,
      'https://example.com/?x=1&utm_source=new',
    );

    assert.equal(
      buildUtmLink({ source: 'new', url: 'https://example.com/?utm_source=old' }).findings.find(
        (f) => f.level === 'info',
      )?.message,
      'Replaced the existing utm_source.',
    );

    assert.ok(
      buildUtmLink({
        lowercase: false,
        source: 'Newsletter',
        url: 'https://example.com/',
      }).findings.some((f) => f.level === 'low' && /case-sensitive/.test(f.message)),
    );

    assert.equal(
      buildUtmLink({ source: 'x', url: 'https://example.com/' }).findings.filter(
        (f) => f.level === 'low',
      ).length,
      2,
    );

    assert.equal(
      buildUtmLink({
        campaign: 'k',
        content: 'c',
        id: 'i',
        medium: 'm',
        source: 's',
        term: 't',
        url: 'https://example.com/',
      })
        .parameters.map((p) => p.name)
        .join(','),
      'utm_source,utm_medium,utm_campaign,utm_term,utm_content,utm_id',
    );
  });

  it('keeps other query parameters verbatim', () => {
    assert.equal(
      buildUtmLink({ source: 'x', url: 'https://example.com/?q=a%20b&flag&r=/p' }).url,
      'https://example.com/?q=a%20b&flag&r=/p&utm_source=x',
    );

    const replaced = buildUtmLink({ source: 'new', url: 'https://example.com/?UTM_SOURCE=old' });

    assert.equal(replaced.url, 'https://example.com/?utm_source=new');
    assert.ok(replaced.findings.some((f) => f.message === 'Replaced the existing utm_source.'));

    const kept = buildUtmLink({ source: 'x', url: 'https://example.com/?utm_medium=cpc' });

    assert.deepEqual(kept.parameters[1], { name: 'utm_medium', value: 'cpc' });
    assert.ok(!kept.findings.some((f) => f.message === 'utm_medium is recommended.'));
  });

  it('renders the report', () => {
    const text = renderUtmReport(
      buildUtmLink({ medium: 'm', campaign: 'c', source: 's', url: 'https://example.com/' }),
    );

    assert.equal(
      text,
      'https://example.com/?utm_source=s&utm_medium=m&utm_campaign=c\n\nutm_source = s\nutm_medium = m\nutm_campaign = c\n\n# Findings\nNo findings.',
    );

    assert.match(
      renderUtmReport(buildUtmLink({ source: 's', url: 'https://example.com/' })),
      /\n\n# Findings\n\[LOW\] utm_medium is recommended\./,
    );
  });

  it('validates its input', () => {
    assert.throws(
      () => buildUtmLink({ source: 'x', url: 'example.com' }),
      /URL must be an absolute http\(s\) URL\./,
    );

    assert.throws(
      () => buildUtmLink({ source: ' ', url: 'https://example.com/' }),
      /Source is required\./,
    );

    assert.throws(
      () => buildUtmLink({ source: 'x', url: `https://example.com/${'a'.repeat(8_192)}` }),
      /URL exceeds 8,192 characters\./,
    );

    assert.throws(
      () => buildUtmLink({ source: 'x', term: 'a'.repeat(501), url: 'https://example.com/' }),
      /Term exceeds 500 characters\./,
    );
  });
});
