import type { ToolDefinition } from '@devtoolora/core';
import { buildConventionalCommit, commitTypes, type CommitType } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const typeLabels: Record<CommitType, string> = {
  build: 'build: build system or dependencies',
  chore: 'chore: other maintenance',
  ci: 'ci: CI configuration',
  docs: 'docs: documentation',
  feat: 'feat: a new feature',
  fix: 'fix: a bug fix',
  perf: 'perf: performance improvement',
  refactor: 'refactor: code change without behavior change',
  revert: 'revert: revert an earlier commit',
  style: 'style: formatting only',
  test: 'test: tests',
};

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const conventionalCommitTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Build a Conventional Commits message from a type, scope, description, body, breaking change and footers.',
  fields: [
    {
      defaultValue: 'feat',
      id: 'type',
      label: 'Type',
      options: commitTypes.map((value) => ({ label: typeLabels[value], value })),
      type: 'select',
    },
    {
      id: 'scope',
      label: 'Scope',
      type: 'text',
    },
    {
      id: 'description',
      label: 'Description',
      required: true,
      type: 'text',
    },
    {
      defaultValue: 'false',
      id: 'breaking',
      label: 'Breaking change',
      type: 'checkbox',
    },
    {
      id: 'breakingText',
      label: 'Breaking change description',
      type: 'text',
      visibleWhen: { field: 'breaking', is: ['true'] },
    },
    {
      id: 'body',
      label: 'Body',
      type: 'textarea',
    },
    {
      id: 'footers',
      label: 'Footers',
      placeholder: 'Refs: #123',
      type: 'textarea',
    },
  ],
  freshResults: true,
  id: 'conventional-commit',
  inputKind: 'none',
  keywords: ['conventional commits', 'commit message', 'git', 'changelog', 'semantic', 'feat'],
  name: 'Conventional Commit Builder',
  outputKind: 'text',
  relatedToolIds: ['gitignore-generator', 'semver-compare', 'text-diff'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const { header, message, warnings } = buildConventionalCommit({
        body: fields.body ?? '',
        breaking: booleanField(fields.breaking, false),
        breakingText: fields.breakingText ?? '',
        description: fields.description ?? '',
        footers: fields.footers ?? '',
        scope: fields.scope ?? '',
        type: choiceField(fields.type, 'feat', commitTypes, 'Choose a commit type.'),
      });

      return {
        artifact: {
          base64: encodeBase64Text(message),
          fileName: 'COMMIT_EDITMSG',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: warnings[0] ?? `Header is ${header.length} characters.`,
        text: message,
      };
    }),
  samples: [
    sample('Feature with scope', {
      description: 'add array support',
      scope: 'parser',
      type: 'feat',
    }),
    sample('Bug fix with issue', {
      description: 'handle empty input',
      footers: 'Fixes #42',
      type: 'fix',
    }),
    sample('Breaking change', {
      breaking: 'true',
      breakingText: 'drops support for Node 18',
      description: 'require Node 20',
      scope: 'runtime',
      type: 'feat',
    }),
    sample('Docs with body', {
      body: 'Explain the retry options and show a short example.',
      description: 'document retry options',
      type: 'docs',
    }),
    sample('Revert with refs', {
      body: 'This reverts commit 1a2b3c4.',
      description: 'revert "add cache layer"',
      footers: 'Refs: #108\nReviewed-by: Ada',
      type: 'revert',
    }),
    sample('Chore without scope', { description: 'bump dev dependencies', type: 'chore' }),
  ],
  supportsSelection: false,
};
