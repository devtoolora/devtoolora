import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A CSS sprite sheet joins many small images into one PNG. The page then loads a single file and each element shows its own piece through background-position, which saves requests and avoids a flash when icons appear.',
        'This tool decodes your images, arranges them on one canvas, and returns the sheet as sprite.png together with ready-made CSS (sprite.css) and a JSON map of every frame (sprite.json).',
      ],
      title: 'What is a CSS sprite sheet?',
    },
    {
      content: [
        'Packed shelf-packs the sprites, tallest first, into rows that aim at a roughly square sheet. Horizontal and Vertical keep your order in one line. Grid puts every image in a cell as big as the largest image.',
        'Class names come from the file names: Logo.png becomes .sprite-logo, names that are empty or start with a digit become .sprite-img-N, and duplicates get -2, -3. Padding is added between sprites and around the edges.',
      ],
      title: 'When to use each layout',
    },
  ],
  examples: [
    'Logo.png and logo.PNG with prefix sprite → .sprite-logo and .sprite-logo-2.',
    '1-up.png as the third file → .sprite-img-3, because a class name cannot start with a digit.',
    'Two images 32 × 32 and 16 × 16, Horizontal, Padding 2 → a 54 × 36 px sheet.',
    'The same two images, Vertical → a 36 × 54 px sheet.',
    'Three 10 × 10 images, Grid, Padding 0 → a 20 × 20 px sheet in two columns.',
    'Pixel ratio 2 on a 54 × 36 sheet → background-size: 27px 18px and halved sizes and offsets.',
  ],
  faq: [
    {
      answer:
        'Add the first class (for example sprite) and the image class (sprite-logo) to the same element: <span class="sprite sprite-logo"></span>. Keep sprite.png next to the CSS file, or change the url in the base rule.',
      question: 'How do I use the CSS?',
    },
    {
      answer:
        'Use it for sheets drawn for high-density screens. Every size and position is halved, so a 54 px wide sheet is shown 27 px wide, and background-size keeps the whole sheet at that size. Odd sizes give values such as 3.5px.',
      question: 'What does Pixel ratio 2 do?',
    },
    {
      answer:
        'Up to 200 images of at most 10 MiB and 4,096 × 4,096 px each, and a sheet of at most 8,192 px per side. When the sheet would be too big, the error tells you the size it would have needed.',
      question: 'What are the limits?',
    },
    {
      answer:
        'The file is named in the error. Nothing is skipped silently, so remove or replace that file and run again.',
      question: 'What happens with a file that cannot be decoded?',
    },
    {
      answer:
        'No. Decoding, drawing and PNG encoding all run on your device, and nothing is uploaded.',
      question: 'Are my images uploaded?',
    },
  ],
  help: 'Choose the images you want on one sheet. PNG, JPEG, WebP and GIF files work; the first frame of a GIF is used.\n\nPick a layout and the padding between sprites. Packed gives the smallest sheet, the other layouts keep a predictable order.\n\nSet a class prefix and the pixel ratio. The CSS appears as text, and sprite.png, sprite.css and sprite.json are offered as downloads.\n\nThe JSON lists every frame by class name with its source file, position and size in sheet pixels, so scripts and game engines can use the same sheet.',
  notes: [
    'Everything runs locally on a canvas; no image is uploaded.',
    'Transparent areas stay transparent in the PNG sheet.',
    'Frames never overlap, and padding surrounds every sprite, including the sheet edges.',
    'The JSON always holds real sheet pixels; pixelRatio in its meta says how the CSS was scaled.',
    'Class names are lowercased with accents removed, so ikona-ž.png becomes .sprite-ikona-z.',
    'Limits: 200 images, 10 MiB and 4,096 × 4,096 px per image, 8,192 px per sheet side.',
  ],
};
