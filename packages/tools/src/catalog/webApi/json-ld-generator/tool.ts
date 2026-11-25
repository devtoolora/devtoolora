import { ToolDefinition, ToolField } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const article = ['Article'];
const shared = ['Article', 'Product', 'Organization'];
const product = ['Product'];
const organization = ['Organization'];
const named = ['Product', 'Organization'];

// [id, label, visible types, required]
const textFields: Array<[string, string, string[], boolean?]> = [
  ['headline', 'Headline', article, true],
  ['description', 'Description', shared],
  ['images', 'Images (one per line)', shared],
  ['author', 'Author', article],
  ['publisherName', 'Publisher name', article],
  ['publisherLogo', 'Publisher logo URL', article],
  ['datePublished', 'Date published', article],
  ['dateModified', 'Date modified', article],
  ['url', 'URL', shared],
  ['name', 'Name', named, true],
  ['sku', 'SKU', product],
  ['brand', 'Brand', product],
  ['price', 'Price', product],
  ['currency', 'Currency', product],
];

const moreTextFields: Array<[string, string, string[]]> = [
  ['ratingValue', 'Rating value', product],
  ['reviewCount', 'Review count', product],
  ['logo', 'Logo URL', organization],
  ['sameAs', 'Profiles (sameAs, one per line)', organization],
  ['telephone', 'Telephone', organization],
  ['email', 'Email', organization],
];

function textField([id, label, types, required]: [string, string, string[], boolean?]): ToolField {
  return {
    defaultValue: '',
    id,
    label,
    ...(required ? { required } : {}),
    type: 'text',
    visibleWhen: { field: 'type', is: types },
  };
}

const availability: ToolField = {
  defaultValue: '',
  id: 'availability',
  label: 'Availability',
  options: [
    { label: 'Not set', value: '' },
    ...['InStock', 'OutOfStock', 'PreOrder', 'BackOrder', 'Discontinued', 'SoldOut'].map(
      (value) => ({ label: value, value }),
    ),
  ],
  type: 'select',
  visibleWhen: { field: 'type', is: product },
};

const base = { format: 'script', type: 'Article' };
const faqText =
  'What is JSON-LD?\nA way to describe a page for search engines.\n\nIs it visible to visitors?\nNo, it lives in a script tag.\nSearch engines read it.';
const crumbText =
  'Home | https://example.com/\nGuides | https://example.com/guides\nStructured data';

function plural(count: number): string {
  return `${count} propert${count === 1 ? 'y' : 'ies'}`;
}

export const jsonLdGeneratorTool: ToolDefinition = {
  id: 'json-ld-generator',
  name: 'JSON-LD Structured Data Generator',
  category: 'Web/API',
  description:
    'Build schema.org JSON-LD for an Article, Product, Organization, FAQ page or breadcrumb list, wrapped in a script tag or as bare JSON.',
  samples: [
    {
      fields: {
        ...base,
        author: 'Ada Lovelace',
        datePublished: '2026-10-01',
        headline: 'Verifying JWTs in the browser',
        images: 'https://example.com/jwt.png',
        url: 'https://example.com/jwt',
      },
      label: 'Article',
    },
    {
      fields: {
        ...base,
        availability: 'InStock',
        brand: 'Keychron',
        currency: 'EUR',
        description: 'Compact wireless mechanical keyboard.',
        images: 'https://example.com/kb1.png',
        name: 'KB-1 Keyboard',
        price: '19.99',
        ratingValue: '4.5',
        reviewCount: '12',
        sku: 'KB-1',
        type: 'Product',
      },
      label: 'Product with offer and rating',
    },
    {
      fields: {
        ...base,
        logo: 'https://acme.example/logo.png',
        name: 'Acme Inc.',
        sameAs: 'https://github.com/acme\nhttps://www.linkedin.com/company/acme',
        type: 'Organization',
        url: 'https://acme.example',
      },
      label: 'Organization with profiles',
    },
    { fields: { ...base, type: 'FAQPage' }, label: 'FAQ page', text: faqText },
    { fields: { ...base, type: 'BreadcrumbList' }, label: 'Breadcrumb list', text: crumbText },
    {
      fields: {
        ...base,
        format: 'json',
        headline: 'Release notes',
        images: 'https://example.com/notes.png',
        datePublished: '2026-10-20T09:00:00Z',
      },
      label: 'Article as bare JSON',
    },
  ],
  inputKind: 'text',
  inputPresentation: {
    label: 'FAQ entries or breadcrumbs',
    placeholder:
      'FAQPage: question line, answer lines, blank line between entries\nBreadcrumbList: Name | https://example.com/ per line (last URL optional)',
  },
  inputVisibleWhen: { field: 'type', is: ['FAQPage', 'BreadcrumbList'] },
  outputKind: 'text',
  autoRun: true,
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'Article',
      id: 'type',
      label: 'Type',
      options: ['Article', 'Product', 'Organization', 'FAQPage', 'BreadcrumbList'].map((value) => ({
        label: value,
        value,
      })),
      type: 'select',
    },
    {
      defaultValue: 'script',
      id: 'format',
      label: 'Output',
      options: [
        { label: 'Script tag', value: 'script' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    ...textFields.map(textField),
    availability,
    ...moreTextFields.map(([id, label, types]) => textField([id, label, types])),
  ],
  keywords: [
    'json-ld',
    'jsonld',
    'structured data',
    'schema.org',
    'rich results',
    'faq schema',
    'breadcrumb schema',
    'product schema',
    'article schema',
    'seo',
  ],
  relatedToolIds: ['meta-tag-generator', 'json-format', 'html-format'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const type = fields.type ?? 'Article';
    const out = withToolError(() => webFunctions.generateJsonLd(type, fields, text));
    const summary = [
      type,
      plural(out.propertyCount),
      webFunctions.summarizeFindings(out.findings),
    ].join(' · ');

    if (fields.format === 'json') {
      return identityOutput(out.json, 'structured-data.json', summary, true);
    }

    return {
      ...identityOutput(
        webFunctions.wrapJsonLdScript(out.json),
        'structured-data.html',
        summary,
        false,
      ),
      language: 'html',
    };
  },
};
