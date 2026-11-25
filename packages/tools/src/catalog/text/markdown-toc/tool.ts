import { ToolDefinition } from '@devtoolora/core';
import { markdownToc } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const levels = ['1', '2', '3', '4', '5', '6'] as const;
const bullets = ['-', '*', 'ordered'] as const;
const levelOptions = levels.map((level) => ({ label: `H${level}`, value: level }));

export const markdownTocTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description: 'Build a linked table of contents with GitHub anchors from Markdown headings.',
  fields: [
    {
      defaultValue: '2',
      id: 'minLevel',
      label: 'Shallowest heading',
      options: levelOptions,
      type: 'select',
    },
    {
      defaultValue: '3',
      id: 'maxLevel',
      label: 'Deepest heading',
      options: levelOptions,
      type: 'select',
    },
    {
      defaultValue: '-',
      id: 'bullet',
      label: 'List style',
      options: [
        { label: 'Dash (-)', value: '-' },
        { label: 'Asterisk (*)', value: '*' },
        { label: 'Numbered', value: 'ordered' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'markdown-toc',
  inputKind: 'text',
  keywords: ['markdown toc', 'table of contents', 'headings', 'anchors', 'readme', 'github'],
  name: 'Markdown TOC',
  outputKind: 'markdown',
  relatedToolIds: ['markdown-helper', 'markdown-to-html', 'slugify'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const result = markdownToc(text, {
        bullet: choiceField(fields.bullet, '-', bullets, 'Choose a list style.'),
        maxLevel: Number(choiceField(fields.maxLevel, '3', levels, 'Choose a heading level.')),
        minLevel: Number(choiceField(fields.minLevel, '2', levels, 'Choose a heading level.')),
      });

      return {
        summary: `${result.headings} ${result.headings === 1 ? 'heading' : 'headings'}`,
        text: result.text,
      };
    }),
  samples: [
    {
      fields: {},
      label: 'Simple README',
      text: '# Project\n## Install\n## Usage\n### CLI\n### API',
    },
    { fields: {}, label: 'Duplicate headings', text: '## Notes\n## Notes\n## Notes' },
    { fields: { minLevel: '1' }, label: 'From the title', text: '# Guide\n## Start\n### Detail' },
    { fields: { bullet: 'ordered' }, label: 'Numbered', text: '## One\n### One A\n## Two' },
    { fields: {}, label: 'Setext headings', text: 'Overview\n========\n\nDetails\n-------' },
    { fields: {}, label: 'Code is skipped', text: '## Real\n```\n## Not real\n```\n## Also real' },
  ],
  supportsSelection: true,
};
