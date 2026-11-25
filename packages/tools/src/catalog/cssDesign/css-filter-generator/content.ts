import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The filter property applies graphical effects such as blur, color shifts and inversion to an element and everything inside it. backdrop-filter applies the same functions to whatever is painted behind the element, which is how frosted-glass cards and sticky blurred headers are made.',
        'Functions run in the order they are written, and this tool prints them in a fixed order: blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate, sepia. A function left at its identity value (0 for blur, grayscale, hue-rotate, invert and sepia; 100% for brightness, contrast, opacity and saturate) does nothing and is omitted. If every function is at identity the output is none.',
        'backdrop-filter only shows when the element itself is translucent, so the preview draws a semi-transparent card over a patterned backdrop. Safari still needs the -webkit- prefix, so that line is printed first.',
      ],
      title: 'What do filter and backdrop-filter do?',
    },
    {
      content: [
        'Tune photo looks: warm sepia, black and white, boosted contrast or a hue shift.',
        'Build frosted-glass panels, modals and navigation bars with backdrop-filter.',
        'Dim or invert images for dark mode without editing the files.',
        'Copy a single declaration and apply it to any selector.',
      ],
      title: 'When to use CSS Filter Generator',
    },
  ],
  examples: [
    'Subtle punch → .filter { filter: brightness(110%) contrast(120%) saturate(130%); }',
    'Frosted blur → .filter { backdrop-filter: blur(8px) brightness(105%) saturate(150%); }',
    'Vintage sepia → .filter { filter: contrast(90%) saturate(120%) sepia(60%); }',
    'Black and white → .filter { filter: contrast(115%) grayscale(100%); }',
    'Hue shift → .filter { filter: saturate(120%) hue-rotate(180deg); }',
    'Everything at identity → .filter { filter: none; }',
  ],
  faq: [
    {
      answer:
        'filter changes the element and its content. backdrop-filter changes only what is visible behind the element, so the element needs a translucent background to show the effect.',
      question: 'What is the difference between filter and backdrop-filter?',
    },
    {
      answer:
        'Safari has needed the -webkit-backdrop-filter prefix, so the backdrop target prints it first and the standard property second.',
      question: 'Why are there two lines for backdrop-filter?',
    },
    {
      answer:
        'Filter functions are applied one after another, so the order changes the result. This tool always uses the order shown in the controls so the output is predictable.',
      question: 'Does the order of functions matter?',
    },
    {
      answer:
        'No. drop-shadow() is not included; use the CSS Box Shadow Generator for element shadows.',
      question: 'Is drop-shadow() supported?',
    },
    {
      answer:
        'Large blur radii on big areas are expensive to paint, especially with backdrop-filter. Keep radii modest and test on low-end devices.',
      question: 'Is there a performance cost?',
    },
  ],
  help: 'Choose the Target: filter for the element itself or backdrop-filter for what is behind it.\n\nMove the sliders for blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate and sepia, or pick a sample from Apply sample.\n\nWatch the demo scene (or the frosted card over the patterned backdrop) update as you drag.\n\nCopy the CSS or download filter.css with the audit report; sliders at their default value are left out of the output.',
  notes: [
    'Blur is limited to 0 to 50 px, hue-rotate to 0 to 360 deg, brightness, contrast and saturate to 0 to 300 %, and the other functions to 0 to 100 %. Values outside the range are rejected, never clamped.',
    'A function at its identity value is omitted; when all are at identity the output is a .filter rule containing filter: none; or the backdrop-filter pair set to none.',
    'The order of functions is fixed: blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate, sepia.',
    'backdrop-filter needs a translucent or transparent background on the element to be visible.',
    'The demo scene, card and patterned backdrop in the preview are not exported.',
    'Everything is generated locally from the validated slider values.',
  ],
};
