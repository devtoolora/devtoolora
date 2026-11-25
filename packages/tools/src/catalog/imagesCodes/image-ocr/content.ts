import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'OCR (optical character recognition) turns the pixels of a screenshot, scan or photo of text into text you can copy. This tool runs the Tesseract engine as WebAssembly, with its LSTM model, so the recognition happens on your device.',
        'The first run downloads the engine and the English model (about 5.8 MB) and caches them for offline use. Czech adds about 2.2 MB when you select it. The image is never uploaded.',
        'The result is the recognized text plus a JSON report with the language, the mean confidence, and every line and word with its confidence and bounding box in source pixels.',
      ],
      title: 'What is Image to Text (OCR)?',
    },
    {
      content: [
        'Copy text out of a screenshot, a slide photo or a scanned page.',
        'Pull an error message or a code snippet out of an image that cannot be selected.',
        'Check how well a scan reads before you send it on, using the confidence figures.',
        'Get word positions as JSON when you need to find where text sits in an image.',
      ],
      title: 'When to use Image to Text (OCR)',
    },
  ],
  examples: [
    'The Dev Toolora sample with English and Automatic page → "Dev Toolora 2026" and a summary such as "3 words · mean confidence 95 % · English · 1.2 s."',
    'The Czech sample with Czech → "Příliš žluťoučký kůň".',
    'English + Czech reads a page that mixes both languages, at the cost of downloading both models.',
    'Single line on a one-line crop reads it as one line and skips page analysis.',
    'One block with Upscale 2x helps with small text, such as a screenshot of a footnote.',
    'Sparse text finds scattered words, such as labels on a diagram, without assuming paragraphs.',
  ],
  faq: [
    {
      answer:
        'Try Upscale 2x, a different layout, or a sharper image. Text under about 20 pixels high, low contrast and skewed pages are the usual causes. The summary says so when the mean confidence is below 60 %.',
      question: 'Why is the text wrong or empty?',
    },
    {
      answer:
        'Not in this version. Only English and Czech are included, because each language adds a download and, in VS Code, size to the extension.',
      question: 'Can it read other languages?',
    },
    {
      answer:
        'No. This tool reads PNG, JPEG, WebP, BMP and GIF. For a PDF with a text layer use PDF Text Extractor. A scanned PDF needs a page exported as an image first.',
      question: 'Can I give it a PDF?',
    },
    {
      answer:
        'The image may be 20 MiB and 25,000,000 pixels, counted after Upscale. A run that takes longer than 120 seconds is stopped. The error names the limit that was hit.',
      question: 'How large an image can I use?',
    },
    {
      answer:
        'No. Everything runs locally. The engine and language files are downloaded once from the same place as the app, then cached.',
      question: 'Is my image sent to a server?',
    },
  ],
  help: 'Choose an image of up to 20 MiB: PNG, JPEG, WebP, BMP or GIF.\n\nPick the language, English, Czech or both, and the layout that matches the picture. Turn on Upscale 2x for small text.\n\nPress Run. The first run downloads the engine and the language model, so it takes longer than later runs.\n\nCopy the text, or save the JSON report with the confidence and the position of every line and word.',
  notes: [
    'Only English and Czech are supported. Other languages are not included.',
    'PDF input is not supported. Use PDF Text Extractor for PDFs that have a text layer.',
    'HEIC images must be converted first with HEIC to JPG & PNG.',
    'Handwriting is not recognized reliably. The model is trained for printed text.',
    'Orientation and script detection are off, so a rotated image needs to be turned upright first.',
    'There is no hOCR output and no searchable PDF. The outputs are the plain text and a JSON report.',
    'Bounding boxes are { x, y, width, height } in pixels of the source image, also when Upscale 2x was used.',
    'PNG and JPEG are read as they are. WebP, BMP and GIF are redrawn on a canvas first; a GIF reads its first frame.',
  ],
};
