import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { base64Encode, utf8Bytes } from '@devtoolora/functions/binary';
import * as devFunctions from '@devtoolora/functions/dev';
import { withToolError } from '../../../adapters/errors';
import { gitignoreTemplateGroups } from './templates';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export const gitignoreGeneratorTool: ToolDefinition = {
  id: 'gitignore-generator',
  keywords: ['git', 'ignore file', 'node_modules', 'templates', 'vcs'],
  name: '.gitignore Generator',
  category: 'Dev Utilities',
  description:
    'Build a local .gitignore from language, framework, OS, editor and DevOps templates.',
  relatedToolIds: ['text-diff', 'dotenv-validator', 'docker-to-compose'],
  inputKind: 'none',
  outputKind: 'text',
  supportsSelection: false,
  autoRun: true,
  resultActions: ['copy', 'save', 'scratch'],
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    ...gitignoreTemplateGroups.map((group) => ({
      id: group.id,
      label: group.label,
      type: 'checkboxGroup' as const,
      options: group.templates.map((template) => ({ label: template.label, value: template.id })),
    })),
    {
      id: 'excludeGeneratedRules',
      label: 'Exclude generated rules',
      type: 'textarea' as const,
      placeholder: 'One exact generated rule per line, e.g. dist/',
      help: 'Remove exact generated lines, not matching filenames or custom rules. No glob matching is done here.',
    },
    {
      id: 'customRules',
      label: 'Custom rules',
      type: 'textarea' as const,
      placeholder: 'One .gitignore rule per line',
      help: 'Append exact lines in this order. Comments, duplicates, negation and escaped/trailing spaces are preserved.',
    },
  ],
  samples: [
    {
      label: 'Node.js + macOS + VS Code',
      fields: {
        customRules: '',
        devops: '',
        editors: 'vscode',
        excludeGeneratedRules: '',
        frameworks: '',
        languages: 'node',
        os: 'macos',
      },
    },
    {
      label: 'Python + Docker + VS Code',
      fields: {
        customRules: '',
        devops: 'docker',
        editors: 'vscode',
        excludeGeneratedRules: '',
        frameworks: '',
        languages: 'python',
        os: '',
      },
    },
    {
      label: 'React / Vite with local coverage',
      fields: {
        customRules: 'coverage/\n# Local scratch directory\nscratch/',
        devops: '',
        editors: '',
        excludeGeneratedRules: '',
        frameworks: 'react-vite',
        languages: 'node',
        os: '',
      },
    },
    {
      label: 'Order-sensitive repeated patterns',
      fields: {
        customRules: '*.log\n!keep.log\n*.log',
        devops: '',
        editors: '',
        excludeGeneratedRules: '',
        frameworks: '',
        languages: '',
        os: '',
      },
    },
    {
      label: 'Escaped names and trailing space',
      fields: {
        customRules: '\\#literal\n\\!literal\ntrailing\\ \n leading-name',
        devops: '',
        editors: '',
        excludeGeneratedRules: '',
        frameworks: '',
        languages: '',
        os: '',
      },
    },
    {
      label: 'Keep a file inside dist',
      fields: {
        customRules: 'dist/*\n!dist/keep.txt',
        devops: '',
        editors: '',
        excludeGeneratedRules: 'dist/',
        frameworks: 'react-vite',
        languages: '',
        os: '',
      },
    },
    {
      label: 'Exclusions do not remove custom rules',
      fields: {
        customRules: '.env\n!sample.env',
        devops: '',
        editors: '',
        excludeGeneratedRules: '.env',
        frameworks: '',
        languages: 'node',
        os: '',
      },
    },
    {
      label: 'Comments and real blank lines',
      fields: {
        customRules: '# Cache files\n\ncache/*\n# Keep a fixture\n!cache/fixture.txt',
        devops: '',
        editors: '',
        excludeGeneratedRules: '',
        frameworks: '',
        languages: '',
        os: '',
      },
    },
    {
      label: 'Empty starter file',
      fields: {
        customRules: '',
        devops: '',
        editors: '',
        excludeGeneratedRules: '',
        frameworks: '',
        languages: '',
        os: '',
      },
    },
  ],
  run: ({ fields }) => generateGitignoreResult(fields),
};

function generateGitignoreResult(fields: Record<string, string>): ToolResult {
  const sections = gitignoreTemplateGroups.flatMap((group) => {
    const selected = new Set(parseSelection(fields[group.id]));

    if ([...selected].some((id) => !group.templates.some((template) => template.id === id)))
      throw new ToolError(
        `Choose a listed template in ${group.label}. Unknown selections are not ignored.`,
      );

    return group.templates
      .filter((template) => selected.has(template.id))
      .map(({ label, rules }) => ({ label, rules }));
  });
  const customLines = parseLines(fields.customRules);
  const exclusions = parseLines(fields.excludeGeneratedRules);
  const result = withToolError(() =>
    devFunctions.generateGitignore(sections, customLines, exclusions),
  );
  const report = JSON.stringify(
    {
      customLines,
      exclusions,
      result,
      selectedTemplates: sections.map((section) => section.label),
    },
    null,
    2,
  );

  return {
    text: result.text,
    language: 'plaintext',
    summary: `${result.selectedTemplateCount} selected templates · ${result.generatedRuleCount} generated lines · ${result.customRuleCount} custom patterns in ${result.customLineCount} preserved lines · ${result.excludedRuleCount} generated lines excluded. Review before replacing an existing .gitignore; tracked files are unaffected.`,
    artifacts: [
      {
        base64: base64Encode(utf8Bytes(report)),
        fileName: 'gitignore-report.json',
        mimeType: 'application/json;charset=utf-8',
      },
    ],
    artifact: {
      base64: base64Encode(utf8Bytes(result.text)),
      mimeType: 'text/plain',
      fileName: '.gitignore',
    },
    resultActions: ['copy', 'save', 'scratch'],
  };
}

function parseSelection(value: string | undefined): string[] {
  if (value && value.length > 2048)
    throw new ToolError('Template selections are limited to 2,048 characters per group.');

  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLines(value: string | undefined): string[] {
  if (value === undefined || value === '') return [];
  if (value.length > 100_000)
    throw new ToolError('Gitignore input is limited to 100,000 UTF-16 units.');

  const lines = value.split(/\r\n|\r|\n/);

  if (/[\r\n]$/.test(value)) lines.pop();

  return lines;
}
