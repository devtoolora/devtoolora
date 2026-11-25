import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'SVG Placeholder writes a one-rectangle SVG with a centered text label at the width and height you choose, for image slots whose real artwork is not ready yet.',
        'The markup is a few hundred bytes, has no external references and stays sharp at any screen density.',
      ],
      title: 'What is SVG Placeholder?',
    },
    {
      content: [
        'Fill image slots in wireframes, prototypes and component stories, or test layouts, aspect ratios and lazy loading.',
        'Stand in for an Open Graph image (1200 × 630), an avatar or an ad slot until the final artwork arrives.',
      ],
      title: 'When to use SVG Placeholder',
    },
  ],
  examples: [
    'Width 1200, Height 630, Label 1200x630 → <svg width="1200" height="630" viewBox="0 0 1200 630"> with a #1f2937 rectangle and 86 px white text.',
    'Width 400, Height 400, Label empty → the label reads 400x400, drawn at 29 px.',
    'Width 150, Height 150 → the text uses its 16 px minimum size.',
    'Label Tom & Jerry → Tom &amp; Jerry in the markup, so the SVG stays valid.',
    'Background red, Foreground rgb(0 0 0) → fill="red" and fill="rgb(0 0 0)", copied as typed.',
    'Format PNG, Width 1200, Height 630 → placeholder-1200x630.png with the same layout, plus its data: URI as the text.',
    'Width 20000 → error: Width must be an integer between 1 and 10000.',
  ],
  faq: [
    {
      answer:
        'Save placeholder.svg and use it like any image, for example <img src="placeholder.svg" width="1200" height="630" alt="">, or paste the markup inline. For a CSS background, encode the SVG with Base64 Encode and use url("data:image/svg+xml;base64,…").',
      question: 'How do I use the placeholder in HTML or CSS?',
    },
    {
      answer:
        'The SVG is a few hundred bytes at any size, stays sharp on high-density screens and can be edited as text. Convert it with SVG to PNG when a platform needs a raster image.',
      question: 'Why use an SVG placeholder instead of a PNG?',
    },
    {
      answer:
        'No. The markup is generated on your device and contains only a rectangle and a text element, with no links to fonts, images or scripts.',
      question: 'Does SVG Placeholder call an online image service?',
    },
  ],
  help: 'Enter Width and Height in pixels as whole numbers from 1 to 10,000.\n\nType a Label, or leave the field empty to show the size, such as 400x400.\n\nSet the Background and Foreground colors, for example #1f2937 and #ffffff.\n\nChoose the Format: SVG, PNG or JPEG. Run the tool, then copy the SVG markup or the image data URI, or download placeholder.svg, placeholder-1200x630.png or .jpg.',
  notes: [
    'Generated locally; the SVG links to no fonts, images or scripts on the network.',
    'The label is one line of Arial or the system sans-serif font at 1/14 of the width, at least 16 px. Long labels are not wrapped and can run past the edges.',
    'Colors must be valid CSS colors in every format; an invalid value is refused with an error. In SVG they are copied into the fill attributes as typed.',
    'PNG and JPEG are drawn on a canvas with the same layout, in Arial 1/14 of the width. They are limited to 16,777,216 pixels (4,096 × 4,096); Quality applies to JPEG only.',
    'Width and Height must be whole numbers from 1 to 10,000; other values are refused with an error.',
  ],
};
