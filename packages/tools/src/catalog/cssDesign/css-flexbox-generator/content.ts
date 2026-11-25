import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Flexbox lines items up along one main axis. Direction picks a row or a column, Distribution (justify-content) spreads items along that axis and Item alignment (align-items) positions them across it.',
        'Wrapping lets items move onto new lines. Multi-line distribution (align-content) then spreads those lines when the container has spare cross-axis space; on a single line it has no visible effect.',
        'The featured item gets its own flex and order rule under .layout > .item--featured, so you can see how one item grows, shrinks or moves without changing its siblings.',
      ],
      title: 'What is a CSS flex layout?',
    },
    {
      content: [
        'Build navigation bars, toolbars, button groups and vertical stacks while watching alignment change.',
        'Compare No wrap with Wrap to see when items overflow and when they move to a new line.',
        'Tune one item’s flex-grow, flex-shrink, flex-basis and order without touching the others.',
        'Export the container and item rules, then apply them to your real markup and content.',
      ],
      title: 'When to use CSS Flexbox Generator',
    },
  ],
  examples: [
    'Distribution Space between, Item alignment Center, Gap 12 → justify-content: space-between; align-items: center; gap: 12px;',
    'Wrapping Wrap → flex-wrap: wrap; the preview shows eight items so several lines appear.',
    'Featured item grow 1, shrink 1, basis 120 → .layout > .item--featured { flex: 1 1 120px; order: 0; }',
    'Featured item grow 0.5, shrink 0.25 → flex: 0.5 0.25 120px; factors keep up to two decimals.',
    'Featured item order -1 → order: -1; Search moves to the front visually while the HTML order stays the same.',
    'Direction Row reverse → flex-direction: row-reverse; the first item in the HTML is drawn at the end of the row.',
  ],
  faq: [
    {
      answer:
        'justify-content (Distribution) spaces items along the main axis set by Direction, and align-items (Item alignment) positions them across it. In a row the first works horizontally and the second vertically; in a column they swap.',
      question: 'What is the difference between justify-content and align-items?',
    },
    {
      answer:
        'align-content spreads whole lines of items, so it does nothing while everything fits on one line. Set Wrapping to Wrap and give the container more cross-axis space than the lines need.',
      question: 'Why does align-content have no effect?',
    },
    {
      answer:
        'It is shorthand for flex-grow: 0, flex-shrink: 1 and flex-basis: 120px: the item starts at 120 px, does not grow into spare space and can shrink when space runs out.',
      question: 'What does flex: 0 1 120px mean?',
    },
    {
      answer:
        'Flex items do not shrink below their minimum content size by default, such as a long word or an image. Add min-width: 0 to the item, or min-height: 0 in a column, so flex-shrink can take it smaller.',
      question: 'Why does my flex item not shrink?',
    },
    {
      answer:
        'Use flexbox to line items up in one direction, such as a toolbar or a row of buttons sized by their content. Use CSS Grid when rows and columns must line up in both directions.',
      question: 'Should I use flexbox or grid?',
    },
  ],
  help: 'Choose Direction and Wrapping, or pick a sample from Apply sample.\n\nSet Distribution, Item alignment and Multi-line distribution, and drag Gap to change the space between items.\n\nUse Featured item grow, Featured item shrink, Featured item basis and Featured item order to change the highlighted Search item in the live preview.\n\nCopy the CSS or download flexbox.css and the css-flexbox-report.json audit.',
  notes: [
    'Gap accepts 0–96 px, Featured item basis 0–800 px and Featured item order −12 to 12, as whole numbers. Grow and shrink accept 0–12 with up to two decimals; more decimals are rejected.',
    'Empty, nonnumeric and out-of-range values show an error instead of being clamped, and unknown choices are not replaced with defaults.',
    'order and the reverse directions change only the visual order. Tab order and screen reader order still follow the HTML.',
    'Multi-line distribution needs Wrap or Wrap reverse and spare cross-axis space before it changes anything.',
    'The CSS uses the class names .layout and .item--featured. Preview labels, colors and stage size are not exported.',
  ],
};
