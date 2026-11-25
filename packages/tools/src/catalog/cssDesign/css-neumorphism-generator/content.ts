import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Neumorphism (soft UI) makes an element look extruded from, or pressed into, a surface of the same color. It uses two shadows: a darker one on one side and a lighter one on the opposite side.',
        'This tool derives both shades from your base color. With intensity i, the light shade scales each channel by 1 + i (capped at 255) and the dark shade scales each channel by 1 - i. The offset and blur set how far the element seems to rise.',
        'Flat raises the element. Pressed uses inset shadows so it looks sunken. Concave and convex add a diagonal gradient that bends the surface in or out, using half of the intensity.',
      ],
      title: 'How does neumorphism work in CSS?',
    },
    {
      content: [
        'Soft toggle buttons, sliders and cards on a single-color page.',
        'Pressed states for buttons that look raised by default.',
        'Quick mockups of soft-UI dashboards and music players.',
        'Deriving a matching dark and light shadow pair from any base color.',
      ],
      title: 'When to use Neumorphism Generator',
    },
  ],
  examples: [
    'Classic flat → .neumorphism { background: #e0e5ec; box-shadow: 10px 10px 20px #bec3c9, -10px -10px 20px #ffffff; }',
    'Pressed button → .neumorphism { box-shadow: inset 10px 10px 20px #bec3c9, inset -10px -10px 20px #ffffff; }',
    'Concave dish → .neumorphism { background: linear-gradient(145deg, #cfd4da, #f1f6fe); }',
    'Convex pillow → .neumorphism { background: linear-gradient(145deg, #f1f6fe, #cfd4da); }',
    'Dark mode → .neumorphism { background: #2b2f36; box-shadow: 10px 10px 20px #202329, -10px -10px 20px #363b44; }',
    'Subtle and tight → .neumorphism { box-shadow: 5px 5px 10px #ced3d9, -5px -5px 10px #f2f7ff; }',
  ],
  faq: [
    {
      answer:
        'The element must sit on a page or parent with the same base color, otherwise the shadows do not blend and the effect looks like a plain card.',
      question: 'Why does the card not look soft on my page?',
    },
    {
      answer:
        'Not on its own. The edges have very low contrast, so use text, icons or borders to mark focus, selection and state, and do not rely on the shadow alone.',
      question: 'Is neumorphism accessible?',
    },
    {
      answer:
        'Yes. Dark bases need a higher intensity, because multiplying a dark channel by 1 - i changes it only a little. The light shade is capped by white.',
      question: 'Does it work with a dark base color?',
    },
    {
      answer:
        'Pressed uses inset shadows, so the element looks sunken. Concave and convex keep outer shadows and add a gradient background instead.',
      question: 'What is the difference between pressed and concave?',
    },
  ],
  help: 'Choose a Base color, then a Shape: flat, pressed, concave or convex. The card sits on a viewport painted with your base color.\n\nDrag Offset, Blur, Intensity and Corner radius to change how far the element rises. Higher intensity gives stronger shadows.\n\nApply sample loads a ready-made look such as Dark mode or Pressed button.\n\nCopy the CSS or download neumorphism.css with the audit report. The preview viewport and label are not exported.',
  notes: [
    'Base color can be any opaque CSS color, such as #e0e5ec or gainsboro. Transparent colors are rejected.',
    'Offset is 1 to 50 px, blur 0 to 100 px, intensity 1 to 50 % and corner radius 0 to 64 px. Values outside the range are rejected, never clamped.',
    'Light shade = min(255, round(c * (1 + i))) and dark shade = round(c * (1 - i)) per channel.',
    'Concave and convex use half of the intensity for the gradient colors.',
    'Neumorphic edges are low contrast and are not a focus or state indicator on their own.',
    'The preview viewport color, card size and label are not exported.',
  ],
};
