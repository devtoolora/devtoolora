import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'CSS Grid places items in rows and columns. This generator writes a .layout rule with a fixed number of equal columns, repeat(Columns, minmax(Minimum track, 1fr)), so every column is at least that wide and shares the remaining space equally.',
        'Rows use repeat(Rows, minmax(80px, auto)): at least 80 px tall and taller when content needs it. Items beyond the explicit cells go into extra tracks according to Auto flow.',
        'Item alignment (justify-items, align-items) positions each item inside its cell. Content distribution (justify-content, align-content) positions the whole set of tracks, which only shows when the tracks leave spare space.',
      ],
      title: 'What is a CSS grid layout?',
    },
    {
      content: [
        'Lay out card grids, galleries and dashboards with a fixed column count and separate row and column gaps.',
        'See how row or column auto flow and dense packing place numbered items before writing the CSS by hand.',
        'Find out when minimum track widths overflow a narrow container instead of shrinking.',
        'Copy a starting container rule, then add spans, explicit placement or breakpoints in your own stylesheet.',
      ],
      title: 'When to use CSS Grid Generator',
    },
  ],
  examples: [
    'Columns 3, Minimum track 180, gaps 16 → grid-template-columns: repeat(3, minmax(180px, 1fr)); column-gap: 16px; row-gap: 16px;',
    'Rows 2 → grid-template-rows: repeat(2, minmax(80px, auto));',
    'Columns 2, Column gap 8, Row gap 24, Minimum track 80 → repeat(2, minmax(80px, 1fr)) with column-gap: 8px; row-gap: 24px;',
    'Auto flow Column, Rows 3 → grid-auto-flow: column; items fill each column top to bottom before the next one.',
    'Item alignment Center, Item vertical alignment Center → justify-items: center; align-items: center;',
    'Columns 6, Minimum track 600 → repeat(6, minmax(600px, 1fr)), at least 3,680 px wide with the default 16 px gaps, so the preview scrolls.',
  ],
  faq: [
    {
      answer:
        'Each column is at least 120 px wide and at most one equal share (1fr) of the free space. With repeat(3, minmax(120px, 1fr)) three columns share the width equally but never get narrower than 120 px.',
      question: 'What does minmax(120px, 1fr) mean?',
    },
    {
      answer:
        'The generator writes a fixed column count. For columns that wrap on their own, change it by hand to repeat(auto-fit, minmax(180px, 1fr)), or add media queries that change the count at your breakpoints.',
      question: 'How do I make the grid responsive?',
    },
    {
      answer:
        'Every column keeps its Minimum track width, so Columns × Minimum track plus the gaps must fit the container. Lower Minimum track or Columns, or switch the CSS to auto-fit so columns wrap.',
      question: 'Why does my grid overflow on small screens?',
    },
    {
      answer:
        'justify-items moves each item inside its own cell, while justify-content moves the whole set of column tracks inside the container. justify-content only shows when the tracks do not fill the width.',
      question: 'What is the difference between justify-items and justify-content?',
    },
    {
      answer:
        'Dense packing lets later items fill holes left earlier in the grid, usually by items that span several cells. Without spans it looks like normal flow, and it can make the visual order differ from the HTML order.',
      question: 'What does grid-auto-flow: dense do?',
    },
  ],
  help: 'Set Columns, Rows and Minimum track with the sliders or number boxes, or pick a sample from Apply sample.\n\nAdjust Column gap and Row gap separately and watch the numbered items in the live preview.\n\nChoose Auto flow, Item alignment and Item vertical alignment for items, and Content distribution and Content vertical distribution for the tracks as a whole.\n\nCopy the CSS or download grid.css and the css-grid-report.json audit; scroll inside the preview when the columns are wider than the stage.',
  notes: [
    'Columns accept 1–12, Rows 1–8, Column gap and Row gap 0–96 px and Minimum track 40–600 px, as whole numbers. Empty, fractional and out-of-range values show an error instead of being rounded or clamped.',
    'The output always uses a fixed repeat() count, not auto-fit or auto-fill, and adds no media queries, so the minimum track width is kept on narrow screens.',
    'Rows always get an 80 px minimum height; content can make them taller.',
    'Content distribution can look unchanged because 1fr columns already fill the width; it shows with fewer or fixed-size tracks.',
    'Column and dense flow can change the visual order of items relative to the HTML; keyboard and screen reader order still follow the markup.',
    'Only the .layout container rule is exported. Preview labels, colors and stage size are not part of the CSS.',
  ],
};
