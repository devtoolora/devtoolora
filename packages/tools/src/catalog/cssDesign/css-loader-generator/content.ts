import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A CSS loader is an empty element that animates with keyframes. Rings rotate a bordered circle, the pulse scales and fades a filled circle, and the bar slides a gradient segment across a track.',
        'Because the loader needs no image or script, it renders immediately, scales to any size and takes its colors from CSS. The generated markup comment shows the element to add: a span with role="status" and an aria-label, so assistive technology announces that content is loading.',
        'The generated media query slows the animation to three times the duration for visitors who prefer reduced motion. The loader keeps showing progress, only more calmly.',
      ],
      title: 'How does a pure CSS loader work?',
    },
    {
      content: [
        'Buttons, cards and tables that wait for data.',
        'Full-page or section loading states before content arrives.',
        'Indeterminate progress when the real percentage is unknown.',
        'Lightweight placeholders in embedded widgets without extra assets.',
      ],
      title: 'When to use CSS Loader & Spinner Generator',
    },
  ],
  examples: [
    'Classic ring → .loader { width: 48px; height: 48px; border: 4px solid #cbd5e1; border-top-color: #2563eb; animation: loader-ring 800ms linear infinite; }',
    'Dual ring (purple, 6 px) → border-color: #9333ea transparent; animation: loader-dual-ring 800ms linear infinite;',
    'Soft pulse (64 px, 1200 ms) → animation: loader-pulse 1200ms ease-out infinite;',
    'Progress bar (40 px, 6 px) → width: 160px; height: 6px; animation: loader-bar 1400ms ease-in-out infinite;',
    'Thin large ring (120 px, 2 px) → width: 120px; height: 120px; border: 2px solid #cbd5e1;',
    'Dark track → border: 4px solid #334155; border-top-color: #f8fafc;',
  ],
  faq: [
    {
      answer:
        'The spinner should still communicate that work is in progress, so the override makes it three times slower instead of removing the animation.',
      question: 'Why does reduced motion slow the loader instead of stopping it?',
    },
    {
      answer:
        'Add the span from the markup comment, keep role="status" and the aria-label, and paste the CSS. Change the label if the loader describes something specific.',
      question: 'How do I use the generated CSS?',
    },
    {
      answer:
        'Track color is the faint ring or bar behind the moving part, so it only applies to the Ring and Bar presets. Thickness does not apply to the filled Pulse.',
      question: 'Why are some fields hidden?',
    },
    {
      answer:
        'Yes. Set the size on the element, or override width and height in your own CSS. The bar is four times wider than its Size value.',
      question: 'Can I resize the loader afterwards?',
    },
  ],
  help: 'Choose a Preset, then set the Color and, for Ring and Bar, the Track color. Size, Thickness and Duration control the shape and speed.\n\nThe preview animates immediately. Press Pause to freeze it in place and Play to continue. With reduced motion turned on, the preview starts paused until you press Play.\n\nThe output starts with a comment showing the markup to use, followed by the keyframes, the .loader rule and a reduced-motion media query that slows the loader.\n\nCopy the CSS or download loader.css with the audit report. The preview stage and the Pause button are not exported.',
  notes: [
    'Colors can be any opaque CSS color and print as #rrggbb hex. Transparent colors are rejected.',
    'Size is 16 to 200 px, thickness 1 to 24 px and duration 300 to 5000 ms. Out-of-range values are rejected, never clamped.',
    'Track color is used by Ring and Bar only; Thickness is hidden for Pulse.',
    'The bar is four times as wide as the Size value.',
    'The reduced-motion override multiplies the duration by three.',
    'The preview stage and the Pause button are preview-only and are not exported.',
  ],
};
