import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'CSS keyframes describe style changes during an animation with from/to opacity and transform states plus an .element animation shorthand.',
        'Presets describe normal travel: fade-up, fade-down, slide-left, slide-right. Negative Distance reverses these offsets.',
      ],
      title: 'What are CSS keyframes?',
    },
    {
      content: [
        'Compare entrance motion on a real card instead of guessing transforms.',
        'Tune timing and easing, then export validated CSS keyframes for your layouts.',
      ],
      title: 'When to use CSS Keyframes Generator',
    },
  ],
  examples: [
    'Fade up, Distance 16, Opacity from 0, Duration 600 → from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } and animation: fade-up 600ms ease-out 0ms 1 normal both;',
    'Slide right, Distance 40 → from translateX(-40px) to translateX(0); Fade down likewise starts at translateY(-Distance).',
    'Pulse, Scale from 105, Iterations infinite, Direction Alternate → scale(1) to scale(1.05) with animation: pulse 1000ms ease-in-out 0ms infinite alternate both;',
    'Iterations 0.5 → animation: … 0.5 normal both; the element stops halfway through the motion.',
    'Pop, Scale from 90 → from scale(0.9) to scale(1.04), fading in from Opacity from.',
    'Name none → error: reserved CSS keywords cannot name an animation.',
  ],
  faq: [
    {
      answer:
        'Copy both blocks: the @keyframes rule defines the motion and the .element rule plays it with the animation shorthand. Add class="element" to your markup or rename .element to your own selector.',
      question: 'How do I use the generated keyframes?',
    },
    {
      answer:
        'Type infinite in Iterations. Choose Alternate in Direction so every other cycle plays backwards; with Normal the element jumps back to the start at the end of each cycle.',
      question: 'How do I make an animation loop forever?',
    },
    {
      answer:
        'It applies the starting keyframe during the Delay and keeps the final keyframe after the last iteration, so the element does not flash its normal style before or after the animation.',
      question: 'What does Fill mode Both do?',
    },
    {
      answer:
        'Wrap the exported rule in @media (prefers-reduced-motion: no-preference) { … }, or set animation: none inside @media (prefers-reduced-motion: reduce). The generated CSS does not add either for you.',
      question: 'How do I respect prefers-reduced-motion?',
    },
    {
      answer:
        'Names must be CSS identifiers of 1–64 letters, digits, hyphens or underscores, such as fade-in, and cannot be reserved words like none, ease, infinite or both. A name that starts with a digit is rejected.',
      question: 'Why is my animation name rejected?',
    },
  ],
  help: 'Choose a sample or set the preset and starting Distance, Scale and Opacity.\n\nSet whole-millisecond Duration/Delay and 0…99 iterations (fractions allowed), or infinite.\n\nPause/Play and Replay affect only the preview.\n\nCopy or download keyframes.css and the JSON audit.',
  notes: [
    'Name is a restricted CSS identifier up to 64 characters; reserved CSS/animation keywords are rejected.',
    'Distance: whole pixels −200…200; Scale: 1…200%; Opacity: 0…100%; Duration: 100…10000 ms; Delay: 0…10000 ms.',
    'Zero iterations does not play a cycle. Fractions remain fractional; negative counts are invalid.',
    'Reverse/alternate affect playback, not generated states.',
    'Fill mode determines retained keyframe styles before/after playback.',
    'Fade and slide presets use Distance and Opacity from; Scale in and Pop use Scale from and Opacity from; Spin uses Opacity from and a fixed −180° rotation; Pulse uses Scale from, never below 100%, at full opacity, so it only animates above 100%.',
    'The preview starts paused when the system asks for reduced motion. The exported CSS has no prefers-reduced-motion rule, so add one in your stylesheet.',
  ],
};
