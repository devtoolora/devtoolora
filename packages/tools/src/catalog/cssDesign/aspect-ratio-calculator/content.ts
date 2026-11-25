import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An aspect ratio is the proportion of width to height. 1920 x 1080 reduces to 16:9 by dividing both by their greatest common divisor.',
        'Decimal dimensions are scaled by 100 first so the divisor can be found on whole numbers. The decimal ratio is width / height, and the padding fallback is height / width as a percentage.',
        'The nearest common ratio is picked from 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 1:1, 5:4, 4:5, 21:9, 1.91:1 and 2.39:1, with the signed deviation in percent.',
      ],
      title: 'How is an aspect ratio calculated?',
    },
    {
      content: [
        'Resizing images or video while keeping the proportions.',
        'Writing aspect-ratio CSS for responsive embeds and cards.',
        'Checking how far an odd resolution is from a standard ratio.',
        'Using the padding-top hack for browsers without aspect-ratio.',
      ],
      title: 'When to use Aspect Ratio Calculator',
    },
  ],
  examples: [
    '1920 x 1080 → 16:9, 1.7778, padding-top: 56.25%;',
    '1920 x 1080 solved for height at width 1280 → 720',
    '1366 x 768 → 683:384, nearest 16:9 (+0.0488 %)',
    '1080 x 2400 → 9:20, nearest 9:16',
    '3000 x 2000 solved for width at height 600 → 900',
    '512 x 512 → 1:1',
  ],
  faq: [
    {
      answer:
        'Some resolutions such as 1366 x 768 are not an exact multiple of a standard ratio. The nearest common ratio and its deviation show how close they are.',
      question: 'Why is the ratio 683:384 and not 16:9?',
    },
    {
      answer:
        'Use aspect-ratio on modern browsers. padding-top with a percentage is the fallback for a wrapper with an absolutely positioned child.',
      question: 'Which CSS line should I use?',
    },
    {
      answer:
        'Choose Height to enter a target width, or Width to enter a target height. None hides the solved line.',
      question: 'How do I find a missing dimension?',
    },
    {
      answer:
        'Yes. Decimals are scaled by 100 before the greatest common divisor, so 1.5 x 1 becomes 3:2.',
      question: 'Does it work with decimals?',
    },
  ],
  help: 'Enter the width and height. The output shows the simplified ratio, the decimal ratio and the nearest common ratio with its deviation.\n\nThe aspect-ratio line and the padding-top fallback are listed together so you can copy them as a pair.\n\nSet Solve for to Height or Width and enter the other target dimension to get the missing size.\n\nCopy the result or download aspect-ratio.txt.',
  notes: [
    'Width and height are 0.01 to 1,000,000.',
    'Decimal dimensions are scaled by 100 before the greatest common divisor is found.',
    'The deviation is signed: plus means wider than the common ratio.',
    'Results are rounded to four decimals with trailing zeros removed.',
    'The solved line only appears when Solve for is Width or Height.',
    'Out-of-range or non-numeric values are rejected, never clamped.',
  ],
};
