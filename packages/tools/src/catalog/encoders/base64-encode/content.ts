import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Base64 represents bytes as printable ASCII text so they can be carried by formats or protocols that expect text instead of raw bytes.\n\nText mode uses UTF-8, preserving characters such as č and 🐎; File mode works directly with original bytes, including images and PDFs.\n\nEvery group of three bytes becomes four Base64 characters, making the encoded data roughly one-third larger before padding.\n\nBase64 is encoding, not encryption or compression; it does not protect the original content.',
      title: 'What is Base64?',
    },
    {
      content: [
        'Encode UTF-8 text for an API field or text-only format that explicitly requires Base64.',
        'Decode a Base64 text value from a log, test fixture or payload to inspect its original content.',
        'Encode a local image, PDF or other file for a text-only payload, or recover a file from Base64 or a Base64 Data URI.',
        'Use URL-safe mode to inspect the JSON header or payload of a signed JWT, one segment at a time; use the JWT Parser for a complete token.',
      ],
      title: 'When to use Base64 Encode / Decode',
    },
  ],
  examples: [
    'Standard encode: hello → aGVsbG8=',
    'Standard decode: aGVsbG8= → hello',
    'URL-safe encode: Hi? → SGk_ (standard: SGk/)',
    'File decode: /w== → a one-byte file containing FF, not UTF-8 text.',
    'Data URI decode: data:application/pdf;base64,JVBERi0xLjcKJSBERU1P → PDF-header demo bytes, not a complete PDF document.',
  ],
  faq: [
    {
      answer:
        'No. Base64 is a public, reversible encoding with no key, so anyone can turn the text back into the original bytes. Use it to carry data through text-only formats, and use real encryption when content must stay secret.',
      question: 'Is Base64 encryption?',
    },
    {
      answer:
        'Base64 turns every 3 bytes into 4 characters. When the input length is not a multiple of 3, standard Base64 completes the last group with one or two = signs. URL-safe output here omits that padding, and both alphabets decode padded or unpadded input.',
      question: 'Why does my Base64 string end with = signs?',
    },
    {
      answer:
        'Base64URL replaces + with - and / with _ so the value can appear in URLs, filenames and JWT segments without escaping, and it usually drops the = padding. Pick the matching Alphabet: the tool rejects characters from the other alphabet instead of guessing.',
      question: 'What is the difference between Base64 and Base64URL?',
    },
    {
      answer:
        'Text mode turns the decoded bytes into UTF-8 text, so images, compressed data or text in another encoding cannot be shown. Switch Content to File and decode again to save the original bytes as a file.',
      question: 'Why does decoding say the bytes are not valid UTF-8?',
    },
    {
      answer:
        'Yes. Choose File and Decode, then paste the whole data: URI; the part after the comma is decoded with the standard alphabet and can be saved as a file. A preview appears only when the bytes really are a PNG, JPEG, GIF or WebP image.',
      question: 'Can I decode a data:image/png;base64 string?',
    },
    {
      answer:
        'No. Encoding and decoding are local calculations and the tool makes no network request. A file you choose is read on your device, and a recovered file is only written when you save it yourself.',
      question: 'Does this tool upload my text or file?',
    },
  ],
  help: 'Choose Text or File, then Encode or Decode and the alphabet used by the source or destination.\n\nEncoding uses UTF-8, preserving spaces and line breaks.\n\nIn File → Encode, choose or drop a local file and select Base64 or Data URI output; run, copy or save the result, then switch output format if needed.\n\nIn File → Decode, paste Base64 or a Base64 Data URI, optionally choose a download filename, then run and save the recovered file; supported raster images show a preview.\n\nDecoding ignores whitespace around Base64 characters and accepts valid padded or unpadded input.\n\nUse “Use result & reverse” to switch direction with the text result or recovered file bytes; this never converts a binary file through UTF-8.',
  notes: [
    'Base64 is encoding, not encryption. Anyone can decode it; do not use it to protect secrets.',
    'Text mode rejects non-UTF-8 bytes. Choose File to preserve binary data instead.',
    'Standard and URL-safe alphabets are explicit; the tool does not guess or mix them. Invalid padding and non-canonical encodings are rejected.',
    'File mode supports one file up to 10 MiB. Plain Base64 contains no original name or media type; signatures provide only a suggested type, not a file-integrity check.',
    'Data URIs use standard Base64 and carry media type metadata. Preview is limited to recognizable PNG, JPEG, GIF and WebP bytes; HTML, SVG, PDF and other files are download-only.',
    'Files stay local and are not stored in VS Code drafts. Clear removes current inputs and results; saving or opening a recovered file is your explicit action.',
  ],
};
