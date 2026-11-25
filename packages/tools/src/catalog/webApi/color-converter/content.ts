import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'CSS can write the same color in many ways. Hex (#3b82f6) and rgb() give red, green and blue channels; hsl() and hwb() use a hue with saturation and lightness, or whiteness and blackness; lab(), lch(), oklab() and oklch() describe perceived lightness, chroma and hue.\n\nThe converter accepts every CSS Color 4 notation, including space-separated channels with / alpha, percentages, hue units and the 148 named colors, and writes all the others. OKLCH is the easiest to adjust by hand: change L to lighten or darken, C for intensity and H for hue.\n\nColors from lab(), lch(), oklab() or oklch() that fall outside sRGB are brought into range by reducing chroma, as browsers do, and a note says so.',
      title: 'What is a CSS color converter?',
    },
    {
      content: [
        'Move a design token from hex to oklch() to build lighter and darker variants in even steps.',
        'Translate a color from a design tool, a stylesheet or a brand guide into the notation your code base uses.',
        'Check whether white or black text reads better on a brand color before using it as a background.',
      ],
      title: 'When to convert colors',
    },
  ],
  examples: [
    '#3b82f6 → rgb(59, 130, 246), hsl(217.2, 91.2%, 59.8%) and oklch(62.31% 0.188 259.81).',
    '#3b82f680 → rgba(59, 130, 246, 0.502); hex keeps the 80 alpha byte.',
    'rgb(59 130 246 / 50%) → the same blue with alpha 0.5; Spaces output keeps this syntax.',
    'rebeccapurple → #663399, and name shows the CSS name.',
    '#10b981 → closest named color: mediumseagreen (ΔE 2.3).',
    'oklch(70% 0.4 150) → outside sRGB, so chroma is reduced and a note explains it.',
    '#ff0000 → 4:1 contrast on white and 5.25:1 on black, so black text is suggested.',
  ],
  faq: [
    {
      answer:
        'Paste the hex code, such as #3b82f6, and read rgb(59, 130, 246) in the rgb field, with hsl(), oklch() and the other notations alongside. Choose Spaces for the modern rgb(59 130 246) syntax.',
      question: 'How do I convert hex to RGB?',
    },
    {
      answer:
        'They are the alpha channel, from 00 (transparent) to ff (opaque). #3b82f680 is the same blue at 0x80 = 128/255 ≈ 0.502 opacity, shown as rgba(59, 130, 246, 0.502).',
      question: 'What do the last two digits of an 8-digit hex color mean?',
    },
    {
      answer:
        'Use the one with the higher ratio, which the converter names in textColor. #3b82f6 reaches 5.71:1 with black but only 3.68:1 with white, so black text passes the 4.5:1 AA level and white does not.',
      question: 'Should I use white or black text on this color?',
    },
    {
      answer:
        'Some lab(), lch(), oklab() and oklch() colors are more vivid than an sRGB screen can show. The converter reduces their chroma until they fit, as browsers do, and hex and rgb() then describe that adjusted color.',
      question: 'Why do I get a note about the sRGB gamut?',
    },
    {
      answer:
        'These keywords take their value from where they are used in a stylesheet, so there is no fixed color to convert. Copy the computed color from your browser’s developer tools instead.',
      question: 'Why can’t I convert currentColor or inherit?',
    },
  ],
  help: 'Paste a color in any CSS notation, or a color name. The result updates as you type.\n\nChoose Commas for rgb(59, 130, 246) style or Spaces for CSS Color 4 style such as rgb(59 130 246 / 50%).\n\nCheck the swatch and the contrast ratios; the suggested text color is the one with more contrast.\n\nCopy the notation you need. For palettes and shades, continue in Color Palette & Contrast.',
  notes: [
    'Conversion is local and follows the CSS Color 4 math that browsers use: sRGB, OKLab with a D65 white point and CIE Lab with D50.',
    'rgb() channels are rounded to whole numbers and hex to two digits per channel, so a round trip through hex can shift the other notations slightly.',
    'CMYK is a simple device conversion without an ICC profile; print shops convert differently.',
    'Contrast ratios follow WCAG 2: 4.5:1 for normal text and 3:1 for large text. Transparent colors are composited over white or black first.',
    'Hue is written as none for grays, where it has no meaning.',
    'color(display-p3 …), other wide-gamut spaces and relative color syntax are not supported yet.',
    'The closest named color is measured in OKLab (ΔE × 100); below about 2 the difference is hard to see.',
  ],
};
