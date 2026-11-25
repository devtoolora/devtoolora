import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'JSON-LD is a way to describe a page to search engines with schema.org vocabulary. It lives in a script tag of type application/ld+json, separate from the visible HTML, and powers rich results such as FAQ dropdowns, product prices and breadcrumb trails.',
        'This tool builds the object for five types: Article, Product, Organization, FAQPage and BreadcrumbList. Pick a type, fill in its fields and copy either the ready-to-paste script tag or the bare JSON.',
        'Only the fields you fill in are written. Empty fields are left out instead of emitted as empty strings, and the properties follow the order of the form.',
      ],
      title: 'What is JSON-LD structured data?',
    },
    {
      content: [
        'Use it when you add a new article, product page, company page, FAQ or breadcrumb trail and want valid markup without writing the nested objects by hand.',
        'Article, Product and Organization use the form fields. FAQPage and BreadcrumbList use the text input: FAQ entries are separated by a blank line (first line the question, the rest the answer) and breadcrumbs are one "Name | URL" per line, where the last URL may be omitted.',
        'After generating, paste the block into the page head and test it with a rich results tool. This tool checks the shape and the common recommended properties, not the full schema.org vocabulary.',
      ],
      title: 'When to use JSON-LD Structured Data Generator',
    },
  ],
  examples: [
    'Article with headline, author, date published 2026-10-01 and an image → headline, image, author, datePublished and mainEntityOfPage, 5 properties.',
    'Product KB-1 with price 19.99, currency EUR, availability InStock → an Offer with the availability written as https://schema.org/InStock.',
    'Product with rating value 4.5 and review count 12 → an AggregateRating; the two fields must be given together.',
    'Organization with two profile URLs, one per line → a sameAs array with both addresses.',
    'FAQ text with a question line, two answer lines and a blank line → a Question whose answer text keeps the line break.',
    'Breadcrumbs "Home | https://example.com/" then "This page" → ListItem positions 1 and 2, the last one without an item URL.',
  ],
  faq: [
    {
      answer:
        'Search engines read JSON-LD from a script tag anywhere in the page, and the head is the usual place. The tool writes "</" as "<\\/" inside the JSON so that a value can never close the script tag early.',
      question: 'Where do I put the script tag?',
    },
    {
      answer:
        'The price is kept as the text you type, for example "19.99", because schema.org accepts a string and this avoids number formatting changes. The currency must be a 3-letter ISO 4217 code such as EUR or USD.',
      question: 'How are the price and currency written?',
    },
    {
      answer:
        'Article needs an image and a date published, Product needs an image and an offer, and Organization needs a logo and a URL. Missing ones are reported as low findings, and an Article headline over 110 characters is flagged because search results truncate it.',
      question: 'Which findings does the tool report?',
    },
    {
      answer:
        'Dates must be an ISO 8601 date such as 2026-10-01, or a date-time with a zone such as 2026-10-01T09:00:00Z or +02:00. URLs must be absolute http or https addresses.',
      question: 'Which date and URL formats are accepted?',
    },
  ],
  help: 'Choose the type of structured data and fill in the fields that appear. Name or Headline is required.\n\nFor an FAQ page enter the questions in the text box: first line the question, following lines the answer, and a blank line between entries. For breadcrumbs enter one "Name | URL" per line.\n\nChoose Script tag to get a block you can paste into the page head, or JSON for the bare object. Findings list recommended properties that are missing.\n\nCopy or download the result. Nothing is sent anywhere and the URLs are not visited.',
  notes: [
    'Each field is at most 2,000 characters, an FAQ page at most 500 entries and a breadcrumb list at most 100 items.',
    'Image and profile fields take one absolute http(s) URL per line.',
    'Rating value and review count must be given together or both left empty.',
    'Availability is written as a schema.org URL, for example https://schema.org/InStock.',
    'Dates are validated as ISO 8601; a date-time needs a zone such as Z or +02:00.',
    'The output is not validated against the full schema.org vocabulary; test it with a rich results tool before publishing.',
  ],
};
