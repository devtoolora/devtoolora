import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A barcode turns a short string into a row of bars that a scanner reads. This tool draws Code 128, EAN-13, UPC-A and Code 39 as an SVG with a white background, one black path and optional human-readable text.',
        'Code 128 encodes all of ASCII. The tool picks code sets A, B and C the way ISO/IEC 15417 Annex E describes, so runs of digits are packed in pairs, and it calculates the modulo 103 check character. EAN-13 and UPC-A take 12 or 11 digits and add the check digit, or verify it when you give the full number. Code 39 uses A-Z, 0-9 and a few symbols, with an optional mod 43 check character.',
        'The SVG includes the quiet zones scanners need on both sides, and EAN and UPC guard bars extend below the others. The preview shows the exact SVG that you copy or save.',
      ],
      title: 'What is a barcode generator?',
    },
    {
      content: [
        'Product labels: EAN-13 for retail items worldwide, UPC-A for North America.',
        'Shipping, inventory and asset tags with Code 128.',
        'Legacy and industrial labels that still use Code 39.',
        'Checking a GTIN check digit before it goes into a catalog or a feed.',
      ],
      title: 'When to generate a barcode',
    },
  ],
  examples: [
    'Code 128 · Wikipedia → start B, 12 codewords including check and stop',
    'EAN-13 · 400638133393 → 4006381333931 (check digit 1)',
    'EAN-13 · 400-638 133393 → spaces and hyphens are ignored',
    'EAN-13 · 4006381333932 → rejected, Check digit should be 1',
    'UPC-A · 03600029145 → 036000291452 (check digit 2)',
    'Code 39 · wiki → *WIKI*, uppercased with a note',
  ],
  faq: [
    {
      answer:
        'The last digit of EAN-13 and UPC-A is calculated from the others. A wrong digit would print a code that scanners reject or that points to another product, so the tool refuses it and tells you the right one.',
      question: 'Why is my check digit rejected?',
    },
    {
      answer:
        'Code 128 accepts ASCII characters 0-127 only, because every character has to map to a defined bar pattern. Use Code 128 with plain ASCII, or encode the text another way first.',
      question: 'Why does Code 128 reject accented letters?',
    },
    {
      answer:
        'Code 39 has no lowercase letters, so the tool uppercases them and says so in the summary. The star is reserved as the start and stop character and is rejected.',
      question: 'What happens to lowercase letters in Code 39?',
    },
    {
      answer:
        'Module width is the width of the narrowest bar in pixels. Most scanners need at least about 0.25 mm per module when printed, so scale the SVG to the printed size, not the other way around.',
      question: 'What does module width mean?',
    },
    {
      answer:
        'Code 128 is denser and covers all of ASCII, which suits internal labels. Code 39 is older, longer for the same data, but needs no check character.',
      question: 'Should I choose Code 128 or Code 39?',
    },
  ],
  help: 'Choose a Format, then type or paste the text to encode.\n\nEAN-13 takes 12 or 13 digits and UPC-A takes 11 or 12. Spaces and hyphens are ignored, a missing check digit is added and a given one is verified.\n\nModule width and Bar height set the size, and Show text prints the digits under the bars. For Code 39 you can add the mod 43 check character.\n\nCopy the SVG or save it as barcode-<format>.svg. Spaces around Code 128 and Code 39 data are encoded, because they are valid data there. Every format drops one trailing line break from a paste and says so.',
  notes: [
    'Code 128 accepts ASCII 0-127 and 1-80 characters; control characters print as a dot in the text.',
    'EAN-13 needs 12 or 13 digits; UPC-A needs 11 or 12 and is encoded as EAN-13 with a leading 0.',
    'Code 39 accepts A-Z, 0-9, - . space $ / + % and 1-60 characters.',
    'Quiet zones in modules: Code 128 and Code 39 10 + 10, EAN-13 11 + 7, UPC-A 9 + 9.',
    'Not supported: GS1-128 (FNC1), Code 128 shift, EAN-8, UPC-E, ITF and 2D codes.',
    'Check the printed code with a real scanner before you print a large run.',
  ],
};
