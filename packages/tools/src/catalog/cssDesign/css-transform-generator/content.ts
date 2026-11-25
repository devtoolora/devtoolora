import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The transform property moves, rotates, scales and skews an element without changing the layout around it. Functions are applied right to left, so the order in which they are written changes the result.',
        'This tool prints the functions in a fixed order: perspective, translate, rotate, rotateX, rotateY, scale, skew. A function at its identity value (0 for the offsets and angles, 100% for scale) does nothing and is omitted. If every value is at identity the output is transform: none.',
        'transform-origin sets the point the element rotates, scales and skews around. It is printed only when it is not center, and the preview marks it with a dot on the dashed outline of the original position.',
      ],
      title: 'How does the transform property work?',
    },
    {
      content: [
        'Tilt, lift or scale cards and buttons on hover.',
        'Create 3D flips and perspective tilts with rotateX, rotateY and perspective.',
        'Slant labels and badges with skew.',
        'Find the right transform-origin before animating with keyframes.',
      ],
      title: 'When to use CSS Transform Generator',
    },
  ],
  examples: [
    'Tilt and grow → .transform { transform: rotate(15deg) scale(1.1); }',
    '3D card flip → .transform { transform: perspective(800px) rotateY(35deg); }',
    'Lean back → .transform { transform: perspective(900px) rotateX(40deg); }',
    'Italic slant → .transform { transform: skew(-12deg, 0deg); }',
    'Nudge from corner → .transform { transform: translate(24px, 12px) rotate(-8deg); transform-origin: top left; }',
    'Everything at identity → .transform { transform: none; }',
  ],
  faq: [
    {
      answer:
        'Without perspective, rotateX and rotateY look flat because there is no depth. Set Perspective to a value such as 800 px to add it to the transform, or put perspective on the parent element in your own CSS.',
      question: 'Why does my 3D rotation look flat?',
    },
    {
      answer:
        'The preview stage supplies its own perspective only while Perspective is 0. When you set a value, that value is used and the stage does not add a second one.',
      question: 'Is perspective doubled in the preview?',
    },
    {
      answer:
        'Yes. CSS applies transform functions from right to left on the element, so rotate then translate is not the same as translate then rotate. This tool always uses one documented order.',
      question: 'Does the order of functions matter?',
    },
    {
      answer:
        'Scale 0 collapses the element to nothing on that axis. Values above 100 enlarge it. Both axes at the same value are written as a single number.',
      question: 'What do scale values mean?',
    },
  ],
  help: 'Drag the sliders for translate, rotate, 3D rotation, scale, skew and perspective, or pick a sample from Apply sample.\n\nChoose a Transform origin to change the point the element pivots around; it shows as a dot on the dashed outline.\n\nCompare the transformed card with the dashed outline of its original position. The stage scrolls, so large values are never cut off.\n\nCopy the CSS or download transform.css with the audit report; values at identity are left out of the output.',
  notes: [
    'Translate is limited to -200 to 200 px, rotate to -360 to 360 deg, rotateX and rotateY to -180 to 180 deg, scale to 0 to 300 %, skew to -80 to 80 deg and perspective to 0 to 2000 px. Values outside the range are rejected, never clamped.',
    'A function at its identity value is omitted; when all are at identity the output is transform: none.',
    'The order is fixed: perspective, translate, rotate, rotateX, rotateY, scale, skew.',
    'Perspective 0 means no perspective() function is written.',
    'transform-origin is one of nine keyword positions and is printed only when it is not center.',
    'The preview card, dashed outline, origin dot and stage perspective are not exported.',
  ],
};
