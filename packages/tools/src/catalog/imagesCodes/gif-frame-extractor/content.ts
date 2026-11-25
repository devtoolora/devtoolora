import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A GIF stores an animation as a list of small image patches, each with a delay, a disposal rule and an optional transparent color. A patch is often only the part of the picture that changed, so a frame cut out of the file on its own rarely looks like what a browser shows.',
        'This tool plays the animation the way a browser does: it draws every patch onto one canvas, applies the disposal rules, and saves the full picture after each frame as a PNG. All PNGs and a JSON file with the timing go into one zip.',
        'The GIF is read and decoded in your browser. Nothing is uploaded.',
      ],
      title: 'What is the GIF Frame Extractor?',
    },
    {
      content: [
        'Pull single frames out of an animation to use as stills or thumbnails.',
        'Hand the frames of a reaction or UI recording to an image editor or a video tool.',
        'Check the delays, loop count and disposal modes of a GIF that plays too fast or leaves trails.',
        'Pick a few frames, such as 1-10,15, instead of exporting a long animation.',
      ],
      title: 'When to use GIF Frame Extractor',
    },
  ],
  examples: [
    'A 3-frame GIF, Frames blank → name-001.png to name-003.png and name-frames.json in one zip.',
    'Frames 2 on a 12-frame GIF → one PNG named name-002.png, padded to three digits (four for a GIF of 1,000 frames).',
    'Frames 1-10,15 → frames 1 to 10 and frame 15.',
    'A 24-frame GIF at 100 ms per frame → "24 frames · 480×270 · 2.40 s per loop · loops forever."',
    'A GIF without a loop extension → the summary ends with "plays once."',
    'Frames 40 on a 24-frame GIF → "Frame 40 does not exist; the GIF has 24 frames."',
  ],
  faq: [
    {
      answer:
        'Because the frames are composited. Each PNG is the whole picture a viewer sees after that frame, not the raw patch stored in the file. Raw frame rectangles are listed in the JSON file as rect.',
      question: 'Why is every PNG full size when the GIF stores small patches?',
    },
    {
      answer:
        'GIF delays are in hundredths of a second. Browsers play a delay of 0 or 1 as 100 ms, so playedMs shows what you would see, while delayCs shows what the file says.',
      question: 'What is the difference between delayCs and playedMs?',
    },
    {
      answer:
        'The decoder keeps the frames before the broken one and the summary says where the file ends. Data after the last frame that is not GIF data is ignored and reported as a note.',
      question: 'What happens with a damaged or cut-off GIF?',
    },
    {
      answer:
        'A GIF may have at most 1,000 frames, and frames times screen pixels may be at most 200,000,000. The zip may be 200 MiB. Past a limit, select fewer frames. A single frame whose own rectangle is over 200,000,000 pixels fails with "Frame N is larger than 200,000,000 pixels." and selecting fewer frames cannot help.',
      question: 'How large a GIF can I split?',
    },
    {
      answer:
        'Not in this tool. It writes PNGs and a JSON file; use the CSS Sprite Sheet Generator to combine the PNGs.',
      question: 'Can I get a sprite sheet or an animated WebP?',
    },
  ],
  help: 'Choose a GIF file of up to 20 MiB.\n\nLeave Frames blank to export every frame, or enter 1-based numbers and ranges such as 1-10,15.\n\nThe result shows the first selected frame and the timing of every frame as JSON. The summary gives the frame count, size and loop length.\n\nSave the zip to get the PNG frames and the JSON file.',
  notes: [
    'Frame numbers start at 1. A number outside the GIF is an error that names the frame count.',
    'PNG names are padded to three digits, or the digits of the frame count if larger, so a 12-frame GIF gives name-001.png to name-012.png, even when you select fewer frames.',
    'The JSON file lists index, delayCs, playedMs, disposal, rect, transparentIndex and localPalette for each exported frame, plus the width, height and loopCount.',
    'loopCount 0 means loops forever and null means the file has no loop extension, so it plays once.',
    'A file that ends inside frame N keeps frames 1 to N-1, and the summary says so. Other problems the decoder worked around are added to the summary.',
    'The limits are 1,000 frames and 200,000,000 frames-times-pixels, checked before any pixels are allocated, and a 200 MiB zip, checked while the zip is written.',
    'Animated WebP, APNG and GIF encoding are not supported.',
  ],
};
