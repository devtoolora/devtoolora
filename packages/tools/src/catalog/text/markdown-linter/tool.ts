import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  formatMarkdownLint,
  lintMarkdown,
  markdownLintRules,
  type MarkdownLintRule,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const vector = '# Title\n\n### Skipped\ntext   \n\n\nend';
const defaultRules = markdownLintRules.join(',');

const ruleOptions = markdownLintRules.map((rule) => ({
  label: rule.replace('/', ' ').replaceAll('-', ' '),
  value: rule,
}));

const sample = (label: string, text: string, output = 'report') => ({
  fields: { output, rules: defaultRules },
  label,
  text,
});

function parseRules(value: string | undefined): MarkdownLintRule[] {
  const ids = (value ?? defaultRules).split(',').filter(Boolean);

  if (ids.length === 0) throw new ToolError('Choose at least one rule.');

  const known = markdownLintRules.filter((rule) => ids.includes(rule));

  if (known.length !== new Set(ids).size) throw new ToolError('Choose listed rules.');

  return known;
}

const artifactOf = (content: string, fileName: string, mimeType: string) => ({
  base64: encodeBase64Text(content),
  fileName,
  mimeType,
});

export const markdownLinterTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Check Markdown against ten markdownlint rules for heading levels, list markers, spacing, code fences and broken #fragment links.',
  fields: [
    {
      defaultValue: defaultRules,
      help: 'Rule ids and names follow markdownlint, so results can be compared and searched.',
      id: 'rules',
      label: 'Rules',
      options: ruleOptions,
      type: 'checkboxGroup',
    },
    {
      defaultValue: 'report',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Report', value: 'report' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'markdown-linter',
  inputKind: 'text',
  inputPresentation: { label: 'Markdown', placeholder: '# Title\n\nText.\n' },
  keywords: [
    'markdown lint',
    'markdownlint',
    'md lint',
    'broken anchors',
    'trailing spaces',
    'heading levels',
  ],
  name: 'Markdown Linter',
  outputKind: 'text',
  relatedToolIds: ['markdown-helper', 'markdown-toc', 'whitespace-cleaner'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const rules = parseRules(fields.rules);
      const output = fields.output === 'json' ? 'json' : 'report';
      const formatted = formatMarkdownLint(lintMarkdown(text, rules));
      const json = JSON.stringify(formatted.json, null, 2);
      const report = artifactOf(formatted.report, 'markdown-lint.txt', 'text/plain;charset=utf-8');
      const jsonFile = artifactOf(json, 'markdown-lint.json', 'application/json;charset=utf-8');

      return {
        artifact: output === 'json' ? jsonFile : report,
        artifacts: [output === 'json' ? report : jsonFile],
        language: output === 'json' ? 'json' : 'plaintext',
        noWrap: true,
        summary: formatted.summary,
        text: output === 'json' ? json : formatted.report,
      };
    }),
  samples: [
    sample('Spec vector with five findings', vector),
    sample(
      'Clean README',
      '# Project\n\nShort description.\n\n## Install\n\n```sh\nnpm install\n```\n',
    ),
    sample(
      'Broken fragment links',
      '# Guide\n\nSee [setup](#setup) and [usage](#Usage).\n\n## Usage\n',
    ),
    sample('Mixed bullets and tabs', '# List\n\n* one\n- two\n\n\ttabbed\n'),
    sample('Front matter and a second h1', '---\ntitle: Post\n---\n# Post\n\n# Again\n'),
    sample('Spec vector as JSON', vector, 'json'),
  ],
  supportsSelection: true,
};
