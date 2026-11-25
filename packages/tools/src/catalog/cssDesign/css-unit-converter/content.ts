import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'CSS has absolute units that are fixed ratios of a CSS pixel (1in = 96px, 1pt = 4/3px, 1pc = 16px, 1cm = 96/2.54px, 1mm = 1cm/10, 1Q = 1mm/4) and relative units that depend on context.',
        'rem uses the root font size, em and % (here, as a share of the parent font size) use the parent, and vw, vh, vmin and vmax are 1 percent of the viewport width, height, smaller side and larger side.',
        'The converter turns your value into px with the context you enter, then expresses it in every other unit.',
      ],
      title: 'How are CSS units related?',
    },
    {
      content: [
        'Translating a design in px or pt into rem and em.',
        'Working out how large a vw value is on a given screen.',
        'Converting print units such as mm, cm and Q to screen pixels.',
        'Checking what a percentage font size means for a known parent.',
      ],
      title: 'When to use CSS Unit Converter',
    },
  ],
  examples: [
    '24px → 1.5rem, 1.5em, 150%, 18pt, 1.5pc, 0.25in, 0.635cm, 6.35mm, 25.4Q',
    '24px at 1440 x 900 → 1.6667vw, 2.6667vh, 2.6667vmin, 1.6667vmax',
    '1.5rem with root 16 → 24px',
    '2em with a 20px parent → 40px',
    '210mm → about 793.7px',
    '12pt → 16px',
  ],
  faq: [
    {
      answer:
        'Percent is converted as a percentage of the parent font size, as it is for font-size. Other properties resolve percentages against different references.',
      question: 'What does % mean here?',
    },
    {
      answer:
        'Viewport units scale with the window, so the converter needs a width and height. The defaults are 1440 x 900.',
      question: 'Why do I need to enter a viewport?',
    },
    {
      answer:
        'The CSS reference pixel is not a device pixel; 1in is defined as 96px regardless of the screen.',
      question: 'Why is 1in always 96px?',
    },
    {
      answer:
        'Yes. Negative values convert like positive ones, up to 1,000,000 in either direction.',
      question: 'Can I convert negative values?',
    },
  ],
  help: 'Enter a value, pick its unit and set the context: root font size, parent font size and the viewport size.\n\nThe output lists the value in every other CSS unit, right-aligned so the numbers are easy to scan.\n\nIf you only convert absolute units you can leave the context at its defaults.\n\nCopy the result or download css-units.txt.',
  notes: [
    'The value must be between -1,000,000 and 1,000,000, with up to 4 decimals.',
    'Root and parent font sizes are 1 to 100 px with up to 2 decimals; viewport width and height are whole numbers from 1 to 10000 px.',
    '% means a percentage of the parent font size.',
    'Results are rounded to four decimals with trailing zeros removed.',
    'Out-of-range or non-numeric values are rejected, never clamped.',
    'vmin and vmax use the smaller and larger of width and height.',
  ],
};
