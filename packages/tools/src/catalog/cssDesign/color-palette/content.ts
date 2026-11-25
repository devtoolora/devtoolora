import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A palette combines a base color with hues selected by a scheme: complementary 180°, analogous ±30°, triadic 120°/240°, split 150°/210°.',
        'Preserves the base color and 500 shade. Contrast ratios compare opaque sRGB on white and black.',
      ],
      title: 'What is a color palette?',
    },
    {
      content: [
        'Explore accent hues without losing your starting color.',
        'Compare 50/200/500/700/900 swatches and inspect white/black contrast.',
      ],
      title: 'When to use Color Palette & Contrast',
    },
  ],
  examples: [
    '#2563eb, Complementary → base-500 #2563eb and accent1-500 #ebad25, the hue rotated 180°.',
    'rgb(37, 99, 235), Analogous → accent1-500 #4a25eb and accent2-500 #25c6eb, 30° on either side.',
    '#2563eb → contrastOnWhite 5.17 and contrastOnBlack 4.06, so it reaches 4.5:1 only on white.',
    '#808080, Triadic → accent1 and accent2 are also #808080, because a gray has no hue to rotate.',
    '#2563eb → color-palette.css with --base-50: #e9effd; through --base-900: #082157; then use color: var(--base-700).',
  ],
  faq: [
    {
      answer:
        'Three- or six-digit hex with or without #, rgb() with comma-separated whole numbers, and hsl() with commas, such as hsl(221, 83%, 53%). Alpha, named colors and space-separated syntax are rejected; convert them first in Color Converter.',
      question: 'Which color formats can I enter?',
    },
    {
      answer:
        'Yes. The base family’s base and 500 shade are your input written as hex, so #2563eb stays #2563eb. Accent families reuse its saturation and lightness at rotated hues.',
      question: 'Does the palette keep my exact brand color?',
    },
    {
      answer:
        'Each family keeps its hue and saturation and changes HSL lightness: 50 and 200 move 90% and 55% of the way to white, while 700 and 900 keep 70% and 35% of the lightness. HSL steps are not perceptually even, so adjust by eye.',
      question: 'How are the 50 to 900 shades calculated?',
    },
    {
      answer:
        'A gray, black or white base has no saturation, so rotating its hue changes nothing and every family repeats the base shades. Start from a colored base to get distinct accents.',
      question: 'Why are all my accent colors gray?',
    },
    {
      answer:
        'color-palette.css defines custom properties on :root, such as --base-500 and --accent1-700. Include it in your stylesheet and use the values with var(), for example color: var(--base-700).',
      question: 'How do I use the exported CSS variables?',
    },
    {
      answer:
        'Lc is signed lightness contrast: positive means dark text on a lighter background, negative means light text on a darker one. Roughly, Lc 75 suits body text, 60 content text and 45 large text. It is a draft guideline, not a pass or fail rule.',
      question: 'How do I read the APCA Lc value?',
    },
  ],
  help: 'Enter a three/six-digit hex color, integer rgb(), or hsl(). Alpha and named colors are not accepted.\n\nChoose a scheme and compare live swatches.\n\nWhite/black ratios rounded for display. Normal-text AA is 4.5:1; large text is 3:1.\n\nCopy report or download color-palette.json and color-palette.css.',
  notes: [
    'Colors are opaque sRGB; compositing, gradients, opacity and arbitrary backgrounds are not assessed.',
    'Shade labels describe relative lightness, not Tailwind tokens.',
    'Normal text needs at least 4.5:1 for WCAG AA; large text needs 3:1.',
    'APCA 0.0.98G-4g is the WCAG 3 draft contrast method; it is not a conformance requirement, so WCAG 2 ratios remain the standard.',
    'CSS exports include custom properties only, not UI styles.',
  ],
};
