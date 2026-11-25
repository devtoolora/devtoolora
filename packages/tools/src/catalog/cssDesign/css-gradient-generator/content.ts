import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A CSS gradient is an image the browser draws from a list of color stops, so it is set with background-image rather than background-color. linear-gradient() blends along a line at an angle, radial-gradient() spreads out from a center as a circle or an ellipse, and conic-gradient() sweeps around a center like the hands of a clock.',
        'Each stop pairs a color with a position from 0% to 100% along the gradient line. Colors blend between neighboring stops, and two stops at the same position make a hard edge. The repeating- variants tile the stop pattern until the box is filled.',
        'By default hex, rgb() and hsl() colors blend in sRGB, which can turn muddy or gray in the middle, while a stop in lab(), lch(), oklab() or oklch() makes the whole gradient blend in Oklab. Adding in oklab or in oklch makes the browser blend in a perceptual color space, so midpoints stay bright and even.',
      ],
      title: 'What is a CSS gradient?',
    },
    {
      content: [
        'Design hero backgrounds, buttons, cards and overlays while seeing the real gradient at full size.',
        'Build radial spotlights and vignettes, or conic color wheels, pie charts and loading rings.',
        'Make stripes and checks with the repeating variants and hard stops.',
        'Export a single background-image rule with a fallback line for browsers without OKLab or OKLCH interpolation.',
      ],
      title: 'When to use CSS Gradient Generator',
    },
  ],
  examples: [
    'Default → .gradient { background-image: linear-gradient(135deg, #2563eb 0%, #9333ea 100%); }',
    'Type Radial, center 50% 50% → radial-gradient(circle at 50% 50%, #2563eb 0%, #9333ea 100%)',
    'Type Conic, angle 135 → conic-gradient(from 135deg at 50% 50%, #2563eb 0%, #9333ea 100%)',
    'Repeating on → repeating-linear-gradient(135deg, …); the stop pattern tiles across the box.',
    'Interpolation OKLCH → a fallback line without the method, then linear-gradient(135deg in oklch, #2563eb 0%, #9333ea 100%).',
    'Stops at 100% then 0% → printed as 0% then 100%, and the summary says the order changed.',
    'Stop color oklch(62% 0.19 260) → printed exactly as typed, trimmed.',
  ],
  faq: [
    {
      answer:
        'Click Add stop, up to 8 stops. The new stop goes into the middle of the largest gap, counting the space before the first stop and after the last, and takes the blended color so the gradient does not change; drag its marker on the strip or set its Position slider to move it.',
      question: 'How do I add another color?',
    },
    {
      answer:
        'Put two stops at the same position, for example #0f172a at 5% and #facc15 at 5%. The browser switches color there instead of blending, which is how stripes and pie slices are made.',
      question: 'How do I make a hard edge instead of a blend?',
    },
    {
      answer:
        'It makes the browser blend in a perceptual color space, so a blue-to-orange gradient does not turn gray in the middle. The rule keeps a plain first line, so browsers that do not understand in oklch still draw their default blend.',
      question: 'What does OKLCH interpolation change?',
    },
    {
      answer:
        'Any color CSS Color 4 can parse: hex with a #, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), a named color or transparent. It is written to the CSS exactly as typed.',
      question: 'Which color formats can I use for a stop?',
    },
    {
      answer:
        'Stops are printed sorted by position, because CSS draws them in list order. When dragging changes the order, the summary tells you the output was reordered.',
      question: 'Why did my stops change order?',
    },
  ],
  help: 'Pick a sample from Apply sample, or choose Linear, Radial or Conic and set the Angle, Shape and center Position.\n\nDrag the stop markers along the strip, or focus a marker and use the arrow keys (Shift for steps of 10). Edit each stop’s color with the picker or the text field.\n\nClick Add stop for up to 8 stops and Remove for any stop while more than 2 remain. Tick Repeating to tile the pattern and pick OKLab or OKLCH interpolation for smoother blends.\n\nCopy the CSS or download gradient.css and the css-gradient-report.json audit; open Stops JSON (advanced) to type exact values.',
  notes: [
    'A gradient needs 2 to 8 stops. Positions run from 0 to 100% with up to 2 decimals; values outside that range are rejected, never clamped.',
    'Stop colors are checked with a full CSS color parser and printed as typed, trimmed. A hex color needs its #, and text such as semicolons or braces is rejected.',
    'Stops JSON is an array of objects with exactly a string color and a numeric position. Unknown properties, invalid JSON and input over 4,000 characters show an error and no CSS.',
    'With OKLab or OKLCH interpolation the rule has two background-image lines. Older browsers ignore the second line and keep the first, which uses the default blend: sRGB for hex, rgb() and hsl() stops, and Oklab if any stop uses lab(), lch(), oklab() or oklch().',
    'The angle runs from 0 to 360 degrees and is used by linear and conic gradients; radial and conic gradients use the center Position in percent of the box.',
    'The preview swatch is only a stage; its size and rounded corners are not exported. The CSS and the audit are generated locally from the same validated stops.',
  ],
};
