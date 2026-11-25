import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Specificity is three counts compared left to right: a counts id selectors, b counts classes, attribute selectors and pseudo-classes, and c counts type selectors and pseudo-elements. A higher a always wins, whatever b and c are.',
        'The universal selector *, combinators (space, >, + and ~) and :where() add nothing. :is(), :not() and :has() take the specificity of their most specific argument, and :nth-child(An+B of S) adds one pseudo-class plus its most specific S.',
        'When two rules have equal specificity, the one that comes later in the stylesheet wins. Inline styles, !important, cascade layers and @scope proximity are decided outside specificity.',
      ],
      title: 'How is CSS specificity calculated?',
    },
    {
      content: [
        'Finding out why a rule does not apply although it matches the element.',
        'Comparing several candidate selectors before you refactor a stylesheet.',
        'Checking that :where() really keeps a reset or library rule easy to override.',
        'Reviewing selectors for Shadow DOM with :host(), ::slotted() and ::part().',
      ],
      title: 'When to use CSS Specificity Calculator',
    },
  ],
  examples: [
    '#nav .item > a:hover → 1,2,1',
    ':where(#a) .b → 0,1,0',
    ':is(#a, .b) span → 1,0,1',
    'li:nth-child(2n+1 of .important) → 0,2,1',
    'a:before → 0,0,2, the same as a::before',
    '[data-x="a,b"], .c → two rows, 0,1,0 each',
    '.a & → error: & depends on the parent rule; paste the resolved selector.',
  ],
  faq: [
    {
      answer:
        ':where() always counts zero, so a rule inside it is easy to override. :is() counts as its most specific argument, so :is(#a, .b) weighs as much as an id even when .b matches.',
      question: 'What is the difference between :is() and :where()?',
    },
    {
      answer:
        'No. 11 classes give 0,11,0, which still loses to a single id at 1,0,0. The three counts are compared one by one and never carry over.',
      question: 'Do many classes ever beat one id?',
    },
    {
      answer:
        'The & selector stands for the parent rule, so its weight depends on a selector the tool cannot see. Paste the resolved selector, for example .card .title instead of & .title.',
      question: 'Why is a selector with & shown as an error?',
    },
    {
      answer:
        'Each invalid selector gets its own error row with the reason, and the other selectors are still calculated. The run only fails when no selector in the input is valid.',
      question: 'What happens with an invalid selector?',
    },
  ],
  help: 'Paste one or more CSS selectors, one per line or separated by commas. Commas inside parentheses, attribute brackets or quotes do not split a selector, and blank lines are skipped.\n\nThe result is a table in input order. The a,b,c column comes first: ids, then classes, attributes and pseudo-classes, then types and pseudo-elements. The selector follows it.\n\nAn invalid selector gets an error row with the reason, and the other rows are still calculated. The summary gives the number of selectors and the most specific one; on a tie the first one wins.\n\nCopy the table or download css-specificity.txt. The calculation follows Selectors Level 4 and runs entirely in your browser.',
  notes: [
    'Input is limited to 100,000 characters and 200 selectors; each selector is limited to 2,000 characters.',
    'Vendor functional pseudo-classes such as :-webkit-any() and :-moz-any() count a flat 0,1,0, as the legacy engines did, not the weight of their arguments.',
    'Functional pseudo-classes such as :is() and :not() can be nested up to 32 levels.',
    'Invalid arguments inside :is() and :where() are dropped, as browsers do. If none is left, :is() counts zero.',
    ':not(), :has() and :nth-child(… of S) are strict: one invalid argument makes the whole selector invalid.',
    'The legacy single-colon :before, :after, :first-line and :first-letter count as pseudo-elements.',
    'Pseudo-class and pseudo-element names are case-insensitive, and CSS escapes such as #\\31 23 are decoded.',
    'Nesting (&) and @scope proximity are not calculated; paste the resolved selector instead.',
    'Unknown pseudo-class and pseudo-element names such as :hovr or ::befor are rejected; vendor-prefixed names (-webkit-, -moz-, -ms-, -o-) are accepted and counted.',
    'Empty segments between commas, as in a , , b, and comment-only lines are skipped instead of failing the list.',
  ],
};
