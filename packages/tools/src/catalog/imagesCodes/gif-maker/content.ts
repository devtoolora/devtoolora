import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A GIF stores an animation as a list of full pictures, each shown for a delay. The file can loop forever or a set number of times, and one color in each picture can be transparent.',
        'This tool decodes the images you choose, fits each one onto a canvas of the same size, and writes them as the frames of one GIF. Frames play in file order; name files 01.png, 02.png, … to control it.',
        'Everything happens in your browser. Nothing is uploaded.',
      ],
      title: 'What is Images to GIF?',
    },
    {
      content: [
        'Contain shows the whole picture and leaves the rest of the canvas empty, Cover fills the canvas and crops the overflow, and Stretch distorts the picture to the canvas size.',
        'Empty areas stay transparent by default. Pick an opaque color as Background when the GIF will be shown on a page you do not control.',
        'Each frame gets its own palette of at most 256 colors. Floyd-Steinberg dithering hides banding in photos; turn it off for flat art and a smaller file.',
      ],
      title: 'When to choose each fit and background',
    },
  ],
  examples: [
    'Three 64 × 40 px PNGs, delay 100 → "3 frames · 64×40 · 0.30 s per loop · loops forever · 0.5 kB."',
    'Delays 300,100,500 for three files → frames of 300, 100 and 500 ms.',
    'Delay 105 → stored as 110 ms, because a GIF counts in 10 ms steps.',
    'Repeat Number of plays with 3 → "plays 3 times"; 1 play → "plays once".',
    'Width 96 and Height blank on 64 × 40 images → the height follows the first frame, 60 px.',
    'Contain with a transparent background on mixed shapes → transparent borders around the smaller frames.',
  ],
  faq: [
    {
      answer:
        'Frames follow file order. Name the files 01.png, 02.png and so on, so the order is the same on every system.',
      question: 'How do I control the order of the frames?',
    },
    {
      answer:
        'From 1 to 300 images of at most 10 MiB each and 200 MiB together. Each side of the GIF is 1 to 1,024 px, frames × pixels is at most 100,000,000, and the GIF may be 100 MiB.',
      question: 'What are the limits?',
    },
    {
      answer:
        'Browsers play delays under 20 ms as 100 ms, so shorter delays are rejected. The accepted range is 20 to 60,000 ms.',
      question: 'Why is the delay at least 20 ms?',
    },
    {
      answer:
        'Only the first frame of an animated GIF is used. To work with all frames, split it with the GIF Frame Extractor first.',
      question: 'What happens with a GIF input?',
    },
    {
      answer:
        'Many frames or big sizes make the encoder work for tens of seconds in the shared worker, so the next run in the same editor waits until it finishes. Use fewer frames or a smaller size when you only need a test fixture.',
      question: 'Why does a large GIF take so long?',
    },
    {
      answer: 'No. Decoding, drawing and encoding run on your device.',
      question: 'Are my images uploaded?',
    },
  ],
  help: 'Choose the images for the animation. PNG, JPEG, WebP, BMP and GIF files work; the first frame of a GIF is used.\n\nLeave Width and Height blank to use the first image size, capped at 1,024 px per side, or set one or both. Pick how images fit and an optional background color.\n\nSet one delay for all frames or a comma-separated list with one delay per frame. Choose forever or a number of plays.\n\nThe GIF appears as a preview and can be saved. The text lists every frame with its file, delay and color count. Frames play in file order; name files 01.png, 02.png, … to control it.',
  notes: [
    'Frames play in file order; name files 01.png, 02.png, … to control it.',
    'Everything runs locally; no image is uploaded.',
    'Delays are rounded to 10 ms; below 20 ms is an error.',
    'A background with transparency is rejected; use transparent or an opaque color.',
    'The delays list must have exactly one value per image; the error names both counts.',
    'Limits: 300 images, 1,024 px per side, frames × pixels 100,000,000, GIF 100 MiB.',
  ],
};
