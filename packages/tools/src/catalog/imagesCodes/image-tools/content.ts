import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Image Tools opens one local image and applies one operation at a time: resize, crop and convert, compress, rotate, flip, grayscale, filters, a text watermark, annotations (text, labels, boxes, arrows and redaction), ASCII art, a color blindness simulation, a Base64 data URI, a one-page PDF, or a report of the pixel size and type.',
        'The image is decoded and redrawn with the browser’s own canvas APIs on your device and exported as PNG, JPEG or WebP. Nothing is uploaded.',
      ],
      title: 'What is Image Tools?',
    },
    {
      content: [
        'Shrink a photo or screenshot for the web, crop an avatar or social card, or convert PNG to JPEG or WebP.',
        'Check how a UI image reads in grayscale or for color blind users, stamp DRAFT on a screenshot, or turn a small logo into a data URI for CSS.',
      ],
      title: 'When to use Image Tools',
    },
  ],
  examples: [
    '1200 × 800 PNG, Resize / crop / convert, Width 600, Keep aspect ratio on → 600 × 400 PNG.',
    '1200 × 800 photo, Center crop → the middle 800 × 800 at its own size; add Width 400 → 400 × 400.',
    'photo.png, Compress, Balanced, Export format WebP → photo.webp at quality 75, with the size before and after in the summary.',
    'photo.png with a transparent background, Export format JPEG → photo.jpg with the transparent areas filled black.',
    '1200 × 800 image, Rotate, Angle 90 → 800 × 1200 image turned clockwise; Angle 45 keeps 1200 × 800 and cuts off the corners.',
    'Annotate on a 1200 × 800 screenshot with redact 60 80 300 24 and arrow 500 300 420 240 → the same size and format, with a black bar over the secret and an arrow pointing at the detail.',
    'Metadata on a 1920 × 1080 PNG → width 1920, height 1080, aspectRatio 16:9, megapixels 2.074.',
    '100 × 100 red image with a 5 × 5 blue block, Dominant color → "hex": "#ff0000" and a palette of #ff0000 at 99.75% and #0000ff at 0.25%.',
    '1200 × 800 image, Width 600, Height 600, Keep aspect ratio on → 600 × 400, which fits inside the box; off → exactly 600 × 600, stretched.',
    'Pick pixel color with X and Y empty → the center pixel, such as "hex": "#c83232" with the CSS value rgb(200 50 50).',
    'Base64 with Base64 output Data URI → data:image/png;base64,iVBORw0KGgo… ready for HTML or CSS.',
    'Image to PDF on a 600 × 400 image → photo.pdf with one 600 × 400 pt page.',
  ],
  faq: [
    {
      answer:
        'Choose Compress, pick High quality (90), Balanced (75) or Smallest (55) and set Export format to JPEG or WebP. The summary shows the size before and after, such as 245.1 KiB → 61.3 KiB. The image is processed on your device and never uploaded.',
      question: 'How do I compress an image without uploading it?',
    },
    {
      answer:
        'PNG is lossless, so the quality presets do not apply to it and a re-saved PNG can even grow. Choose JPEG or WebP for photos, or make the image smaller with Width and Height in Resize / crop / convert.',
      question: 'Why did my PNG not get smaller?',
    },
    {
      answer:
        'The crop keeps its own pixel size, so a center crop of a 1200 × 800 photo gives 800 × 800. Enter Width or Height to scale it; with Keep aspect ratio on, the other side follows the crop’s proportions, so Width 400 gives 400 × 400.',
      question: 'What size is the cropped image?',
    },
    {
      answer:
        'JPEG has no transparency, so transparent pixels are saved as black. Choose PNG or WebP as Export format to keep the transparent areas.',
      question: 'Why did the transparent background turn black?',
    },
    {
      answer:
        'No. Every export is redrawn from the pixels on a canvas and encoded again, so camera details, dates and GPS coordinates are not written to the new file. Image Metadata & EXIF Remover shows what the original contains.',
      question: 'Does the exported image keep EXIF data such as GPS location?',
    },
    {
      answer:
        'Bright pixels map to dense characters such as @ and dark pixels to spaces, which suits light text on a dark terminal. Turn on Invert ASCII for dark text on a light background.',
      question: 'Why does my ASCII art look like a negative?',
    },
  ],
  help: 'Choose an image in Image file, or apply a sample.\n\nPick an Operation. Only the fields for that operation are shown, such as Width, Height, Crop and Export format for Resize / crop / convert, or Compression for Compress.\n\nSet the values: leave Height empty with Keep aspect ratio on to scale proportionally, choose Custom crop to drag the crop box on the preview, or pick High quality, Balanced or Smallest compression with JPEG or WebP.\n\nRun the tool, check the preview and the size summary, then download the image, or copy the text result of Metadata, ASCII art, Base64 and the color operations. For Annotate, write one command per line, such as rect 40 40 200 120 or redact 60 80 100 24.',
  notes: [
    'Everything runs locally with the browser’s image decoder and canvas; the image is not uploaded and the tool works offline.',
    'Any format the browser can decode opens, such as PNG, JPEG, WebP, GIF and BMP; an animated GIF keeps one frame. Use SVG to PNG for SVG files.',
    'Export format Original keeps JPEG and WebP and saves every other format as PNG. Quality (1–100, default 82) and the Compression presets affect JPEG and WebP only; PNG output is lossless.',
    'Center crop always cuts the largest centered square. Crop ratio only shapes the box you drag in Custom crop mode.',
    'A crop keeps its own pixel size unless you enter Width or Height; with Keep aspect ratio on, the other side follows the crop’s proportions, and both together fit the image inside that box. The summary shows the final size in pixels.',
    'The output is limited to 32,767 px per side and 268,435,456 pixels in total, the most browsers can reliably draw.',
    'Dominant color counts every pixel that is not fully transparent, groups near-identical shades, and lists up to 5 groups by share with each group’s average color. Pick pixel color reads one pixel.',
    'Exported images are encoded again from pixels, so EXIF, GPS and other metadata are not copied. Image to PDF embeds the picture as a lossless PNG.',
    'Metadata and Format check report the pixel size, the format read from the file’s first bytes, so a JPEG renamed to .png shows as JPEG, and whether any pixel is transparent. They do not read EXIF tags.',
    'Annotate commands are text, label, rect, highlight, redact, arrow and circle, with X and Y in pixels of the original image from the top-left; # lines and blank lines are ignored. At most 200 commands, messages up to 500 characters, numbers within ±100,000, and W, H and R above 0. Errors name the line.',
    'Annotate keeps the source format and size. Text uses the system fonts of your browser (sans-serif, serif or monospace), so its shape differs between devices.',
    'Redact draws opaque black over the pixels in the re-encoded file, and canvas encoding drops the original metadata. Check the result before sharing, because text in an unredacted part of the image is untouched.',
    'The color blindness simulator uses simple RGB matrix approximations, good for a quick contrast check rather than an exact model of vision.',
  ],
};
