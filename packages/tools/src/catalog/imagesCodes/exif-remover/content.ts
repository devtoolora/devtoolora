import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'This tool reads the metadata embedded in a photo, such as camera make and model, capture date, exposure settings, software, author, copyright and GPS coordinates, and shows it as JSON.',
        'It also returns a cleaned copy: the image is redrawn from its pixels and saved again, so EXIF, GPS, XMP, IPTC and color profile data are not carried over.',
      ],
      title: 'What is Image Metadata & EXIF Remover?',
    },
    {
      content: [
        'Before posting a phone photo publicly, check whether it reveals where and when it was taken, and share the cleaned copy instead.',
        'Remove author names, camera serial numbers or editing software tags from images you send to clients or attach to bug reports.',
      ],
      title: 'When to use Image Metadata & EXIF Remover',
    },
  ],
  examples: [
    'iPhone photo with location → Make Apple, Model iPhone 15, DateTimeOriginal, latitude 50.08815 and longitude 14.420166…',
    'Edited camera photo → Software Adobe Lightroom 7.4, Artist and Copyright in the parsed tags.',
    'JPEG without EXIF → "hasExif": false and "parsed": {}.',
    'PNG screenshot without text chunks → "hasExif": false, "chunks": [] and "parsed": {}.',
    'PNG saved by an editor → "hasExif": true, "chunks": ["tEXt", "tIME"] and "parsed": {"Software": "GIMP"}.',
    'IMG_2041.jpg → IMG_2041.metadata-stripped.jpg with the same pixel size, saved at 90% JPEG quality.',
    'sticker.webp → sticker.metadata-stripped.webp with its transparency kept; where the browser cannot save WebP, a JPEG on white, as the summary says.',
    'logo.png with transparency → logo.metadata-stripped.png with the transparent areas kept.',
  ],
  faq: [
    {
      answer:
        'Yes. The cleaned copy is drawn from the pixels and encoded again, so GPS coordinates, camera details and capture dates are not written to it. The original file on your device is not changed.',
      question: 'Does removing EXIF data delete the GPS location of a photo?',
    },
    {
      answer:
        'A PNG keeps metadata in separate chunks: tEXt, iTXt and zTXt hold text such as Software or Author, eXIf holds EXIF tags, tIME the last edit time and iCCP a color profile. hasExif is true when any of them is present; the PNG header with the size and bit depth does not count.',
      question: 'What does chunks mean in the report for a PNG?',
    },
    {
      answer:
        'Only when the browser cannot encode WebP from a canvas. The copy is then a JPEG at 90% quality with transparent areas filled white, and the summary says so. Where WebP encoding works, a WebP stays WebP with its transparency.',
      question: 'Why is my WebP saved as a JPEG?',
    },
    {
      answer:
        'PNG copies are lossless, so the pixels stay identical. JPEG, WebP and other formats are encoded again at 90% quality, which can add slight compression artifacts, but the width and height stay the same.',
      question: 'Does stripping metadata reduce image quality?',
    },
    {
      answer:
        'Tags from the TIFF, EXIF and GPS blocks: Make, Model, Software, Artist, Copyright, exposure settings, dates and GPS coordinates, also as decimal latitude and longitude, plus PNG text chunks. The contents of XMP, IPTC and color profiles are not listed, although the cleaned copy drops them too.',
      question: 'Which metadata does the report list?',
    },
    {
      answer:
        'No. The metadata parser and the canvas re-encoding run on your device and the tool makes no network requests, so private photos never leave it.',
      question: 'Is my photo uploaded to a server?',
    },
  ],
  help: 'Choose a photo in Image file, or apply one of the samples.\n\nRun the tool. The report lists the file name, pixel size and type, whether metadata was found (hasExif), the metadata chunks of a PNG and every parsed tag.\n\nCheck the parsed tags, especially latitude and longitude, Make, Model, Artist and the dates.\n\nDownload the metadata-stripped copy, such as photo.metadata-stripped.jpg, and share that file instead of the original.',
  notes: [
    'EXIF dates have no time zone, so they are shown as the camera wrote them, such as 2026-01-02T03:04:05.',
    'Reading and cleaning happen on your device; the photo is not uploaded.',
    'The report covers the TIFF, EXIF and GPS blocks and, for PNG, the text chunks; chunks names the PNG metadata chunks found: tEXt, iTXt, zTXt, eXIf, tIME and iCCP. The PNG header with the size and bit depth does not count. WebP metadata is not parsed, so WebP files report no tags.',
    'PNG stays PNG, and WebP stays WebP at 90% quality when the browser can encode it. JPEG, GIF and other formats, and WebP where the browser cannot save it, become JPEG at 90% quality with transparent areas filled white.',
    'The cleaned copy keeps the width and height, but anything visible in the picture, such as a street sign or a face, stays.',
    'The original file is not changed; download the cleaned copy and share that one.',
  ],
};
