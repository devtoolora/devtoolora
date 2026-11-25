import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Batch Image Tools processes many local images in one run. Batch archive converts every image to WebP, PNG or JPEG, optionally resizes it, renames it with a numbered prefix and returns images.zip, with a contact sheet if you want one.',
        'Collage combines the images into one picture: a 2-column or 3-column grid or a horizontal or vertical strip, with each image fitted into a 320 px cell.',
      ],
      title: 'What is Batch Image Tools?',
    },
    {
      content: [
        'Convert a set of screenshots or photos to WebP or JPEG for a website, with tidy names such as product-001.webp.',
        'Build a quick comparison strip, a 2x2 mood board or an overview sheet of a photo set to share.',
      ],
      title: 'When to use Batch Image Tools',
    },
  ],
  examples: [
    '3 photos, WebP, Rename prefix product → product-001.webp, product-002.webp, product-003.webp and contact-sheet.jpg in images.zip.',
    'Max width 800 on a 1600 × 1200 photo → 800 × 600.',
    'Max width 800 on a 400 × 300 image → enlarged to 800 × 600.',
    'Max width 64 and Max height 64 → every image becomes exactly 64 × 64, even if that changes its proportions.',
    'The same with Center crop to dimensions on → a 1600 × 1200 photo is cut to its central 1200 × 1200, then scaled to 64 × 64 without stretching.',
    'Export format JPEG → files ending in .jpg.',
    'Size preset Instagram Story on a 400 × 300 photo → photo-1080x1920.webp, a centered 169 × 300 area enlarged to exactly 1080 × 1920.',
    '4 images, Collage layout 2x2, Gap 12 → a 652 × 652 px collage.',
    '5 images, Collage layout 2x2 → a third row is added, giving 652 × 984 px.',
    '5 images, Horizontal strip, Gap 0 → a 1600 × 320 px strip.',
  ],
  faq: [
    {
      answer:
        'Each file gets Rename prefix, a dash and a three-digit number in the order you selected the files, such as image-001.webp; JPEG files end in .jpg. The original file names are not kept.',
      question: 'How are the converted files named?',
    },
    {
      answer:
        'No. Max width is the output width for every image, so smaller images are enlarged and the height follows the proportions. When you fill in both Max width and Max height, each image is scaled to exactly that size; turn on Center crop to dimensions to cut it to that ratio first instead of stretching it.',
      question: 'Does Max width only shrink larger images?',
    },
    {
      answer:
        'In Batch archive mode, unreadable files are skipped and listed as failed, and the rest are zipped with a contact sheet of the images that worked, such as Processed 2 of 3 images; 1 failed. In Collage mode one file that cannot be decoded stops the whole run, so remove it first.',
      question: 'What happens to files that cannot be read?',
    },
    {
      answer:
        'Each image is fitted into a 320 × 320 px cell, so 4 images in a 2x2 layout with a 12 px gap make a 652 × 652 px collage. More images add rows: 2x2 always uses two columns and 3x3 three.',
      question: 'How big is the collage?',
    },
    {
      answer:
        'No. Every image is redrawn on a canvas and encoded again, so EXIF tags, GPS coordinates and camera details are not copied into the ZIP or the collage.',
      question: 'Do the converted images keep their EXIF metadata?',
    },
    {
      answer:
        'No. Decoding, resizing, encoding and zipping all happen on your device with the browser’s canvas, and the tool makes no network requests.',
      question: 'Are my images uploaded?',
    },
  ],
  help: 'Choose Mode: Batch archive or Collage, then select the image files in the order you want them.\n\nFor Batch archive, set Export format, Size preset (or Max width and Max height), Quality, Center crop to dimensions, Rename prefix and Include contact sheet.\n\nFor Collage, set Collage layout, Collage format, Gap in pixels and Background color.\n\nRun the tool and download images.zip or the collage image.',
  notes: [
    'All images are decoded, resized and zipped on your device; nothing is uploaded.',
    'Quality (1–100, default 82) applies to JPEG and WebP; PNG output is lossless.',
    'Center crop to dimensions needs both Max width and Max height; it cuts the largest centered area in that ratio. With only one of them set, it has no effect.',
    'The contact sheet is a JPEG of the first 12 images that were processed, in 180 px cells, up to 4 per row. Files that fail are listed as failed and left out of the ZIP and the sheet.',
    'Size presets (Instagram, Open Graph, X, LinkedIn, YouTube, Pinterest) output exactly the preset size with a centered crop and hide Max width, Max height and the crop checkbox. Output files are named <name>-<width>x<height>.<ext>. The sizes are the platforms’ published sizes as of 2026.',
    'Collage cells keep each image’s proportions and center it; empty space shows Background color.',
    'Images are processed one after another in memory, so very large sets can take a while on slower devices.',
  ],
};
