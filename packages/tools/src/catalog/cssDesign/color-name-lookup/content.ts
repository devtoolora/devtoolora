import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'CSS defines 148 named colors, including synonyms such as aqua and cyan or gray and grey. This tool maps a color to those names, or a name fragment to the colors that contain it.',
        'When the input is a color, the exact names come first. Then the 5 nearest other names follow, ranked by the distance in OKLab multiplied by 100, rounded to one decimal.',
        'OKLab distance follows perceived difference better than comparing RGB channels, so the nearest name usually looks closest to the eye.',
      ],
      title: 'How does the lookup work?',
    },
    {
      content: [
        'Finding a readable name for a hex color in a design review.',
        'Checking whether a brand color is already a named CSS color.',
        'Listing every named color that contains a word such as slate or sea.',
        'Picking the closest keyword for a quick prototype.',
      ],
      title: 'When to use CSS Color Name Lookup',
    },
  ],
  examples: [
    '#00ffff gives aqua and cyan',
    '#663399 gives rebeccapurple',
    '#6495ec is closest to cornflowerblue',
    'slate lists nine names, from darkslateblue to slategrey',
    'Light Slate matches lightslategray and lightslategrey',
    'rgb(255 99 71 / 0.5) is looked up as tomato and notes the ignored alpha',
  ],
  faq: [
    {
      answer:
        'They are different names for the same color in the CSS specification, so both are listed.',
      question: 'Why are aqua and cyan both shown?',
    },
    {
      answer:
        'The distance is the OKLab difference multiplied by 100. Values under about 2 are hard to tell apart.',
      question: 'What does the ΔE column mean?',
    },
    {
      answer: 'The lookup ignores alpha and says so in the summary.',
      question: 'What happens with transparent colors?',
    },
    {
      answer:
        'They are not part of the 148 named colors, because they have no fixed color of their own.',
      question: 'Why are transparent and currentColor rejected?',
    },
  ],
  help: 'Type a CSS color such as a hex code, rgb(), hsl() or oklch() value, or part of a color name.\n\nA color input lists every exact name first, then the 5 nearest names with their distance.\n\nA name fragment ignores case, spaces and hyphens, and lists every name that contains it with its hex value.\n\nThe table shows name, hex and distance, and the preview shows the matching swatches.',
  notes: [
    'There are 148 named colors in the list.',
    'Alpha is ignored for colors and noted in the summary.',
    'Exact means the same 8-bit sRGB color.',
    'The nearest list never repeats an exact name.',
    'Fragments may contain letters, spaces and hyphens only.',
    'transparent and currentColor are explained as errors.',
  ],
};
