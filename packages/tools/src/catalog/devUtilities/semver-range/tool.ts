import type { ToolDefinition } from '@devtoolora/core';
import { testSemverRange, type SemverRangeReport } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { booleanField } from '../../../adapters/fields';

type Row = SemverRangeReport['rows'][number];

const marks: Record<Row['status'], string> = {
  invalid: '!',
  match: '✓',
  'no match': '✗',
};

const sample = (label: string, range: string, text: string, includePrerelease = 'false') => ({
  fields: { includePrerelease, range },
  label,
  text,
});

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

function formatRow({ input, reason, status }: Row): string {
  return `${marks[status]} ${input}${reason ? ` — ${reason}` : ''}`;
}

function summarize({ highest, lowest, rows }: SemverRangeReport): string {
  const matched = rows.filter(({ status }) => status === 'match').length;
  const verb = rows.length === 1 ? 'matches' : 'match';
  const bounds = highest && lowest ? ` · highest ${highest} · lowest ${lowest}` : '';

  return `${matched.toLocaleString('en-US')} of ${plural(rows.length, 'version')} ${verb}${bounds}.`;
}

export const semverRangeTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Test versions against an npm SemVer range, see the range desugared the way node-semver reads it, and find the highest and lowest match.',
  fields: [
    {
      help: 'npm range syntax: ^, ~, x, *, hyphen ranges, comparators and || alternatives.',
      id: 'range',
      label: 'Range',
      placeholder: '^1.2.3',
      required: true,
      type: 'text',
    },
    {
      defaultValue: 'false',
      id: 'includePrerelease',
      label: 'Include prereleases',
      type: 'checkbox',
    },
  ],
  freshResults: true,
  id: 'semver-range',
  inputKind: 'text',
  keywords: ['semver', 'npm range', 'caret', 'tilde', 'satisfies', 'version range', 'node-semver'],
  name: 'Semver Range Tester',
  outputKind: 'text',
  relatedToolIds: ['semver-compare', 'sort-lines', 'conventional-commit'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const report = testSemverRange(fields.range ?? '', text, {
        includePrerelease: booleanField(fields.includePrerelease, false),
      });
      const output = [`Range: ${report.desugared}`, '', ...report.rows.map(formatRow)].join('\n');

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: 'semver-range.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: summarize(report),
        text: output,
      };
    }),
  samples: [
    sample('Caret range', '^1.2.3', '1.2.3\n1.9.0\n2.0.0\n1.2.2'),
    sample('Caret below 1.0', '^0.2.3', '0.2.3\n0.2.9\n0.3.0'),
    sample('Tilde range', '~1.2.3', '1.2.3\n1.2.9\n1.3.0'),
    sample('Hyphen range', '1.2 - 2.3', '1.2.0\n2.3.9\n2.4.0'),
    sample('Alternatives', '>=1.2.3 <2 || 3.x', '1.5.0\n2.1.0\n3.4.0'),
    sample('Prerelease of the same version', '>1.2.3-alpha.3', '1.2.3-alpha.7\n3.4.5-alpha.9'),
    sample('Include prereleases', '^1.2.3', '1.5.0-rc.1\n2.0.0-rc.1', 'true'),
    sample('Git tags and invalid lines', '~2.1', 'v2.1.0\nv2.1.4\nv2.2.0\nlatest'),
  ],
  supportsSelection: false,
};
