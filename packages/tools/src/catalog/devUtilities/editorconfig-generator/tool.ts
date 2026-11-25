import { ToolError, type ToolDefinition } from '@devtoolora/core';
import {
  editorconfigSections,
  generateEditorconfig,
  type EditorconfigOptions,
  type EditorconfigSection,
} from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const indentStyles = ['space', 'tab', 'omit'] as const;
const endOfLines = ['lf', 'crlf', 'cr', 'omit'] as const;
const charsets = ['utf-8', 'utf-8-bom', 'utf-16be', 'utf-16le', 'latin1', 'omit'] as const;
const flags = ['true', 'false', 'omit'] as const;

const sectionLabels: Record<EditorconfigSection, string> = {
  go: 'Go',
  makefile: 'Makefile',
  markdown: 'Markdown',
  python: 'Python',
  windows: 'Windows scripts',
  yaml: 'YAML',
};

const flagOptions = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
  { label: 'Not set', value: 'omit' },
];

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

function parseIndentSize(value: string | undefined): number | 'omit' {
  const text = (value ?? '').trim();

  if (text === '') return 'omit';

  // NaN fails the integer check in generateEditorconfig, which reports the 1-16 limit.
  return /^\d{1,3}$/.test(text) ? Number(text) : NaN;
}

function parseSections(value: string | undefined): EditorconfigSection[] {
  const ids = (value ?? '').split(',').filter(Boolean);

  if (ids.some((id) => !(editorconfigSections as readonly string[]).includes(id)))
    throw new ToolError('Choose listed language sections.');

  return ids as EditorconfigSection[];
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const editorconfigGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Build an .editorconfig with indent, line ending, charset and whitespace settings plus Markdown, Makefile, Go, Python, YAML and Windows sections.',
  fields: [
    { defaultValue: 'true', id: 'root', label: 'root = true', type: 'checkbox' },
    {
      defaultValue: 'space',
      id: 'indentStyle',
      label: 'Indent style',
      options: [
        { label: 'Spaces', value: 'space' },
        { label: 'Tabs', value: 'tab' },
        { label: 'Not set', value: 'omit' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '2',
      help: 'Blank means not set.',
      id: 'indentSize',
      label: 'Indent size',
      type: 'number',
    },
    {
      defaultValue: 'lf',
      id: 'endOfLine',
      label: 'End of line',
      options: [
        { label: 'LF', value: 'lf' },
        { label: 'CRLF', value: 'crlf' },
        { label: 'CR', value: 'cr' },
        { label: 'Not set', value: 'omit' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'utf-8',
      id: 'charset',
      label: 'Charset',
      options: [
        { label: 'UTF-8', value: 'utf-8' },
        { label: 'UTF-8 with BOM', value: 'utf-8-bom' },
        { label: 'UTF-16 BE', value: 'utf-16be' },
        { label: 'UTF-16 LE', value: 'utf-16le' },
        { label: 'Latin 1', value: 'latin1' },
        { label: 'Not set', value: 'omit' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'true',
      id: 'trimTrailingWhitespace',
      label: 'Trim trailing whitespace',
      options: flagOptions,
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      id: 'insertFinalNewline',
      label: 'Insert final newline',
      options: flagOptions,
      presentation: 'segmented',
      type: 'select',
    },
    {
      id: 'sections',
      label: 'Language sections',
      options: editorconfigSections.map((value) => ({ label: sectionLabels[value], value })),
      type: 'checkboxGroup',
    },
  ],
  freshResults: true,
  id: 'editorconfig-generator',
  inputKind: 'none',
  keywords: ['editorconfig', 'indent', 'tabs', 'spaces', 'charset', 'end of line', 'eol', 'style'],
  name: '.editorconfig Generator',
  outputKind: 'text',
  relatedToolIds: ['gitignore-generator', 'license-generator', 'whitespace-cleaner'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const options: EditorconfigOptions = {
        charset: choiceField(fields.charset, 'utf-8', charsets, 'Choose a listed charset.'),
        endOfLine: choiceField(fields.endOfLine, 'lf', endOfLines, 'Choose a listed line ending.'),
        indentSize: parseIndentSize(fields.indentSize),
        indentStyle: choiceField(
          fields.indentStyle,
          'space',
          indentStyles,
          'Choose a listed indent style.',
        ),
        insertFinalNewline: choiceField(
          fields.insertFinalNewline,
          'true',
          flags,
          'Choose Yes, No or Not set.',
        ),
        root: booleanField(fields.root, true),
        sections: parseSections(fields.sections),
        trimTrailingWhitespace: choiceField(
          fields.trimTrailingWhitespace,
          'true',
          flags,
          'Choose Yes, No or Not set.',
        ),
      };
      const { properties, sections, text } = generateEditorconfig(options);

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName: '.editorconfig',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: `${plural(sections, 'section')} · ${plural(properties, 'property', 'properties')}.`,
        text,
      };
    }),
  samples: [
    sample('Default', { indentSize: '2' }),
    sample('Tabs everywhere', { endOfLine: 'lf', indentSize: '4', indentStyle: 'tab' }),
    sample('Web project', { indentSize: '2', sections: 'markdown,yaml' }),
    sample('Python project', { indentSize: '4', sections: 'markdown,python,makefile' }),
    sample('Go project', { indentSize: '', indentStyle: 'tab', sections: 'go,makefile' }),
    sample('Windows repo', {
      indentSize: '2',
      charset: 'utf-8-bom',
      endOfLine: 'crlf',
      sections: 'windows',
    }),
    sample('Everything', {
      indentSize: '2',
      sections: 'markdown,makefile,go,python,yaml,windows',
    }),
  ],
  supportsSelection: false,
};
