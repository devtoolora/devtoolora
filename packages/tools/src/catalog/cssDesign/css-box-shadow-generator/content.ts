import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'box-shadow paints one or more shadows around an element’s border box without changing its size or position in the layout. Horizontal and vertical offsets move a shadow right and down, Blur softens its edge and Spread grows or shrinks it before blurring.',
        'Layers are separated by commas and the first listed layer is painted on top. Inset draws a layer inside the box instead of outside it.',
        'The live preview applies the same box-shadow value to a sample card. The card’s surface and radius help you judge the shadow and are not part of the exported CSS.',
      ],
      title: 'What is a CSS box shadow?',
    },
    {
      content: [
        'Design elevation for cards, menus, dialogs and floating buttons while seeing the real shadow.',
        'Stack a tight contact shadow with a broad, soft one for more natural depth than one large layer.',
        'Create inset outlines, inner glows or hard offset shadows with zero blur.',
        'Export the layers you previewed, then check them on your own background and border radius.',
      ],
      title: 'When to use CSS Box Shadow Generator',
    },
  ],
  examples: [
    'x 0, y 12, blur 28, spread 0, rgba(15, 23, 42, 0.18) → box-shadow: 0px 12px 28px 0px rgba(15, 23, 42, 0.18);',
    'Layered elevation sample → box-shadow: 0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -2px rgba(0,0,0,0.1); the first layer paints on top.',
    'Inset, blur 0, spread 2, rgba(37,99,235,0.5) → box-shadow: inset 0px 0px 0px 2px rgba(37,99,235,0.5); an outline that adds no border width.',
    'x 8, y 8, blur 0, #172033 → box-shadow: 8px 8px 0px 0px #172033; a hard offset shadow.',
    'x 1.234 and color #2563eb80 in Layer JSON → 1.23px … #2563eb80; numbers are rounded to two decimals and the alpha byte is kept.',
  ],
  faq: [
    {
      answer:
        'Click Add layer; each layer becomes one comma-separated value of the same box-shadow property, up to five. The first layer is drawn on top, so use the move buttons to change which shadow overlaps the others.',
      question: 'How do I add more than one shadow?',
    },
    {
      answer:
        'Blur softens the edge, so higher values give a wider, fainter fade. Spread grows the shadow before it is blurred, or shrinks it when negative, which keeps a large soft shadow tucked under the element.',
      question: 'What is the difference between blur and spread?',
    },
    {
      answer:
        'Tick Inset on a layer. The CSS gets the inset keyword and the shadow is drawn inside the border box; with blur 0 and spread 2 it becomes a 2 px inner outline.',
      question: 'How do I make an inner shadow?',
    },
    {
      answer:
        'Hex with 3, 4, 6 or 8 digits and comma-separated rgb() or rgba(), with numbers or percentages. For an hsl() or named color, convert it first in Color Converter.',
      question: 'Which color formats can I use for a shadow?',
    },
    {
      answer:
        'The preview shows the shadow on a sample card whose surface and radius are not exported. Shadows read differently on other backgrounds and follow your element’s own border-radius, so check them in place.',
      question: 'Why does my shadow look different on my page?',
    },
  ],
  help: 'Pick a sample from Apply sample, or set Horizontal, Vertical, Blur and Spread for Layer 1 with the sliders.\n\nChoose the layer Color and Opacity, and tick Inset to draw that layer inside the box.\n\nClick Add layer for up to five layers, reorder them with the move buttons and remove any layer except the last one.\n\nCopy the CSS or download box-shadow.css and the css-shadow-report.json audit; open Layer JSON (advanced) to type exact values.',
  notes: [
    'Horizontal, Vertical and Spread accept −200 to 200 px and Blur 0 to 300 px. Decimals are rounded to two places; a negative blur is rejected.',
    'Colors can be #RGB, #RGBA, #RRGGBB, #RRGGBBAA or comma-separated rgb()/rgba() with numbers or percentages. The color is written to the CSS as entered, so its alpha is kept; the Color picker also keeps the current opacity.',
    'Layer JSON takes one to five objects with numeric x, y, blur and spread, a string color and a boolean inset. Unknown properties, invalid JSON and input over 10,000 characters show an error and no CSS.',
    'A zero-opacity layer such as rgba(0,0,0,0) is valid and invisible, not an error.',
    'Shadows take no layout space, so an ancestor with overflow: hidden can cut them off. Check large blur and offset values on your real page.',
    'The CSS and audit are generated locally from the same validated layers; changing a layer replaces both.',
  ],
};
