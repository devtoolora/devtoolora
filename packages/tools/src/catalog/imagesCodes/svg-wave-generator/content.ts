import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The wave is a filled path that follows a curve across the full width and closes through the bottom corners, or the top corners when Position is top. It is meant as a section divider.',
        'Smooth style places 2 x peaks + 1 evenly spaced points at seeded random heights, then joins them with a Catmull-Rom spline. Sine style samples a true sine wave with the chosen number of periods.',
        'With several layers the back layer sits higher and is more transparent, and each layer in front is lower and more opaque. The SVG uses preserveAspectRatio="none" so it stretches to the width of its container.',
      ],
      title: 'What is an SVG wave?',
    },
    {
      content: [
        'Dividers between page sections.',
        'Footer and header edges.',
        'Layered backgrounds for hero banners.',
        'Quickly exploring wave shapes by shuffling the seed.',
      ],
      title: 'When to use SVG Wave Generator',
    },
  ],
  examples: [
    'Default smooth wave (seed 11) → one blue layer with four random peaks',
    'Sine wave (3 peaks) → three regular periods',
    'Three layers → opacities 0.33, 0.67 and 1',
    'Top divider → the same shape mirrored so it closes through the top',
    'Gentle ripple (15% amplitude, 8 peaks) → a calm sine ripple',
    'Four layers → opacities 0.25, 0.5, 0.75 and 1',
  ],
  faq: [
    {
      answer: 'The seed only shapes the smooth style. Sine waves are fully regular.',
      question: 'Why does the seed do nothing in sine style?',
    },
    {
      answer: 'Curve points are kept inside the viewBox, so the curve flattens at the edges.',
      question: 'Why is the wave flat at 100% amplitude?',
    },
    {
      answer: 'Set Position to top. The shape is mirrored and fills the area above the curve.',
      question: 'How do I put the wave at the top of a section?',
    },
    {
      answer: 'Yes. Any opaque CSS color works.',
      question: 'Can I use a color other than hex?',
    },
  ],
  help: 'Choose a Style, set the Width, Height, Peaks, Amplitude and Layers, then pick Position and Color. The Seed shuffles the smooth style.\n\nThe preview updates as you change values.\n\nThe output is an SVG with one path per layer. Layer opacity grows from the back layer to the front layer.\n\nCopy the markup or download wave.svg. Values outside a slider range are rejected, never clamped.',
  notes: [
    'Width is 320 to 2560, height 50 to 600, peaks 1 to 12, amplitude 5 to 100%, layers 1 to 4.',
    'Seed is 1 to 9999 and only affects the smooth style.',
    'Out-of-range values are rejected, never clamped.',
    'The color must be an opaque CSS color.',
    'The SVG stretches with preserveAspectRatio="none".',
    'The same settings always give the same SVG.',
  ],
};
