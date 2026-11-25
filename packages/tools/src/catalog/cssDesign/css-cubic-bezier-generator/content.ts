import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A cubic-bezier() timing function describes how an animation or transition progresses over time. The curve always starts at (0, 0) and ends at (1, 1); the two control points P1 (x1, y1) and P2 (x2, y2) bend it in between. The x axis is time and the y axis is progress.',
        'The x values must stay between 0 and 1 so time only moves forward. The y values may leave that range: a y below 0 pulls the motion back before it starts, and a y above 1 overshoots the end before settling, which is how "back" easings get their bounce.',
        'The CSS keywords ease, ease-in, ease-out, ease-in-out and linear are shorthands for fixed cubic-bezier() curves. The tool prints the numeric form for them too, so you can tweak a keyword without losing its starting shape.',
      ],
      title: 'How does cubic-bezier() easing work?',
    },
    {
      content: [
        'Tuning hover, menu and modal transitions so they feel quick but not abrupt.',
        'Adding a small overshoot to buttons, toasts and cards that pop in.',
        'Sharing one easing across a design system through a custom property.',
        'Comparing an easing with linear motion before using it in keyframes.',
      ],
      title: 'When to use Cubic-Bezier & Easing Editor',
    },
  ],
  examples: [
    'Back overshoot → --easing: cubic-bezier(0.68, -0.6, 0.32, 1.6); transition: transform 300ms var(--easing);',
    'Material standard → --easing: cubic-bezier(0.4, 0, 0.2, 1);',
    'Keyword ease-in-out → --easing: cubic-bezier(0.42, 0, 0.58, 1);',
    'Snappy out (easeOutCubic, 200 ms) → --easing: cubic-bezier(0.33, 1, 0.68, 1); transition: transform 200ms var(--easing);',
    'Gentle sine (easeInOutSine, 600 ms) → --easing: cubic-bezier(0.37, 0, 0.63, 1);',
    'Spring out (easeOutBack, 450 ms) → --easing: cubic-bezier(0.34, 1.56, 0.64, 1);',
  ],
  faq: [
    {
      answer:
        'A time value outside 0 to 1 would make the curve go back in time, so CSS treats such a cubic-bezier() as invalid. Progress (y) has no such limit, which is why only y may overshoot.',
      question: 'Why are x values limited to 0..1?',
    },
    {
      answer:
        'Drag a handle in the plot, focus it and use the arrow keys, or type in the X1, Y1, X2 and Y2 rows. Any of these switches the preset to Custom curve and keeps the other control point where it was.',
      question: 'How do I start from a preset and adjust it?',
    },
    {
      answer:
        'Yes. Use var(--easing) in transition-timing-function, animation-timing-function or the transition and animation shorthands, for example in the CSS Keyframes Generator.',
      question: 'Can I use the easing in keyframe animations?',
    },
    {
      answer:
        'The custom property lets every component share one easing and change it in one place. Replace var(--easing) with the cubic-bezier() value if you prefer a plain declaration.',
      question: 'Why is the easing a custom property?',
    },
  ],
  help: 'Pick a Preset to start from a CSS keyword or an easings.net curve, or type X1, Y1, X2 and Y2 directly (editing one switches the preset to Custom curve). Set the Duration in milliseconds.\n\nDrag the two control points in the plot to reshape the curve. A focused point moves 0.01 with the arrow keys and 0.1 with Shift. Moving a point switches the preset to Custom curve.\n\nPress Play to run the block across the track with your easing next to a linear ghost block. With reduced motion turned on, the preview stays paused until you press Play.\n\nCopy the CSS or download easing.css with the audit report. The plot, track and ghost block are only for the preview and are not exported.',
  notes: [
    'X1 and X2 are 0 to 1, Y1 and Y2 are -1 to 2, all with up to 2 decimals. Values outside the range are rejected, never clamped.',
    'Dragging a handle in the plot clamps it to the same ranges and rounds to 2 decimals.',
    'Duration is 100 to 10000 ms.',
    'Keyword presets print their numeric cubic-bezier() form, and the summary names the keyword.',
    'The easings.net values were taken from easings.net on 2026-10-27.',
    'The transition animates transform only; change the property in your own CSS if you transition something else.',
    'The plot, track, linear ghost block and Play button are preview-only and are not exported.',
  ],
};
