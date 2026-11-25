import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The blob is a closed ring of points around a circle. Each point is pushed inward by a seeded random amount, and a Catmull-Rom spline converted to cubic Bezier curves joins them into one smooth outline.',
        'The same seed, points, randomness and size always produce the same SVG. Drag the Seed slider to shuffle the shape without touching anything else.',
        'The SVG has a square viewBox and one path with your fill color, so it scales to any size and works as an inline image, a CSS background or an img source.',
      ],
      title: 'What is an SVG blob?',
    },
    {
      content: [
        'Decorative backgrounds behind hero images and avatars.',
        'Masks and accent shapes in landing pages.',
        'Placeholder art in mockups and slides.',
        'Exploring organic shapes by shuffling the seed.',
      ],
      title: 'When to use SVG Blob Generator',
    },
  ],
  examples: [
    'Default blob (seed 42, 6 points) → <svg viewBox="0 0 400 400"><path fill="#6366f1" d="M… C… Z"/></svg>',
    'Soft circle (8 points, 10% randomness) → a nearly round shape',
    'Wild shape (10 points, 100% randomness) → deep indentations',
    'Triangle-ish (3 points) → a rounded triangle',
    'Large teal (size 800) → the same kind of shape on an 800 by 800 canvas',
    'Seed 43 instead of 42 → a different shape with the same settings',
  ],
  faq: [
    {
      answer: 'Points are placed from the seed, so the shape changes when the seed changes.',
      question: 'Why does the shape change when I move the seed?',
    },
    {
      answer: 'Yes. Any opaque CSS color works, for example rgb(59 130 246) or hsl(220 90% 56%).',
      question: 'Can I use a color other than hex?',
    },
    {
      answer: 'With 0% randomness every point sits on the circle, so the blob is a perfect circle.',
      question: 'What does 0% randomness give?',
    },
    {
      answer: 'Download blob.svg from the artifacts or copy the markup.',
      question: 'How do I get the file?',
    },
  ],
  help: 'Set the Seed, the number of Points, the Randomness and the Size, then pick a Fill color.\n\nThe preview updates as you move the sliders. The Seed shuffles the shape.\n\nThe output is an SVG with one path. Points sit on a circle of radius 45% of the size and are pulled inward by up to half of that, scaled by Randomness.\n\nCopy the markup or download blob.svg. Values outside a slider range are rejected, never clamped.',
  notes: [
    'Seed is 1 to 9999, points 3 to 12, randomness 0 to 100%, size 100 to 1000 px.',
    'Out-of-range values are rejected, never clamped.',
    'The fill must be an opaque CSS color.',
    'Numbers are rounded to two decimals.',
    'The same settings always give the same SVG.',
    'The outline never leaves the viewBox.',
  ],
};
