import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A color scale is a ladder of shades from 50 (almost white) to 950 (almost black) that share one hue. Design systems such as Tailwind use it so every surface, border and text color comes from the same family.',
        'This tool converts your color to OKLCH, finds the step whose lightness is closest to it and keeps your value there exactly. The other ten steps take a fixed lightness from the ladder, the same hue, and a chroma scaled from yours. Anything outside sRGB, your own color included, is pulled in by reducing chroma, never by changing lightness or hue.',
        "The ladder is the median of Tailwind v4 chromatic palettes. One ladder serves every hue, so Tailwind's own blue-500 lands at step 600 here.",
      ],
      title: 'How is a color scale built from one color?',
    },
    {
      content: [
        'Starting a design system or theme from a single brand color.',
        'Generating hover, active, border and background tints in CSS variables.',
        'Producing a Tailwind v4 @theme block or a v3 colors snippet.',
        'Exporting the same scale as JSON for design tokens.',
      ],
      title: 'When to use Color Scale Generator',
    },
  ],
  examples: [
    '#2563eb → anchor 700, --brand-700: #2563eb;',
    '#3b82f6 → anchor 600',
    '#10b981 → anchor 500, printed as oklch(...) with the OKLCH color format',
    '#fde68a → anchor 200, a light yellow',
    '#1e1b4b → anchor 950, a very dark indigo',
    '#ffffff → anchor 50, all steps gray',
  ],
  faq: [
    {
      answer:
        'Your color is placed at the step with the closest lightness and kept exactly if it fits in sRGB. The ladder is shared by every hue, so a mid blue can land at 600 or 700.',
      question: 'Why is my color not at step 500?',
    },
    {
      answer:
        'Very light and very dark steps cannot hold as much chroma in sRGB. Chroma is reduced at constant lightness and hue until the color fits, and the JSON report marks those steps.',
      question: 'Why do some steps look less saturated?',
    },
    {
      answer:
        'No. Colors with transparency are rejected, because shades of a translucent color are ambiguous. Use an opaque color.',
      question: 'Can I use a color with alpha?',
    },
    {
      answer:
        'Use the Tailwind v4 format and paste the @theme block into your CSS. The v3 format gives a colors snippet for tailwind.config.js.',
      question: 'How do I use this in Tailwind?',
    },
  ],
  help: 'Paste one opaque CSS color: hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or a color name.\n\nChoose a Name for the variables, an output Format and whether values print as hex or OKLCH.\n\nThe preview shows all eleven steps with the anchor step marked. The summary names the anchor step.\n\nCopy the output or download it together with a JSON report listing each step, its hex, its OKLCH value and whether it was gamut mapped.',
  notes: [
    'An input that fits in sRGB is kept exactly at its anchor step. A wider color is mapped into sRGB first, and the summary says so.',
    'Names use lowercase letters, digits and hyphens, start with a letter and have up to 32 characters.',
    'Colors with an alpha channel below 1 are rejected.',
    'Achromatic inputs (white, black, grays) give a gray scale.',
    "One lightness ladder serves every hue, so results differ from hand-tuned palettes: Tailwind's own blue-500 lands at step 600.",
    'OKLCH values print as oklch(L% C H) with L to 2 decimals, C to 4 and H to 2.',
  ],
};
