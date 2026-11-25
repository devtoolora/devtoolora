import { ToolDefinition } from '@devtoolora/core';
import { ansiToHtml, stripAnsi } from '@devtoolora/functions/logs';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, logOutput } from '../shared';

const ESC = String.fromCharCode(27);
const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;
const colored = `${ESC}[32mINFO${ESC}[0m server started on port 8080\n${ESC}[33mWARN${ESC}[0m cache is cold\n${ESC}[31mERROR${ESC}[0m request failed`;
const styled = `${ESC}[1;31mFAIL${ESC}[0m test.ts\n${ESC}[4mUnderlined${ESC}[24m ${ESC}[3mitalic${ESC}[23m ${ESC}[9mgone${ESC}[29m`;

const makeSamples = (mode: string): NonNullable<ToolDefinition['samples']> => [
  { fields: { mode }, label: 'Colored log levels', text: colored },
  { fields: { mode }, label: 'Bold and underline', text: styled },
  {
    fields: { mode },
    label: '256 colors and true color',
    text: `${ESC}[38;5;208morange${ESC}[0m ${ESC}[38;2;10;120;200;48;5;236mrgb on grey${ESC}[0m`,
  },
  {
    fields: { mode },
    label: 'Cursor and screen codes',
    text: `${ESC}[2J${ESC}[Hbuild started\n${ESC}[?25lprogress 50%${ESC}[K\n${ESC}[?25hdone`,
  },
  {
    fields: { mode },
    label: 'Window title',
    text: `${ESC}]0;npm test${String.fromCharCode(7)}${ESC}[36mrunning${ESC}[0m <tests> & "more"`,
  },
  {
    fields: { mode },
    label: 'Inverse and bright colors',
    text: `${ESC}[7mselected${ESC}[27m ${ESC}[91;103mbright${ESC}[0m`,
  },
];

export const ansiStripperTool: ToolDefinition = {
  id: 'ansi-stripper',
  name: 'ANSI Escape Stripper & ANSI to HTML',
  category: 'Logs & Diagnostics',
  description:
    'Remove ANSI color and cursor escape sequences from terminal output, or turn the colors into styled HTML.',
  samples: makeSamples('strip'),
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'strip',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Strip', value: 'strip' },
        { label: 'To HTML', value: 'html' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  keywords: ['ansi', 'escape', 'terminal', 'color', 'strip', 'html', 'console', 'sgr'],
  relatedToolIds: ['log-filter', 'html-entities', 'stack-trace-cleaner'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text, fields }) =>
    withToolError(() => {
      if (fields.mode === 'html') {
        const result = ansiToHtml(text);

        return logOutput(
          result.text,
          'output.html',
          'html',
          `HTML · ${plural(result.spans, 'styled span')}`,
        );
      }

      const result = stripAnsi(text);
      const lines = result.text === '' ? 0 : result.text.replace(/\n$/, '').split('\n').length;

      return logOutput(
        result.text,
        'plain.log',
        'plaintext',
        `${plural(result.removed, 'sequence')} removed · ${plural(lines, 'line')}`,
      );
    }),
};

export const ansiToHtmlTool: ToolDefinition = {
  ...ansiStripperTool,
  aliasOf: 'ansi-stripper',
  description: 'Convert ANSI colors and text styles in terminal output into styled HTML.',
  fields: ansiStripperTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'html' } : field,
  ),
  id: 'ansi-to-html',
  name: 'ANSI to HTML Converter',
  samples: makeSamples('html'),
};
