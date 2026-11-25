import { buildGif } from './gifBuilder';

// Expected frames are composited RGBA as hex, one string per row; transparent pixels are 00000000.
// Every expected value was cross-checked with ImageMagick 7.1.2 (`magick x.gif -coalesce rgba:-`).

/** 3 frames, 4×4, disposals 1/2/3, transparent indices 3/0/1, delays 0/1/25 cs, loops forever. */
export const animatedGif = {
  base64:
    'R0lGODlhBAAEAPEAAP8AAAD/AAAA/////yH/C05FVFNDQVBFMi4wAwEAAAAh+QQFAAADACwAAAAABAAEAAACCAQSMBOyLUQoACH5BAkBAAAALAAAAAACAAIAAAIDhAQFACH5BA0ZAAEALAEAAQADAAMAAAIFzARhEwUAOw==',
  frames: [
    [
      'ff0000ffff0000ff00ff00ff00ff00ff',
      'ff0000ff000000000000000000ff00ff',
      '0000ffff000000000000000000ff00ff',
      '0000ffff0000ffff0000ffff00ff00ff',
    ].join(''),
    [
      'ff0000ff0000ffff00ff00ff00ff00ff',
      '0000ffff000000000000000000ff00ff',
      '0000ffff000000000000000000ff00ff',
      '0000ffff0000ffff0000ffff00ff00ff',
    ].join(''),
    [
      '000000000000000000ff00ff00ff00ff',
      '0000000000000000ffffffff0000ffff',
      '0000ffffff0000ff0000000000ff00ff',
      '0000ffffffffffffffffffff00ff00ff',
    ].join(''),
  ],
};

/** GIF87a, 8×8, one interlaced frame with index (x + 3y) mod 8 over an 8-color palette. */
export const interlacedGif = {
  base64:
    'R0lGODdhCAAIAPIAAAAAAP8AAAD/AAAA////AP8A/wD//////ywAAAAACAAIAEADFgghQ2XHQcXmaoXJo7AV1wZw4fOQWgIAOw==',
  frames: [
    [
      '000000ffff0000ff00ff00ff0000ffffffff00ffff00ffff00ffffffffffffff',
      '0000ffffffff00ffff00ffff00ffffffffffffff000000ffff0000ff00ff00ff',
      '00ffffffffffffff000000ffff0000ff00ff00ff0000ffffffff00ffff00ffff',
      'ff0000ff00ff00ff0000ffffffff00ffff00ffff00ffffffffffffff000000ff',
      'ffff00ffff00ffff00ffffffffffffff000000ffff0000ff00ff00ff0000ffff',
      'ffffffff000000ffff0000ff00ff00ff0000ffffffff00ffff00ffff00ffffff',
      '00ff00ff0000ffffffff00ffff00ffff00ffffffffffffff000000ffff0000ff',
      'ff00ffff00ffffffffffffff000000ffff0000ff00ff00ff0000ffffffff00ff',
    ].join(''),
  ],
};

/** 4×4, local palettes on frames 1-2, the global palette on frame 3, ANIMEXTS loop 3, a comment. */
export const localPaletteGif = {
  base64:
    'R0lGODlhBAAEAPAAAAAAAP///yH/C0FOSU1FWFRTMS4wAwEDAAAh/gdmaXh0dXJlACH5BAAKAAAALAAAAAAEAAQAgf+AAIAA/wCAgICAgAIGxBSGmhcFACH5BAAyAAAALAEAAQACAAIAgP+AwAAAgAIDRAIFACH5BAACAAAALAIAAgACAAIAAAIDDBAFADs=',
  frames: [
    [
      'ff8000ff808080ff008080ff8000ffff',
      'ff8000ff808080ff008080ff8000ffff',
      'ff8000ff808080ff008080ff8000ffff',
      'ff8000ff808080ff008080ff8000ffff',
    ].join(''),
    [
      'ff8000ff808080ff008080ff8000ffff',
      'ff8000ffff80c0ff000080ff8000ffff',
      'ff8000ff000080ffff80c0ff8000ffff',
      'ff8000ff808080ff008080ff8000ffff',
    ].join(''),
    [
      'ff8000ff808080ff008080ff8000ffff',
      'ff8000ffff80c0ff000080ff8000ffff',
      'ff8000ff000080ffffffffff000000ff',
      'ff8000ff808080ff000000ffffffffff',
    ].join(''),
  ],
};

/**
 * 128×128, 16 colors, pseudo-random indices, LZW without any clear code: the table fills at pixel
 * 9,486 and decoding continues at 12 bits. Its 9,319 bytes (12,428 Base64 chars) are too large
 * for a literal, so it is built here.
 */
export function fullTableGif(): Uint8Array {
  let seed = 1;
  const pixels = Array.from({ length: 128 * 128 }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;

    return (seed >> 16) & 15;
  });
  const palette = Array.from({ length: 16 }, (_, index): [number, number, number] => [
    index * 16,
    255 - index * 16,
    (index * 37) % 256,
  ]);

  return buildGif({
    frames: [{ clearCodes: false, height: 128, minCodeSize: 4, pixels, width: 128 }],
    height: 128,
    palette,
    width: 128,
  });
}

export const fullTableRgbaSha256 =
  'e23eff345c188592d151bde20af3ae1cf0918ca127442aeba60c20eff385016b';
