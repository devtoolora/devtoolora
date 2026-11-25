import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import {
  compareSpecificity,
  selectorSpecificity,
  type Specificity,
} from '@devtoolora/functions/css';
import { withToolError } from '../../../adapters/errors';
import { calculatorResult, cssGeneratorDefaults } from '../shared';

const oneLine = (selector: string) => selector.replace(/\s+/g, ' ');

// Counts code points so an emoji is never cut in half.
function shorten(selector: string): string {
  const points = Array.from(selector);

  return points.length > 120 ? `${points.slice(0, 120).join('')}…` : selector;
}

function runSpecificity(text: string): ToolResult {
  const rows = withToolError(() => selectorSpecificity(text)).map((row) => ({
    ...row,
    selector: row.error ? shorten(oneLine(row.selector)) : oneLine(row.selector),
  }));
  const invalid = rows.filter((row) => row.error);
  const valid = rows.flatMap(({ selector, specificity }) =>
    specificity ? [{ selector, specificity }] : [],
  );

  if (valid.length === 0) {
    const first = invalid[0];

    throw new ToolError(
      first
        ? `No valid selector. ${first.selector} — ${first.error}`
        : 'Enter at least one selector.',
    );
  }

  const cell = (specificity: Specificity) => specificity.join(',');
  const width = Math.max(5, ...valid.map((row) => cell(row.specificity).length));
  const lines = rows.map((row) =>
    row.specificity
      ? `${cell(row.specificity).padEnd(width)}  ${row.selector}`
      : `${'error'.padEnd(width)}  ${row.selector} — ${row.error}`,
  );
  const highest = valid.reduce((best, row) =>
    compareSpecificity(row.specificity, best.specificity) > 0 ? row : best,
  );
  const counts = `${rows.length} selector${rows.length === 1 ? '' : 's'}${invalid.length > 0 ? `, ${invalid.length} invalid` : ''}`;

  return calculatorResult(
    [`${'a,b,c'.padEnd(width)}  Selector`, ...lines, ''].join('\n'),
    'css-specificity.txt',
    `${counts}. Highest: ${highest.selector} (${cell(highest.specificity)}).`,
    'plaintext',
  );
}

const sample = (label: string, text: string) => ({ label, text });

export const cssSpecificityCalculatorTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Calculate the Selectors Level 4 specificity (a,b,c) of one or many CSS selectors, including :is(), :not(), :has(), :where() and :nth-child(… of S).',
  id: 'css-specificity-calculator',
  inputKind: 'text',
  inputPresentation: {
    label: 'Selectors',
    placeholder: 'One selector per line or comma-separated, e.g. #nav .item > a:hover',
  },
  keywords: ['specificity', 'selector', 'cascade', ':is', ':where', ':not'],
  name: 'CSS Specificity Calculator',
  relatedToolIds: ['css-format', 'css-grid-generator'],
  run: ({ text }) => runSpecificity(text),
  samples: [
    sample('Navigation link', '#nav .item > a:hover'),
    sample('Compare a list', '.card .title\n#main h2\nbody .card > h2.title'),
    sample(':is() vs :where()', ':is(#a, .b) span\n:where(#a) .b'),
    sample(':nth-child of S', 'li:nth-child(2n+1 of .important)\nli:nth-child(2n+1)'),
    sample('Pseudo-elements', 'a::before\na:before\n::slotted(span)\n::part(label)'),
    sample('Shadow DOM and :has()', ':host(.dark) p\n:has(> img)\ninput:not([type="checkbox"])'),
  ],
};
