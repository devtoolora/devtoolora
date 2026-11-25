import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A border triangle is a box with zero width and height whose borders meet at an angle. Two borders are transparent and the third is colored, so only a triangle is visible.',
        'Size is the border width. An up or down triangle is 2 × Size wide and Size tall; left and right triangles swap those axes.',
        'The result is plain CSS on a .triangle element, with no image or SVG file, and the live preview uses the same border declarations.',
      ],
      title: 'What is a CSS border triangle?',
    },
    {
      content: [
        'Create dropdown carets, tooltip and popover arrows, breadcrumb separators or decorative pointers.',
        'Check direction and size visually instead of working out which border gets the color.',
        'Use a hex or rgba() color with transparency to match a semi-transparent tooltip.',
        'Copy the .triangle rule and position it in your own layout.',
      ],
      title: 'When to use CSS Triangle Generator',
    },
  ],
  examples: [
    'Size 16, Down, #1e293b → border-left: 16px solid transparent; border-right: 16px solid transparent; border-top: 16px solid #1e293b; a 32 × 16 px caret.',
    'Size 32, Up, #2563eb → border-bottom: 32px solid #2563eb; with transparent left and right borders, 64 px wide and 32 px tall.',
    'Size 24, Right, #2563eb → border-left: 24px solid #2563eb; with transparent top and bottom borders, 24 px wide and 48 px tall.',
    'Color rgba(37,99,235,0.25) → border-bottom: 48px solid rgba(37,99,235,0.25); the color is kept as written, alpha included.',
    'Color blue → error asking for a hex or comma-form rgb()/rgba() color, such as #0000ff.',
  ],
  faq: [
    {
      answer:
        'The element has zero width and height, so its borders meet at diagonal joints. Coloring one border and making the two beside it transparent leaves a triangle that points away from the colored side.',
      question: 'How does a CSS triangle work?',
    },
    {
      answer:
        'Size is the width of each border, and the two transparent side borders together form the base. An up or down triangle is therefore 2 × Size wide and Size tall, so Size 16 gives a 32 × 16 px caret.',
      question: 'Why is my triangle twice as wide as Size?',
    },
    {
      answer:
        'A box-shadow on a border triangle is rectangular. Use filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)) for a shadow that follows the shape, or place a slightly larger triangle behind it to fake an outline.',
      question: 'How do I add a shadow or outline to a CSS triangle?',
    },
    {
      answer:
        'Give the tooltip position: relative and put the triangle declarations in a ::before or ::after pseudo-element with content: "" and position: absolute, then move it to the edge with top, left or transform.',
      question: 'How do I attach the triangle to a tooltip?',
    },
  ],
  help: 'Choose Up, Right, Down or Left in Direction, or pick a sample from Apply sample.\n\nDrag Size from 1 to 200 px; the visible base is twice that size.\n\nPick a hue with the Color picker or type a hex or rgb()/rgba() value in Color; the picker keeps the current alpha.\n\nCopy the CSS or download triangle.css and the css-triangle-report.json audit.',
  notes: [
    'Size is a whole number of pixels from 1 to 200. Up and down triangles are 2 × Size wide and Size tall; left and right ones are Size wide and 2 × Size tall.',
    'Color accepts #RGB, #RGBA, #RRGGBB, #RRGGBBAA and comma-separated rgb()/rgba(). Named colors, hsl() and CSS variables are rejected rather than guessed.',
    'Only Up, Right, Down and Left are accepted; an unknown direction shows an error instead of falling back to Up.',
    'The element’s content box is 0 × 0, so it holds no text and makes a poor click target. Mark a decorative triangle with aria-hidden="true".',
  ],
};
