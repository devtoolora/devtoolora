import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Glassmorphism makes a panel look like frosted glass: a translucent tint over a blurred, slightly more saturated copy of whatever sits behind it. In CSS that is a semi-transparent background plus backdrop-filter, with a thin light border to catch the edge.',
        'The tint color and its opacity set how much of the backdrop shows through. Blur softens it, saturation brings the colors behind the panel back after blurring, and the border opacity controls how crisp the edge looks.',
        'The rule is written with both -webkit-backdrop-filter and backdrop-filter so older Safari versions still render the effect. The border is always white at the chosen opacity.',
      ],
      title: 'How does glassmorphism work in CSS?',
    },
    {
      content: [
        'Cards, modals and navigation bars that float over images, gradients or video.',
        'Dashboards and landing pages with a colorful background layer.',
        'Overlays that should keep the page context visible behind them.',
        'Checking text contrast before committing to a translucent panel.',
      ],
      title: 'When to use Glassmorphism Generator',
    },
  ],
  examples: [
    'Classic frost → .glass { background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(12px) saturate(140%); }',
    'Heavy blur → .glass { background: rgba(255, 255, 255, 0.14); backdrop-filter: blur(28px) saturate(140%); }',
    'Dark smoke → .glass { background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(12px) saturate(160%); }',
    'Sharp edge → .glass { border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 4px; }',
    'Pill panel → .glass { backdrop-filter: blur(20px) saturate(140%); border-radius: 64px; }',
    'Rose tint → .glass { background: rgba(251, 113, 133, 0.25); backdrop-filter: blur(12px) saturate(180%); }',
  ],
  faq: [
    {
      answer:
        'backdrop-filter only affects what is painted behind the element, so the element needs a translucent background and something visible behind it. On a flat page background there is nothing to blur.',
      question: 'Why is the blur not visible on my page?',
    },
    {
      answer:
        'Not by default. Text over a translucent panel changes contrast with the backdrop. Raise the tint opacity, darken the tint or add a text color that works on the worst part of the backdrop.',
      question: 'Is text readable on glass?',
    },
    {
      answer:
        'Yes, all current browsers support it. The -webkit- line is kept for older Safari. Provide a solid background fallback if you must support browsers without it.',
      question: 'Does backdrop-filter work everywhere?',
    },
    {
      answer:
        'Large blur on big or animated elements is costly to paint. Keep the blur small on large panels and avoid animating it.',
      question: 'Is backdrop-filter expensive?',
    },
  ],
  help: 'Pick a Tint color and set its opacity, then drag Blur, Saturation, Border opacity and Corner radius. The card updates live over a colorful backdrop.\n\nThe sample text on the card helps you judge contrast. Try a darker tint or a higher opacity if it gets hard to read.\n\nUse Apply sample to jump to a ready-made look such as Dark smoke or Pill panel.\n\nCopy the CSS or download glass.css with the audit report. The backdrop and sample text are only for the preview and are not exported.',
  notes: [
    'Tint can be any opaque CSS color, such as #ffffff or white. Transparent colors are rejected.',
    'Tint opacity is 0 to 100 %, blur 0 to 40 px, saturation 100 to 200 %, border opacity 0 to 100 % and corner radius 0 to 64 px. Values outside the range are rejected, never clamped.',
    'The tint is converted to an rgba() background so only the alpha channel changes with opacity.',
    'The border is always a 1px solid white line at the chosen opacity, whatever the tint color.',
    'Text contrast depends on what is behind the panel, so check it on your real background.',
    'The preview backdrop, sample text and card size are not exported.',
  ],
};
