import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Decodes QR codes from uploaded images locally in the browser using binary raster analysis and the jsQR matrix decoding library without sending photos to remote APIs.',
      ],
      title: 'What is QR Code Reader?',
    },
    {
      content: [
        'Use when you have a screenshot, badge or image containing a QR code on your computer and want to inspect its embedded URL or payload without using a physical mobile phone camera.',
      ],
      title: 'When to use QR Code Reader',
    },
  ],
  examples: [
    'The Website link sample → {"data": "https://example.com/docs", "version": 2}.',
    'Screenshot of a code for https://example.com → "data": "https://example.com" plus the QR version.',
    'Photo of a WiFi sign → "data": "WIFI:T:WPA;S:Office;P:…;H:false;;" as text; the reader does not join the network.',
    'vCard code → the full BEGIN:VCARD … END:VCARD text, ready to copy into a contacts file.',
    'Light code on a dark background → decoded as well, because the inverted image is tried too.',
    'Image without a QR code, or a heavily blurred one → error: No QR code was found in the image.',
  ],
  faq: [
    {
      answer:
        'No. It decodes QR codes only, with the jsQR library. EAN, UPC, Code 128, Data Matrix, Aztec and PDF417 codes are not recognized.',
      question: 'Can it read barcodes or Data Matrix codes?',
    },
    {
      answer:
        'The reader returns one code, the first it locates. Crop the image to the code you need, for example with Custom crop in Image Tools, and read it again.',
      question: 'What happens if the image contains several QR codes?',
    },
    {
      answer:
        'The code may be too small, blurred, cut off, low in contrast or photographed at a steep angle. Use a sharp, straight-on screenshot that includes the light border around the code.',
      question: 'Why does it say No QR code was found in the image?',
    },
    {
      answer:
        'Version is the size of the QR symbol from 1 to 40: version 1 is 21 × 21 modules and each version adds 4, up to 177 × 177. Longer content and higher error correction need higher versions.',
      question: 'What does the version number in the result mean?',
    },
    {
      answer:
        'No. It only shows the decoded text, so you can check an address before opening it yourself. The image is decoded on your device and nothing is looked up online.',
      question: 'Does the reader open links from the QR code?',
    },
  ],
  help: 'Upload an image file containing a clearly visible QR code.\n\nRun the reader to locate and decode the matrix.\n\nReview the extracted data string and QR version.\n\nCopy the payload or use it directly in related tools.',
  notes: [
    'Requires clear contrast between dark and light modules in the QR symbol.',
    'Supports inverted (light on dark) codes via automatic second-pass inversion attempts.',
    'Heavy blur, steep perspective distortion, or occlusion may impede detection.',
    'Supported formats: PNG, JPEG, WebP, GIF and canvas-decodable formats.',
    'Processing is local; scanned URLs are not visited automatically.',
  ],
};
