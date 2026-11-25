import { cssError, integer, strictChoices } from './validators';

export function generateKeyframesCss(options: {
  delay: number;
  direction: string;
  distance: number;
  duration: number;
  easing: string;
  fillMode: string;
  iterations: string;
  name: string;
  opacity: number;
  preset: string;
  scale: number;
}): string {
  const name = safeAnimationName(options.name);

  strictChoices(options, {
    direction: ['normal', 'reverse', 'alternate', 'alternate-reverse'],
    easing: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'],
    fillMode: ['none', 'forwards', 'backwards', 'both'],
    preset: [
      'fade-up',
      'fade-down',
      'slide-left',
      'slide-right',
      'scale-in',
      'pop',
      'spin',
      'pulse',
    ],
  });

  const preset = options.preset;
  const distance = integer(options.distance, 'Distance', -200, 200);
  const scale = integer(options.scale, 'Scale', 1, 200) / 100;
  const opacity = integer(options.opacity, 'Opacity', 0, 100) / 100;
  const duration = integer(options.duration, 'Duration', 100, 10000);
  const delay = integer(options.delay, 'Delay', 0, 10000);
  const iterations = animationIterations(options.iterations);
  const { direction, easing, fillMode } = options;
  const [from, to] = keyframeTransforms(preset, distance, scale, opacity);

  return `@keyframes ${name} {\n  from { opacity: ${from.opacity}; transform: ${from.transform}; }\n  to { opacity: ${to.opacity}; transform: ${to.transform}; }\n}\n\n.element { animation: ${name} ${duration}ms ${easing} ${delay}ms ${iterations} ${direction} ${fillMode}; }`;
}

function keyframeTransforms(
  preset: string,
  distance: number,
  scale: number,
  opacity: number,
): [{ opacity: number; transform: string }, { opacity: number; transform: string }] {
  if (preset === 'fade-down')
    return [
      { opacity, transform: `translateY(${-distance}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ];
  if (preset === 'slide-left' || preset === 'slide-right')
    return [
      { opacity, transform: `translateX(${preset === 'slide-left' ? distance : -distance}px)` },
      { opacity: 1, transform: 'translateX(0)' },
    ];
  if (preset === 'scale-in')
    return [
      { opacity, transform: `scale(${scale})` },
      { opacity: 1, transform: 'scale(1)' },
    ];
  if (preset === 'pop')
    return [
      { opacity, transform: `scale(${scale})` },
      { opacity: 1, transform: 'scale(1.04)' },
    ];
  if (preset === 'spin')
    return [
      { opacity, transform: 'rotate(-180deg)' },
      { opacity: 1, transform: 'rotate(0deg)' },
    ];
  if (preset === 'pulse')
    return [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 1, transform: `scale(${Math.max(1, scale)})` },
    ];

  return [
    { opacity, transform: `translateY(${distance}px)` },
    { opacity: 1, transform: 'translateY(0)' },
  ];
}

function safeAnimationName(value: string): string {
  const name = value.trim();

  if (
    name.length > 64 ||
    !/^(?:[a-z_]|-[a-z_-])[a-z0-9_-]*$/i.test(name) ||
    [
      'none',
      'initial',
      'inherit',
      'unset',
      'revert',
      'revert-layer',
      'default',
      'linear',
      'ease',
      'ease-in',
      'ease-out',
      'ease-in-out',
      'step-start',
      'step-end',
      'auto',
      'infinite',
      'normal',
      'reverse',
      'alternate',
      'alternate-reverse',
      'forwards',
      'backwards',
      'both',
      'running',
      'paused',
    ].includes(name.toLowerCase())
  )
    throw cssError(
      'Use a non-reserved animation identifier of 1–64 letters, digits, hyphens or underscores, starting with a letter or underscore.',
    );

  return name;
}

function animationIterations(value: string): string {
  const iterations = value.trim();

  if (iterations === 'infinite') return iterations;

  const number = Number(iterations);

  if (
    !/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(iterations) ||
    !Number.isFinite(number) ||
    number < 0 ||
    number > 99
  )
    throw cssError('Iterations must be between 0 and 99 (fractions allowed), or infinite.');

  return String(number);
}
