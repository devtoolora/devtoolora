import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'CSS has no mesh gradient, but stacking several radial gradients that fade to transparent gives the same soft, blended look. Each color gets one layer centered at its own point, and the background color shows between them.',
        'The points are picked from the seed, so the same seed always gives the same picture. Move the seed slider to shuffle the layout without touching the colors.',
        'The SVG artifact draws the same picture at 800 by 600. Each layer is a radialGradient whose radii are the square root of two times the farthest-side distance on each axis, which matches the CSS ellipse farthest-corner size.',
      ],
      title: 'How does a mesh gradient work in CSS?',
    },
    {
      content: [
        'Hero and landing page backgrounds.',
        'Cards, banners and social images that need a soft color wash.',
        'Replacing a heavy background image with two lines of CSS.',
        'Quickly exploring layouts by shuffling the seed.',
      ],
      title: 'When to use Mesh Gradient Generator',
    },
  ],
  examples: [
    'Pastel default (seed 7) → .mesh { background-color: #f8fafc; background-image: radial-gradient(at X% Y%, #f472b6 0px, transparent 50%), … }',
    'Five colors (seed 42) → five radial-gradient layers in color order',
    'Dark aurora → background-color: #0f172a with cyan, violet and green layers',
    'Six colors (seed 2024) → six layers, the first color paints on top',
    'Warm sunset → background-color: #fff7ed with orange, pink, yellow and red',
    'Seed 8 instead of 7 → the same colors at different positions',
  ],
  faq: [
    {
      answer:
        'The first listed layer paints on top, so the first color is the most visible where layers overlap.',
      question: 'Which color is on top?',
    },
    {
      answer: 'Positions come from the seed. Change the seed to move the points.',
      question: 'Why does the layout change when I move the seed?',
    },
    {
      answer: 'Yes. Any CSS color works, for example rgb(59 130 246) or oklch(62% 0.19 260).',
      question: 'Can I use colors other than hex?',
    },
    {
      answer:
        'Download mesh-gradient.svg from the artifacts. It uses plain radialGradient elements and works as an image.',
      question: 'How do I get an image?',
    },
  ],
  help: 'Pick a Background and the number of Colors, then set each color. The Seed positions the points.\n\nThe preview applies exactly the exported declarations. Move the Seed slider to shuffle the layout.\n\nThe output is a .mesh rule with a background-color and one radial-gradient layer per color. The first color paints on top.\n\nCopy the CSS or download mesh-gradient.css, the audit report and mesh-gradient.svg. The preview swatch size and radius are not exported.',
  notes: [
    'Colors can be any CSS color; other text is rejected, and a hex color needs its #.',
    'Seed is 1 to 9999. Out-of-range values are rejected, never clamped.',
    'Positions are whole percentages from 0 to 100.',
    'Each layer fades to transparent at 50% with 3 or 4 colors, 40% with 5 and 33% with 6.',
    'The SVG is 800 by 600 and uses user-space radial gradients.',
    'The same seed and colors always give the same result.',
  ],
};
