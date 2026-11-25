import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateJsonLd, wrapJsonLdScript } from '../src/web/jsonLd';

describe('json-ld', () => {
  it('builds an Article', () => {
    const out = generateJsonLd(
      'Article',
      {
        author: 'Ada',
        datePublished: '2026-10-01',
        headline: 'Verifying JWTs',
        images: 'https://example.com/a.png',
        url: 'https://example.com/a',
      },
      '',
    );

    assert.deepEqual(JSON.parse(out.json), {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Verifying JWTs',
      image: ['https://example.com/a.png'],
      author: { '@type': 'Person', name: 'Ada' },
      datePublished: '2026-10-01',
      mainEntityOfPage: 'https://example.com/a',
    });

    assert.equal(out.propertyCount, 5);
    assert.deepEqual(out.findings, []);

    assert.deepEqual(
      generateJsonLd('Article', { headline: 'x'.repeat(111) }, '').findings.map((f) => f.level),
      ['low', 'low', 'low'],
    );

    assert.deepEqual(
      JSON.parse(
        generateJsonLd(
          'Article',
          { headline: 'H', publisherLogo: 'https://e.example/l.png', publisherName: 'E' },
          '',
        ).json,
      ).publisher,
      {
        '@type': 'Organization',
        name: 'E',
        logo: { '@type': 'ImageObject', url: 'https://e.example/l.png' },
      },
    );
  });

  it('builds a Product, an Organization, a FAQPage and a BreadcrumbList', () => {
    const product = JSON.parse(
      generateJsonLd(
        'Product',
        {
          availability: 'InStock',
          currency: 'EUR',
          name: 'KB-1',
          price: '19.99',
          ratingValue: '4.5',
          reviewCount: '12',
        },
        '',
      ).json,
    );

    assert.deepEqual(product.offers, {
      '@type': 'Offer',
      price: '19.99',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    });

    assert.deepEqual(product.aggregateRating, {
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: '12',
    });

    assert.deepEqual(
      JSON.parse(
        generateJsonLd(
          'Organization',
          {
            name: 'Acme',
            sameAs: 'https://x.example/acme\nhttps://y.example/acme',
            url: 'https://acme.example',
          },
          '',
        ).json,
      ).sameAs,
      ['https://x.example/acme', 'https://y.example/acme'],
    );

    const faq = JSON.parse(
      generateJsonLd('FAQPage', {}, 'What is it?\nA tool.\nOffline.\n\nIs it free?\nYes.').json,
    );

    assert.equal(faq.mainEntity.length, 2);

    assert.deepEqual(faq.mainEntity[0], {
      '@type': 'Question',
      name: 'What is it?',
      acceptedAnswer: { '@type': 'Answer', text: 'A tool.\nOffline.' },
    });

    const crumbs = JSON.parse(
      generateJsonLd(
        'BreadcrumbList',
        {},
        'Home | https://example.com/\nDocs | https://example.com/docs\nThis page',
      ).json,
    );

    assert.deepEqual(crumbs.itemListElement[2], {
      '@type': 'ListItem',
      position: 3,
      name: 'This page',
    });

    assert.deepEqual(crumbs.itemListElement[0], {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://example.com/',
    });
  });

  it('validates fields', () => {
    assert.throws(
      () => generateJsonLd('Product', { name: 'x', ratingValue: '4' }, ''),
      /Rating value and review count must be given together\./,
    );

    assert.throws(
      () => generateJsonLd('Product', { currency: 'EU', name: 'x', price: '1' }, ''),
      /Currency must be a 3-letter ISO 4217 code\./,
    );

    assert.throws(
      () => generateJsonLd('Article', { datePublished: 'yesterday', headline: 'x' }, ''),
      /Date published must be an ISO 8601 date or date-time\./,
    );

    assert.throws(
      () => generateJsonLd('Article', { headline: 'x', url: 'example.com' }, ''),
      /URL must be an absolute http\(s\) URL\./,
    );

    assert.throws(() => generateJsonLd('Article', {}, ''), /Headline is required\./);
    assert.throws(() => generateJsonLd('FAQPage', {}, ' '), /At least one question is required\./);

    assert.throws(
      () => generateJsonLd('FAQPage', {}, 'Only a question?'),
      /Entry 1 needs an answer line\./,
    );

    assert.throws(
      () => generateJsonLd('BreadcrumbList', {}, 'Home | nope'),
      /Line 1: "nope" is not an absolute http\(s\) URL\./,
    );

    assert.throws(
      () => generateJsonLd('Recipe', {}, ''),
      /Type must be Article, Product, Organization, FAQPage or BreadcrumbList\./,
    );

    assert.throws(
      () => generateJsonLd('Article', { headline: 'x'.repeat(2001) }, ''),
      /Headline exceeds 2,000 characters\./,
    );

    assert.throws(
      () =>
        generateJsonLd(
          'FAQPage',
          {},
          Array.from({ length: 501 }, (_, i) => `Q${i}?\nA`).join('\n\n'),
        ),
      /FAQ entries exceed 500\./,
    );

    assert.equal(
      wrapJsonLdScript('{"a":"</script>"}'),
      '<script type="application/ld+json">\n{"a":"\\u003c/script>"}\n</script>',
    );
  });

  it('rejects impossible dates and bad numbers, escapes script openers, keeps pipes', () => {
    assert.throws(
      () => generateJsonLd('Article', { datePublished: '2026-02-30', headline: 'x' }, ''),
      /Date published must be an ISO 8601 date or date-time\./,
    );

    assert.throws(
      () => generateJsonLd('Product', { name: 'x', ratingValue: '6', reviewCount: '1' }, ''),
      /Rating value must be a number from 0 to 5\./,
    );

    assert.throws(
      () => generateJsonLd('Product', { name: 'x', ratingValue: '4', reviewCount: '1.5' }, ''),
      /Review count must be a whole number\./,
    );

    assert.throws(
      () => generateJsonLd('Product', { availability: 'Maybe', name: 'x' }, ''),
      /Availability must be one of InStock, OutOfStock, PreOrder, BackOrder, Discontinued or SoldOut\./,
    );

    assert.throws(
      () =>
        generateJsonLd(
          'Article',
          { headline: 'x', images: 'https://a.example/\n'.repeat(120) },
          '',
        ),
      /Images exceeds 2,000 characters\./,
    );

    assert.doesNotMatch(wrapJsonLdScript('{"a":"<!--<script"}'), /<!--/);

    assert.deepEqual(
      JSON.parse(generateJsonLd('BreadcrumbList', {}, 'A | B | https://e.example/').json)
        .itemListElement[0].name,
      'A | B',
    );
  });
});
