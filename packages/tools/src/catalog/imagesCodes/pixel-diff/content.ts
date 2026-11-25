import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Pixel Diff compares two images of the same size pixel by pixel. It reports the width, height and number of changed pixels as JSON and creates pixel-diff.png, a map where changed pixels are magenta and unchanged pixels are transparent.',
        'A pixel counts as changed when its largest red, green, blue or opacity difference is above Difference threshold.',
      ],
      title: 'What is Pixel Diff?',
    },
    {
      content: [
        'Check visual regression screenshots, rendered charts or exported icons before and after a change.',
        'Confirm that an optimization, conversion or refactor left the pixels unchanged, or find exactly where they differ.',
      ],
      title: 'When to use Pixel Diff',
    },
  ],
  examples: [
    'The same image twice, threshold 0 → "changedPixels": 0.',
    '32 × 32 blue square vs the same square with an 8 × 8 red block → "changedPixels": 64.',
    'Blue rgb(0 100 255) vs rgb(6 106 255), threshold 10 → 0 changed pixels.',
    'The same pair with threshold 0 → 1024 changed pixels.',
    'Red vs blue 32 × 32 squares, threshold 50 → 1024 changed pixels.',
    'A fully transparent 40 × 40 image vs an opaque black one, threshold 50 → 1600 changed pixels.',
    '32 × 32 image vs 50 × 50 image → error: Images must have the same dimensions.',
  ],
  faq: [
    {
      answer:
        'Divide changedPixels by width × height from the result. For example, 64 changed pixels in a 32 × 32 image is 64 / 1024 = 6.25%.',
      question: 'How do I get the percentage of changed pixels?',
    },
    {
      answer:
        'For each pixel the tool takes the largest difference between the red, green, blue and alpha values, from 0 to 255. The pixel counts as changed only when that difference is greater than the threshold, so 0 catches every change and 10 ignores slight JPEG noise.',
      question: 'What does the difference threshold do?',
    },
    {
      answer:
        'Pixel Diff compares position by position and never scales or crops. Export both screenshots at the same size, or resize one in Image Tools with Keep aspect ratio off and the exact Width and Height.',
      question: 'Why do I get “Images must have the same dimensions”?',
    },
    {
      answer:
        'Yes. Alpha is compared like the color channels, so a fully transparent pixel and an opaque black pixel differ by 255, even though both read as rgb(0 0 0).',
      question: 'Does Pixel Diff compare transparency?',
    },
    {
      answer:
        'No. Both images are decoded and compared with the browser’s canvas on your device, and the difference map is created there as well.',
      question: 'Are my screenshots uploaded?',
    },
  ],
  help: 'Choose the Before image and the After image; both must have the same width and height.\n\nSet Difference threshold from 0 to 255: 0 counts every change, and about 10 ignores slight compression noise.\n\nRun the comparison and read changedPixels in the result.\n\nDownload pixel-diff.png and lay it over either image to see where the changes are.',
  notes: [
    'Images are compared on your device; screenshots are not uploaded.',
    'Threshold is a whole number from 0 to 255; decimals are rounded down and values outside the range are clamped.',
    'Images are never scaled or aligned, so even a one-pixel difference in size is refused.',
    'Changed pixels are drawn opaque #ff0050 in pixel-diff.png; all other pixels are fully transparent.',
    'Lossless PNG screenshots give the cleanest result; JPEG noise may need a higher threshold.',
  ],
};
