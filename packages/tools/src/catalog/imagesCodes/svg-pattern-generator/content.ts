import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An SVG pattern is a small tile that the browser repeats in both directions to fill a background. The tool draws the tile so its edges line up, then wraps it in a CSS rule that uses it as a data URI background image.',
        'Dots place one circle in the middle of the tile. Grid draws a line along the top and left edges. Diagonal draws one line across the tile plus two corner stubs so the stripes continue across tile borders. Zigzag draws a three-point polyline, and checkers fills two opposite quarters.',
        'The output is a .pattern rule with background-color (unless transparent), a background-image with the URL-encoded tile, and a background-size equal to the tile size. The tile itself is also available as pattern-tile.svg.',
      ],
      title: 'What is an SVG pattern background?',
    },
    {
      content: [
        'Subtle textures behind hero sections and cards.',
        'Grid paper or dotted backgrounds for editors and dashboards.',
        'Loading skeletons and placeholder areas.',
        'Replacing a repeated raster image with a tiny, sharp, scalable tile.',
      ],
      title: 'When to use SVG Pattern Generator',
    },
  ],
  examples: [
    'Polka dots (24px tile, 2px dots) → one dot per tile',
    'Grid paper (1px lines) → a thin slate grid',
    'Diagonal stripes (16px tile) → continuous diagonal lines',
    'Zigzag (32px tile) → a rose zigzag row',
    'Checkerboard (40px tile) → dark and light 20px squares',
    'Transparent dots → no background-color, so the pattern sits on any surface',
  ],
  faq: [
    {
      answer:
        'Grid lines are inset by half their width so the full width shows inside the tile. The limit keeps a visible gap between lines and keeps zigzag peaks inside the tile.',
      question: 'Why is the line width limited to half the tile?',
    },
    {
      answer:
        'Turn on Transparent background. The tile then has no background rect and the CSS has no background-color.',
      question: 'How do I put the pattern on top of another color?',
    },
    {
      answer:
        'The URL-encoded form is smaller than Base64 and stays readable. Special characters such as # and < are percent-encoded.',
      question: 'Why is the data URI not Base64?',
    },
    {
      answer: 'Yes. Download pattern-tile.svg and use it as an image.',
      question: 'Can I use the tile outside CSS?',
    },
  ],
  help: 'Choose a Pattern, set the Tile size and Stroke size, then pick the Foreground and Background colors.\n\nTurn on Transparent background to leave the background out.\n\nThe preview repeats the tile across a 320 by 200 area.\n\nCopy the .pattern rule or download pattern-tile.svg. Values outside a slider range are rejected, never clamped.',
  notes: [
    'Tile size is 4 to 200 px, stroke size 1 to 50 px.',
    'For dots the stroke size is the diameter and may reach the tile size.',
    'For lines the stroke size may be at most half of the tile size.',
    'Colors must be opaque CSS colors.',
    'Out-of-range values are rejected, never clamped.',
    'The same settings always give the same CSS.',
  ],
};
