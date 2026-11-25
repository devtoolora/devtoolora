import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

const metaDefaults = {
  description: '',
  image: '',
  imageAlt: '',
  locale: '',
  robots: 'index, follow',
  siteName: '',
  title: '',
  twitterCard: 'auto',
  twitterSite: '',
  type: 'website',
  url: '',
};

export const metaTagGeneratorTool: ToolDefinition = {
  id: 'meta-tag-generator',
  name: 'Meta Tag & Open Graph Generator',
  category: 'Web/API',
  description:
    'Write SEO, Open Graph and X card tags with canonical URL, image alt and robots, preview the search result and link card, and get length and completeness suggestions.',
  samples: [
    {
      fields: {
        ...metaDefaults,
        description:
          'Private, offline-first utilities for formatting, encoding, tokens and everyday developer tasks.',
        image: 'https://example.com/og/home.png',
        imageAlt: 'Dev Toolora tool grid on a dark background',
        siteName: 'Dev Toolora',
        title: 'Dev Toolora: local developer tools',
        twitterSite: '@devtoolora',
        url: 'https://example.com/',
      },
      label: 'Landing page with image',
    },
    {
      fields: {
        ...metaDefaults,
        description:
          'How to verify RS256 and ES256 tokens against a JWKS, and why the alg header must never choose the key type.',
        image: '/images/jwt-cover.png',
        imageAlt: 'Diagram of a JWT header, payload and signature',
        locale: 'en_US',
        siteName: 'Example Engineering',
        title: 'Verifying JWTs without algorithm confusion',
        type: 'article',
        url: 'https://example.com/blog/verify-jwt',
      },
      label: 'Blog article with a relative image',
    },
    {
      fields: {
        ...metaDefaults,
        description:
          'Mechanical keyboard with hot-swappable switches, PBT keycaps and USB-C. Ships in 2 days.',
        image: 'https://shop.example.com/img/kb-1.jpg',
        imageAlt: 'Keyboard KB-1 in graphite',
        siteName: 'Example Shop',
        title: 'KB-1 mechanical keyboard',
        type: 'product',
        url: 'https://shop.example.com/products/kb-1',
      },
      label: 'Product page',
    },
    {
      fields: {
        ...metaDefaults,
        description:
          'Release notes, upgrade steps and known issues for version 4.2 of the command-line client.',
        siteName: 'Example Docs',
        title: 'CLI 4.2 release notes',
        twitterCard: 'summary',
        url: 'https://docs.example.com/cli/4.2',
      },
      label: 'Small card without an image',
    },
    {
      fields: {
        ...metaDefaults,
        description:
          'This description is deliberately long so you can see where search engines and social platforms usually cut text off, and how the preview shows the ellipsis at the end of the visible part of the snippet.',
        image: 'https://example.com/og.png',
        title: 'A deliberately long page title that goes past the usual sixty-character limit',
        url: 'http://example.com/page?utm_source=newsletter',
      },
      label: 'Long text with suggestions',
    },
    {
      fields: {
        ...metaDefaults,
        description: 'Internal status dashboard for the operations team.',
        robots: 'noindex, nofollow',
        siteName: 'Example Ops',
        title: 'Ops status dashboard',
        url: 'https://ops.example.com/status',
      },
      label: 'Private page (noindex)',
    },
  ],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  autoRun: true,
  freshResults: true,
  fields: [
    {
      help: 'Aim for 30–60 characters.',
      id: 'title',
      label: 'Title',
      placeholder: 'Page title',
      required: true,
      type: 'text',
    },
    {
      help: 'Aim for 70–160 characters.',
      id: 'description',
      label: 'Description',
      placeholder: 'One or two sentences about the page',
      required: true,
      rows: 3,
      type: 'textarea',
    },
    {
      help: 'Absolute canonical address; also used for og:url.',
      id: 'url',
      label: 'Page URL',
      placeholder: 'https://example.com/page',
      type: 'text',
    },
    { id: 'siteName', label: 'Site name', placeholder: 'Example', type: 'text' },
    {
      defaultValue: 'website',
      id: 'type',
      label: 'Page type',
      options: [
        { label: 'Website', value: 'website' },
        { label: 'Article', value: 'article' },
        { label: 'Product', value: 'product' },
        { label: 'Profile', value: 'profile' },
        { label: 'Book', value: 'book' },
        { label: 'Video', value: 'video.other' },
        { label: 'Movie', value: 'video.movie' },
        { label: 'Song', value: 'music.song' },
      ],
      type: 'select',
    },
    {
      help: 'Absolute URL, or a path resolved against the page URL. 1200×630 suits large cards.',
      id: 'image',
      label: 'Image URL',
      placeholder: 'https://example.com/og.png',
      type: 'text',
    },
    {
      help: 'Describes the image for screen readers.',
      id: 'imageAlt',
      label: 'Image alt text',
      type: 'text',
      visibleWhen: { field: 'image', isNot: [''] },
    },
    {
      defaultValue: 'auto',
      id: 'twitterCard',
      label: 'X card',
      options: [
        { label: 'Auto', value: 'auto' },
        { label: 'Large image', value: 'summary_large_image' },
        { label: 'Small image', value: 'summary' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    { id: 'twitterSite', label: 'X account', placeholder: '@example', type: 'text' },
    {
      help: 'language_TERRITORY, such as en_US.',
      id: 'locale',
      label: 'Locale',
      placeholder: 'en_US',
      type: 'text',
    },
    {
      defaultValue: 'index, follow',
      id: 'robots',
      label: 'Robots',
      options: [
        { label: 'Index, follow (default)', value: 'index, follow' },
        { label: 'Noindex, follow', value: 'noindex, follow' },
        { label: 'Index, nofollow', value: 'index, nofollow' },
        { label: 'Noindex, nofollow', value: 'noindex, nofollow' },
      ],
      type: 'select',
    },
  ],
  keywords: [
    'meta tags',
    'seo',
    'open graph',
    'og tags',
    'og:image',
    'twitter card',
    'x card',
    'social preview',
    'link preview',
    'canonical',
  ],
  relatedToolIds: ['url-parse', 'markdown-to-html', 'web-pwa-icon-generator', 'svg-placeholder'],
  resultActions: ['copy', 'insert', 'scratch', 'save'],
  run: ({ fields }) => metaTags(fields),
};

export const openGraphPreviewTool: ToolDefinition = {
  ...metaTagGeneratorTool,
  aliasOf: 'meta-tag-generator',
  id: 'open-graph-preview',
  name: 'Open Graph Preview',
};

function metaTags(fields: Record<string, string>): ToolResult {
  const report = withToolError(() =>
    webFunctions.buildMetaTags({
      description: fields.description ?? '',
      image: fields.image,
      imageAlt: fields.imageAlt,
      locale: fields.locale,
      robots: fields.robots,
      siteName: fields.siteName,
      title: fields.title ?? '',
      twitterCard: fields.twitterCard === 'auto' ? undefined : fields.twitterCard,
      twitterSite: fields.twitterSite,
      type: fields.type,
      url: fields.url,
    }),
  );
  const titleLength = [...(fields.title ?? '').replace(/\s+/g, ' ').trim()].length;
  const descriptionLength = [...(fields.description ?? '').replace(/\s+/g, ' ').trim()].length;
  const counts = `Title ${titleLength}/${webFunctions.metaTagLimits.title} · description ${descriptionLength}/${webFunctions.metaTagLimits.description}`;

  return {
    artifact: {
      base64: encodeBase64Text(`${report.html}\n`),
      fileName: 'meta-tags.html',
      mimeType: 'text/html;charset=utf-8',
    },
    language: 'html',
    previewDataUri: `data:image/svg+xml;base64,${encodeBase64Text(report.preview)}`,
    summary: report.suggestions.length
      ? `${counts}. ${report.suggestions.length} ${report.suggestions.length === 1 ? 'suggestion' : 'suggestions'}: ${report.suggestions.join(' ')}`
      : `${counts}. Nothing to improve: URL, image and alt text are present and lengths are within common limits.`,
    text: report.html,
  };
}
