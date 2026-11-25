import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'text-shadow paints one or more blurred, offset copies of a text’s glyphs behind it. Each layer has a horizontal offset, a vertical offset, a blur radius and a color, written as x y blur color. Unlike box-shadow it follows the letter shapes and has no spread or inset.',
        'Layers are comma-separated and the first layer paints on top. Stacking a tight dark layer over a wide soft one gives depth; several zero-blur layers at growing offsets give a long shadow; a light layer above a dark one gives an embossed look.',
        'A shadow is only readable against its background, so the preview lets you switch between light, dark and brand surfaces. Check contrast on every surface your text can appear on.',
      ],
      title: 'What is text-shadow?',
    },
    {
      content: [
        'Lift headings off busy photos and gradients so they stay readable.',
        'Create neon glows, retro hard shadows, outlines and embossed letters without images.',
        'Fine-tune offsets and opacity with sliders and copy a single text-shadow rule.',
        'Export a rule you can apply to any selector by renaming .text.',
      ],
      title: 'When to use CSS Text Shadow Generator',
    },
  ],
  examples: [
    'Default → .text { text-shadow: 2px 2px 4px rgba(15, 23, 42, 0.35); }',
    'Hard offset → text-shadow: 3px 3px 0px #172033;',
    'Neon glow → two zero-offset layers in cyan with blur 6px and 18px.',
    'Embossed → a white layer at 0 1px over a dark layer at 0 -1px.',
    'Outline → four layers at ±1px with zero blur around the glyphs.',
    'Long shadow → three zero-blur layers at 4px, 8px and 12px offsets.',
  ],
  faq: [
    {
      answer:
        'No. text-shadow takes x, y, blur and color only. If you need a spread or an inset shadow, use the CSS Box Shadow Generator on the element box.',
      question: 'Does text-shadow have spread or inset?',
    },
    {
      answer:
        'The first layer in the list paints on top of the following ones. Use Move up and Move down to reorder layers.',
      question: 'Which layer is drawn on top?',
    },
    {
      answer:
        'Add up to 5 layers. Remove one first when Add layer is disabled. Each layer is limited to offsets of -100 to 100 px and blur of 0 to 100 px.',
      question: 'How many layers can I use?',
    },
    {
      answer:
        'Colors may be #RGB, #RGBA, #RRGGBB, #RRGGBBAA or comma-form rgb() and rgba(). They are written to the CSS exactly as typed, trimmed.',
      question: 'Which color formats are accepted?',
    },
    {
      answer:
        'Wide blurs on small, thin text can reduce legibility and cost paint time on large areas. Keep blur modest and test contrast on each surface.',
      question: 'Is there a readability or performance cost?',
    },
  ],
  help: 'Pick a sample from Apply sample, or move the Horizontal, Vertical and Blur sliders of each layer.\n\nChoose a color with the picker and set its Opacity. Use Add layer for up to 5 layers, and Move up, Move down or Remove to arrange them.\n\nSwitch the preview Surface between light, dark and brand tint to judge contrast on the big headline.\n\nCopy the CSS or download text-shadow.css and the audit report; open Layer JSON (advanced) to type exact values.',
  notes: [
    'A text shadow needs 1 to 5 layers. Offsets run from -100 to 100 px and blur from 0 to 100 px; values outside the range are rejected, never clamped.',
    'Layer JSON is an array of objects with exactly x, y, blur and a string color. A spread or inset key, unknown properties, invalid JSON and input over 4,000 characters show an error and no CSS.',
    'Colors are validated before they reach the CSS, so text such as semicolons or braces is rejected.',
    'Numbers are rounded to 2 decimals and lengths keep their unit, so a zero offset prints as 0px.',
    'The headline size, weight and color in the preview are only a stage and are not exported. The CSS selector is .text; rename it to your own.',
    'The CSS and the audit report are generated locally from the same validated layers.',
  ],
};
