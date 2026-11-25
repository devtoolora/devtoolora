import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'border-radius rounds the corners of an element’s border and background. This generator writes four circular radii in pixels, in the order top-left, top-right, bottom-right, bottom-left.',
        'Link corners is an editing aid: while it is on, moving one corner sets all four to the same value. Turn it off to give each corner its own radius.',
        'When neighboring radii add up to more than a side of the box, browsers scale all radii down proportionally, so a very large value can look the same as a smaller one.',
      ],
      title: 'What is CSS border radius?',
    },
    {
      content: [
        'Pick consistent rounding for cards, buttons, inputs and dialogs on a live preview.',
        'Round only some corners, such as the top of a panel or a tab, without remembering the four-value order.',
        'Compare square, softly rounded and capsule shapes on the same box.',
        'Copy an .element rule and check it on your real element size.',
      ],
      title: 'When to use CSS Border Radius Generator',
    },
  ],
  examples: [
    'All corners 16 → border-radius: 16px 16px 16px 16px;',
    'Top left 24, Top right 8, Bottom right 24, Bottom left 8 → border-radius: 24px 8px 24px 8px;',
    'Top left 32, Top right 32, Bottom right 0, Bottom left 0 → border-radius: 32px 32px 0px 0px; only the top corners are rounded.',
    'All corners 0 → border-radius: 0px 0px 0px 0px; square corners.',
    'All corners 200 → border-radius: 200px 200px 200px 200px; on a 300 × 120 px box browsers scale this to 60 px, a capsule.',
  ],
  faq: [
    {
      answer:
        'Clockwise from the top-left: top-left, top-right, bottom-right, bottom-left. border-radius: 24px 8px 24px 8px rounds the top-left and bottom-right corners more than the other two.',
      question: 'What order are the four border-radius values in?',
    },
    {
      answer:
        'For a pill, use a radius of at least half the element’s height, such as 200 px; browsers scale it down to a half circle at each end. For a circle, use a square element with border-radius: 50%, written by hand.',
      question: 'How do I make a pill or circle shape?',
    },
    {
      answer:
        'When two radii along one side add up to more than that side’s length, browsers scale every corner down by the same factor. Beyond that point, larger values look the same.',
      question: 'Why does a bigger radius stop making a difference?',
    },
    {
      answer:
        'border-radius rounds the element’s own border and background, not children that overflow it. Add overflow: hidden to the card, or give the image the same radius.',
      question: 'Why is the image inside my rounded card still square?',
    },
    {
      answer:
        'Not with these controls: each corner gets one circular pixel radius. For elliptical corners, edit the CSS to the slash form, such as border-radius: 40px / 20px.',
      question: 'Can I make elliptical corners?',
    },
  ],
  help: 'Pick a sample from Apply sample, or keep Link corners ticked and drag any corner to round all four together.\n\nUntick Link corners to set Top left, Top right, Bottom right and Bottom left separately; ticking it again copies the Top left value to every corner.\n\nCompare the live card with the CSS, whose values follow the order top-left, top-right, bottom-right, bottom-left.\n\nCopy the CSS or download border-radius.css and the css-radius-report.json audit.',
  notes: [
    'Each corner accepts a whole number of pixels from 0 to 200. Empty, fractional and out-of-range values show an error instead of being rounded or clamped.',
    'The output always lists all four corners in px, even when they are equal. Write percentages or elliptical slash syntax such as 40px / 20px by hand when you need them.',
    'Link corners only affects editing. The CSS contains the four values shown, and the audit records the Link corners setting with them.',
    'Rounded corners do not clip child content on their own; add overflow: hidden when images or children should follow the curve.',
    'The preview card’s size is not exported, and the visible curve depends on the size of your element.',
  ],
};
