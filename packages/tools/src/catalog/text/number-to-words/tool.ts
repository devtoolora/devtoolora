import { ToolDefinition } from '@devtoolora/core';
import { numbersToWords, separatorReadings } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { withWarning } from '../../../adapters/summary';

const styles = ['cardinal', 'ordinal', 'currency'] as const;

export const numberToWordsTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description: 'Spell numbers out in English words as cardinals, ordinals or cheque amounts.',
  fields: [
    {
      defaultValue: 'cardinal',
      id: 'style',
      label: 'Style',
      options: [
        { label: 'Cardinal', value: 'cardinal' },
        { label: 'Ordinal', value: 'ordinal' },
        { label: 'Cheque (and 45/100)', value: 'currency' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'number-to-words',
  inputKind: 'text',
  keywords: ['number to words', 'spell number', 'ordinal', 'cheque', 'check amount', 'cardinal'],
  name: 'Number to Words',
  outputKind: 'text',
  relatedToolIds: ['number-formatter', 'base-converter'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const style = choiceField(fields.style, 'cardinal', styles, 'Choose a style.');
      const count = text.split(/\r\n|\r|\n/).filter((line) => line.trim()).length;

      const words = numbersToWords(text, style);

      return {
        summary: withWarning(
          `${count} ${count === 1 ? 'number' : 'numbers'}`,
          separatorReadings(text),
        ),
        text: words,
      };
    }),
  samples: [
    { fields: {}, label: 'Cardinal', text: '1234567' },
    { fields: {}, label: 'Decimal', text: '-12.05' },
    { fields: {}, label: 'Grouped digits', text: '1,000,000' },
    { fields: { style: 'ordinal' }, label: 'Ordinal', text: '21' },
    { fields: { style: 'currency' }, label: 'Cheque amount', text: '1234.5' },
    { fields: {}, label: 'One per line', text: '7\n42\n100' },
  ],
  supportsSelection: true,
};
