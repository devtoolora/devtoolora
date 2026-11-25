import { type ToolDefinition } from '@devtoolora/core';
import { compareSemanticVersions, type SemverComparison } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const precedenceLabels: Record<SemverComparison['result'], string> = {
  equal: 'Equal precedence',
  'left is newer': 'Left has higher precedence',
  'right is newer': 'Right has higher precedence',
};

export const semverCompareTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Compare complete SemVer versions, including prereleases, with an exact numeric comparison and a reason for their precedence.',
  fields: [
    {
      help: 'Complete version, such as 1.2.3 or 2.0.0-beta.1+build.7. Not an npm range or a v-prefixed Git tag.',
      id: 'left',
      label: 'Left version',
      placeholder: '1.2.3',
      required: true,
      type: 'text',
    },
    {
      help: 'Complete version to compare with the left side. Both inputs are validated independently.',
      id: 'right',
      label: 'Right version',
      placeholder: '1.3.0',
      required: true,
      type: 'text',
    },
  ],
  id: 'semver-compare',
  inputKind: 'none',
  keywords: ['semver', 'version', 'prerelease', 'release', 'compare'],
  name: 'Semver Compare',
  outputKind: 'json',
  relatedToolIds: ['json-diff', 'json-query', 'text-diff'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => {
    const report = withToolError(() =>
      compareSemanticVersions(fields.left ?? '', fields.right ?? ''),
    );
    const text = JSON.stringify(report, null, 2);

    return {
      artifact: {
        base64: encodeBase64Text(text),
        fileName: 'semver-comparison.json',
        mimeType: 'application/json;charset=utf-8',
      },
      language: 'json',
      summary: `${precedenceLabels[report.result]}. ${report.reason}`,
      text,
    };
  },
  samples: [
    { fields: { left: '1.2.3', right: '1.2.4' }, label: 'Patch update' },
    { fields: { left: '1.9.0', right: '1.10.0' }, label: 'Numeric minor comparison' },
    { fields: { left: '2.0.0-beta.1', right: '2.0.0' }, label: 'Prerelease versus final release' },
    {
      fields: { left: '1.0.0-beta.2', right: '1.0.0-beta.11' },
      label: 'Numeric prerelease identifiers',
    },
    {
      fields: { left: '1.0.0-1', right: '1.0.0-alpha' },
      label: 'Numeric versus nonnumeric identifier',
    },
    {
      fields: { left: '1.0.0-alpha', right: '1.0.0-alpha.1' },
      label: 'Longer prerelease sequence',
    },
    { fields: { left: '1.0.0-Alpha', right: '1.0.0-alpha' }, label: 'Case-sensitive ASCII order' },
    {
      fields: { left: '1.0.0+001', right: '1.0.0+002' },
      label: 'Different build, equal precedence',
    },
    { fields: { left: '3.2.1', right: '3.2.1' }, label: 'Identical versions' },
    {
      fields: { left: '9007199254740993.0.0', right: '9007199254740992.0.0' },
      label: 'Exact large core numbers',
    },
    {
      fields: { left: '1.0.0-9007199254740993', right: '1.0.0-9007199254740992' },
      label: 'Exact large prerelease numbers',
    },
    { fields: { left: ' 1.2.3 ', right: '1.2.4' }, label: 'Surrounding whitespace' },
  ],
  supportsSelection: false,
  freshResults: true,
};
