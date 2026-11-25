import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The CSS color-mix() function blends two colors in a chosen color space. This tool does the same blend and prints both the resolved hex color and the color-mix() call.',
        'Mixing follows CSS Color 5: alpha is premultiplied, so a transparent color does not tint the result, and in OKLCH the hue travels the shorter arc around the wheel. A hue is powerless when chroma is below 0.0002, and then the other color hue is used.',
        'The resolved color is mapped into sRGB by reducing chroma, so the fallback is always displayable.',
      ],
      title: 'How does color mixing work?',
    },
    {
      content: [
        'Building hover and active states from a brand color.',
        'Generating a fallback for browsers without color-mix().',
        'Comparing how sRGB, OKLab and OKLCH blend the same pair.',
        'Finding a midpoint between two theme colors.',
      ],
      title: 'When to use Color Mixer',
    },
  ],
  examples: [
    '#ff0000 and #0000ff at 50% in sRGB gives #800080',
    '#000000 and #ffffff at 50% in sRGB gives #808080',
    '#000000 and #ffffff at 50% in OKLab gives #636363',
    '#ff0000 and #0000ff at 50% in OKLCH gives a hue near 326.6',
    'Weight 100 returns color A and weight 0 returns color B',
    'rgb(255 0 0 / 0) and #0000ff at 50% in sRGB gives #0000ff at half alpha',
  ],
  faq: [
    {
      answer:
        'sRGB mixes gamma-encoded channels, which darkens midpoints. OKLab and OKLCH mix perceptual lightness, so the result looks more even.',
      question: 'Why do the spaces give different results?',
    },
    {
      answer:
        'In OKLCH the hue moves along the shorter arc of the wheel. Red to blue passes through magenta, not green.',
      question: 'Which way does the hue go?',
    },
    {
      answer:
        'Yes. Alpha is premultiplied as in CSS, so a fully transparent color contributes no color.',
      question: 'Can I use colors with alpha?',
    },
    {
      answer:
        'The first declaration is the resolved fallback and the second is color-mix(). Browsers that understand it use the second.',
      question: 'Why are there two color lines?',
    },
  ],
  help: 'Pick two colors or type any CSS color: hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() or a name.\n\nSet the weight of color A from 0 to 100 percent. Color B takes the rest.\n\nChoose the color space used for mixing. OKLCH is the default.\n\nThe output is a CSS rule with the resolved hex first and color-mix() second. The preview shows A, the mix and B, and the JSON report lists every format of the result.',
  notes: [
    'Colors print in the rule exactly as typed, trimmed, so a hex color needs its #.',
    'The weight must be a whole number from 0 to 100.',
    'Alpha is premultiplied before mixing.',
    'OKLCH takes the shorter hue arc.',
    'A hue is powerless when chroma is below 0.0002.',
    'Other spaces such as hsl, lab and srgb-linear are not offered.',
  ],
};
