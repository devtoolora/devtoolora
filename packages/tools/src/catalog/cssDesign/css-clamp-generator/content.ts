import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'clamp(min, preferred, max) picks the preferred value but never goes below the minimum or above the maximum. For fluid type the preferred value is a straight line: an offset plus a share of the viewport width in vw.',
        'The line is fixed by two points: the minimum size at the minimum viewport and the maximum size at the maximum viewport. The slope is (max - min) / (maxViewport - minViewport), and the offset is min - slope x minViewport.',
        'Below the minimum viewport the text stays at the minimum size and above the maximum viewport it stays at the maximum, so type never shrinks or balloons.',
      ],
      title: 'How does fluid type with clamp() work?',
    },
    {
      content: [
        'Headings and display text that should scale smoothly between phone and desktop.',
        'Replacing a stack of font-size media queries with one declaration.',
        'Checking that a fluid scale still respects WCAG 1.4.4 text resizing.',
        'Converting a design spec given in px at two breakpoints into rem.',
      ],
      title: 'When to use Fluid Type / clamp() Generator',
    },
  ],
  examples: [
    '16 to 32 px, 320 to 1280 px, rem → font-size: clamp(1rem, 0.6667rem + 1.6667vw, 2rem);',
    'Same values in px → font-size: clamp(16px, 10.6667px + 1.6667vw, 32px);',
    'Table row at 768 px for the defaults → 768px 23.4667px',
    '14 to 48 px → ratio 3.4286, the WCAG 1.4.4 zoom warning appears',
    'Body text 16 to 20 px → font-size: clamp(1rem, 0.9167rem + 0.4167vw, 1.25rem);',
    'Root font size 10 px → rem values are divided by 10 instead of 16',
  ],
  faq: [
    {
      answer:
        'Users who zoom to 200 % should get text at least twice as large. When the maximum is more than 2.5 times the minimum, the vw part can outgrow the zoom effect, so the tool warns you.',
      question: 'Why is there a zoom warning?',
    },
    {
      answer:
        "rem follows the user's browser font size and is the safer default. Use px only when you need pixel-exact output. The root font size field only matters for rem.",
      question: 'Should I output rem or px?',
    },
    {
      answer:
        'The size table shows the computed font size at the two bounds and at 768, 1024 and 1440 px, so you can see where the text is clamped.',
      question: 'What does the table show?',
    },
    {
      answer:
        'Yes. Put the declaration on any property that takes a length, such as margin or gap. The output is font-size, so rename the property.',
      question: 'Can I use it for spacing?',
    },
  ],
  help: 'Enter the minimum and maximum font size and the viewport widths where they apply. Choose rem or px for the output.\n\nThe first line is the font-size declaration with clamp(). Below it a comment table lists the computed size at the two bounds and at 768, 1024 and 1440 px.\n\nIf the maximum is more than 2.5 times the minimum, a WCAG 1.4.4 warning is added to the output and the summary.\n\nCopy the CSS or download fluid-type.css. The minimum must be smaller than the maximum for both sizes and viewports.',
  notes: [
    'Sizes are 1 to 500 px with up to two decimals; viewports are 200 to 3840 px; root font size is 1 to 64 px.',
    'Minimum size must be smaller than maximum size, and minimum viewport smaller than maximum viewport.',
    'Out-of-range or non-numeric values are rejected, never clamped.',
    'Results are rounded to four decimals with trailing zeros removed.',
    'The warning triggers when maximum / minimum is greater than 2.5.',
    "Using rem respects the visitor's browser font size; vw alone does not.",
  ],
};
