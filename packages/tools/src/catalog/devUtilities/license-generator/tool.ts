import type { ToolDefinition } from '@devtoolora/core';
import {
  generateLicense,
  holderLicenseIds,
  licenseIds,
  licenseNames,
} from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const licenseGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Create a LICENSE file from MIT, Apache-2.0, BSD, ISC, MPL-2.0, GPL-3.0 or Unlicense text with your year and name.',
  fields: [
    {
      defaultValue: 'mit',
      id: 'license',
      label: 'License',
      options: licenseIds.map((value) => ({ label: licenseNames.get(value) ?? value, value })),
      type: 'select',
    },
    {
      id: 'holder',
      label: 'Copyright holder',
      type: 'text',
      visibleWhen: { field: 'license', is: [...holderLicenseIds] },
    },
    {
      help: 'Blank uses the current year.',
      id: 'year',
      label: 'Year',
      type: 'text',
    },
  ],
  freshResults: true,
  id: 'license-generator',
  inputKind: 'none',
  keywords: [
    'license',
    'licence',
    'mit',
    'apache',
    'bsd',
    'isc',
    'gpl',
    'mpl',
    'unlicense',
    'copyright',
  ],
  name: 'License Generator',
  outputKind: 'text',
  relatedToolIds: ['gitignore-generator', 'conventional-commit'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const id = choiceField(fields.license, 'mit', licenseIds, 'Choose a license.');
      const holder = (fields.holder ?? '').trim();
      const { name, text, year } = generateLicense({ holder, id, year: fields.year ?? '' });

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName: 'LICENSE',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: year === '' ? `${name}.` : `${name} · ${year} · ${holder}.`,
        text,
      };
    }),
  samples: [
    sample('MIT for a person', { holder: 'Ada Lovelace', license: 'mit', year: '2026' }),
    sample('MIT for a company', { holder: 'Example Inc.', license: 'mit', year: '' }),
    sample('Apache 2.0', { license: 'apache-2.0' }),
    sample('BSD 3-Clause', {
      holder: 'The Example Authors',
      license: 'bsd-3-clause',
      year: '2024',
    }),
    sample('ISC', { holder: 'Grace Hopper', license: 'isc', year: '2025' }),
    sample('GPL 3.0', { license: 'gpl-3.0' }),
    sample('Unlicense', { license: 'unlicense' }),
  ],
  supportsSelection: false,
};
