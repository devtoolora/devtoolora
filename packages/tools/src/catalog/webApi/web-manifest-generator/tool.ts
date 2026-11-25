import { ToolDefinition, ToolField } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const icons =
  '/icons/icon-192.png 192x192 image/png any\n/icons/icon-512.png 512x512 image/png maskable';

const selectOf = (values: string[]) => values.map((value) => ({ label: value, value }));

const textFields: Array<[string, string, string]> = [
  ['name', 'Name', 'Dev Toolora'],
  ['shortName', 'Short name', 'Signal'],
  ['description', 'Description', ''],
  ['startUrl', 'Start URL', '/'],
  ['scope', 'Scope', '/'],
  ['id', 'ID', ''],
];

const colorAndIconFields: Array<[string, string, string]> = [
  ['themeColor', 'Theme color', '#0f172a'],
  ['backgroundColor', 'Background color', '#ffffff'],
  ['lang', 'Language', ''],
];

function textField([id, label, defaultValue]: [string, string, string]): ToolField {
  return { defaultValue, id, label, ...(id === 'name' ? { required: true } : {}), type: 'text' };
}

function select(id: string, label: string, defaultValue: string, values: string[]): ToolField {
  return {
    defaultValue,
    id,
    label,
    options: [
      ...(defaultValue === '' ? [{ label: 'Not set', value: '' }] : []),
      ...selectOf(values),
    ],
    type: 'select',
  };
}

const base = {
  backgroundColor: '#ffffff',
  categories: '',
  description: '',
  dir: 'auto',
  display: 'standalone',
  icons,
  id: '',
  lang: '',
  name: 'Dev Toolora',
  orientation: '',
  scope: '/',
  shortName: 'Signal',
  startUrl: '/',
  themeColor: '#0f172a',
};

function plural(count: number): string {
  return `${count} icon${count === 1 ? '' : 's'}`;
}

export const webManifestGeneratorTool: ToolDefinition = {
  id: 'web-manifest-generator',
  name: 'Web App Manifest Generator',
  category: 'Web/API',
  description:
    'Build a manifest.webmanifest for a progressive web app and check installability, icons, scope and short name.',
  samples: [
    { fields: base, label: 'Standalone app' },
    {
      fields: {
        ...base,
        categories: 'productivity, utilities',
        display: 'minimal-ui',
        name: 'Quick Notes',
        shortName: 'Notes',
      },
      label: 'Minimal UI with categories',
    },
    {
      fields: { ...base, icons: '/icons/icon-192.png' },
      label: 'Single icon (not installable)',
    },
    {
      fields: { ...base, shortName: 'Dev Toolora Dashboard' },
      label: 'Long short name',
    },
    {
      fields: {
        ...base,
        backgroundColor: '#000000',
        display: 'fullscreen',
        name: 'Star Runner',
        orientation: 'landscape',
        shortName: 'Runner',
        themeColor: '#000000',
      },
      label: 'Fullscreen game with orientation',
    },
    {
      fields: { ...base, dir: 'rtl', lang: 'ar', name: 'تطبيق الإشارة', shortName: 'إشارة' },
      label: 'Right-to-left app',
    },
  ],
  inputKind: 'none',
  outputKind: 'text',
  autoRun: true,
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    ...textFields.map(textField),
    select('display', 'Display', 'standalone', [
      'standalone',
      'fullscreen',
      'minimal-ui',
      'browser',
    ]),
    select('orientation', 'Orientation', '', [
      'any',
      'natural',
      'landscape',
      'landscape-primary',
      'landscape-secondary',
      'portrait',
      'portrait-primary',
      'portrait-secondary',
    ]),
    ...colorAndIconFields.map(textField),
    select('dir', 'Text direction', 'auto', ['auto', 'ltr', 'rtl']),
    { defaultValue: '', id: 'categories', label: 'Categories', type: 'text' },
    { defaultValue: icons, id: 'icons', label: 'Icons', rows: 4, type: 'textarea' },
  ],
  keywords: [
    'manifest',
    'webmanifest',
    'pwa',
    'progressive web app',
    'installable',
    'app icons',
    'theme color',
    'start url',
  ],
  relatedToolIds: ['web-pwa-icon-generator', 'meta-tag-generator', 'json-format'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => {
    const out = withToolError(() =>
      webFunctions.generateWebManifest({
        backgroundColor: fields.backgroundColor,
        categories: fields.categories,
        description: fields.description,
        dir: fields.dir,
        display: fields.display,
        icons: fields.icons,
        id: fields.id,
        lang: fields.lang,
        name: fields.name ?? '',
        orientation: fields.orientation,
        scope: fields.scope,
        shortName: fields.shortName,
        startUrl: fields.startUrl,
        themeColor: fields.themeColor,
      }),
    );
    const summary = [
      out.installable ? 'Installable' : 'Not installable',
      plural(out.iconCount),
      webFunctions.summarizeFindings(out.findings),
    ].join(' · ');

    return identityOutput(out.json, 'manifest.webmanifest', summary, true);
  },
};
