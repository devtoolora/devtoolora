import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'HEIC (HEIF) is the photo format iPhones use by default. Many sites, editors and older systems cannot open it. This tool decodes HEIC with libheif, compiled to WebAssembly, and saves the pictures as JPEG, PNG or WebP.',
        'The first run downloads the decoder (about 1.5 MB) and caches it for offline use. Your photos are never uploaded; the conversion happens on your device.',
        'One photo gives one file with a preview. Several photos, or a file with several images, give a zip.',
      ],
      title: 'What is HEIC to JPG & PNG?',
    },
    {
      content: [
        'Send an iPhone photo to someone whose software cannot open HEIC.',
        'Upload photos to a site that accepts only JPEG or PNG.',
        'Convert a whole folder of photos in one go, up to 50 files.',
        'Extract every image from a HEIC burst or collection with Images per file set to All images.',
      ],
      title: 'When to use HEIC to JPG & PNG',
    },
  ],
  examples: [
    'One file with JPEG and quality 90 → "IMG_0001.jpg" with a preview.',
    'The same file with PNG → a lossless "photo.png".',
    'WebP with quality 70 → a smaller "photo.webp".',
    'A photo taken in portrait orientation comes out upright, because the rotation stored in the file is applied.',
    'A file with two images and All images → "multi-heic.zip" with "multi.jpg" and "multi-2.jpg".',
    'Two files → "heic-converted.zip"; files with the same name get -2 added.',
  ],
  faq: [
    {
      answer:
        'No. EXIF, XMP and GPS data are not copied, so a converted photo carries no location. The summary says so.',
      question: 'Is the location kept?',
    },
    {
      answer:
        'The pixels are converted to 8-bit sRGB canvas data. A Display P3 profile is not converted or embedded, so saturated colors may shift slightly.',
      question: 'Why do the colors look a little different?',
    },
    {
      answer:
        'Up to 50 files, 50 MiB each and 200 MiB in total, 64,000,000 pixels per image and 50 images per file. A zip may be 500 MiB. The error names the limit that was hit.',
      question: 'What are the limits?',
    },
    {
      answer:
        'The other files are still converted. The summary says how many failed, and the result lists each broken file with the reason.',
      question: 'What if one file is broken?',
    },
    {
      answer:
        'Browsers open AVIF directly, so the tool refuses it and points you to Image Tools. Live Photos are a HEIC photo plus a separate video; only the photo is converted.',
      question: 'Does it handle AVIF and Live Photos?',
    },
  ],
  help: 'Choose one or more HEIC or HEIF files, up to 50 MiB each.\n\nPick JPEG, PNG or WebP and, for JPEG and WebP, a quality. Choose whether to convert only the primary image or all images in each file.\n\nPress Run. The first run downloads the decoder, so it takes longer than later runs.\n\nSave the image, or the zip when there are several.',
  notes: [
    'Output is 8-bit SDR. 10-bit and HDR gain maps are reduced to 8-bit.',
    'Display P3 colors are not converted to sRGB and no ICC profile is embedded, so colors can shift slightly.',
    'EXIF, XMP and GPS metadata are not copied to the output.',
    'Depth maps, thumbnails and other auxiliary images are ignored.',
    'AVIF files are refused; browsers open them directly. Use Image Tools to convert them.',
    'A Live Photo converts to its still image only; the video part is not read.',
    'JPEG has no transparency, so transparent areas are flattened onto white.',
    'An image above 64,000,000 pixels is an error; a 48 MP iPhone photo fits.',
  ],
};
