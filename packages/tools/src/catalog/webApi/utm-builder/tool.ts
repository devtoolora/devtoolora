import { ToolDefinition } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const base = {
  campaign: '',
  content: '',
  id: '',
  lowercase: 'true',
  medium: '',
  source: 'newsletter',
  term: '',
  url: 'https://example.com/',
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export const utmBuilderTool: ToolDefinition = {
  id: 'utm-builder',
  name: 'UTM Link Builder',
  category: 'Web/API',
  description:
    'Add utm_source, medium, campaign, term, content and id to a URL, keeping the rest of the link, with findings for missing or case-sensitive values.',
  samples: [
    {
      fields: { ...base, campaign: 'Spring Sale', medium: 'email' },
      label: 'Newsletter campaign',
    },
    {
      fields: {
        ...base,
        campaign: 'brand',
        medium: 'cpc',
        source: 'google',
        term: 'running shoes',
        url: 'https://example.com/shoes',
      },
      label: 'Paid search with term',
    },
    {
      fields: {
        ...base,
        campaign: 'launch',
        content: 'hero-banner',
        medium: 'social',
        source: 'linkedin',
      },
      label: 'Social post with content',
    },
    {
      fields: {
        ...base,
        campaign: 'new',
        medium: 'email',
        url: 'https://example.com/?utm_source=old&utm_medium=web&ref=1',
      },
      label: 'Replace existing UTM parameters',
    },
    {
      fields: { ...base, lowercase: 'false', medium: 'Email', source: 'Newsletter' },
      label: 'Mixed case kept',
    },
    {
      fields: { ...base, id: 'cmp-42', source: 'partner' },
      label: 'Campaign ID only',
    },
  ],
  inputKind: 'none',
  outputKind: 'text',
  autoRun: true,
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'https://example.com/',
      id: 'url',
      label: 'Destination URL',
      required: true,
      type: 'text',
    },
    { defaultValue: '', id: 'source', label: 'Source (utm_source)', required: true, type: 'text' },
    { defaultValue: '', id: 'medium', label: 'Medium (utm_medium)', type: 'text' },
    { defaultValue: '', id: 'campaign', label: 'Campaign (utm_campaign)', type: 'text' },
    { defaultValue: '', id: 'term', label: 'Term (utm_term)', type: 'text' },
    { defaultValue: '', id: 'content', label: 'Content (utm_content)', type: 'text' },
    { defaultValue: '', id: 'id', label: 'Campaign ID (utm_id)', type: 'text' },
    { defaultValue: 'true', id: 'lowercase', label: 'Lowercase values', type: 'checkbox' },
  ],
  keywords: [
    'utm',
    'utm builder',
    'utm_source',
    'utm_campaign',
    'campaign url',
    'tracking link',
    'google analytics',
    'marketing link',
  ],
  relatedToolIds: ['url-parse', 'query-string-parser', 'url-encode'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => {
    const report = withToolError(() =>
      webFunctions.buildUtmLink({
        campaign: fields.campaign,
        content: fields.content,
        id: fields.id,
        lowercase: fields.lowercase !== 'false',
        medium: fields.medium,
        source: fields.source ?? '',
        term: fields.term,
        url: fields.url ?? '',
      }),
    );
    const summary = [
      plural(report.parameters.length, 'parameter'),
      webFunctions.summarizeFindings(report.findings),
    ].join(' · ');

    return identityOutput(webFunctions.renderUtmReport(report), 'utm-link.txt', summary, false);
  },
};
