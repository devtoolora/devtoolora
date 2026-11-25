import { cssColorHex } from './hexColor';

export type LoaderOptions = {
  color: string;
  duration: number;
  loaderSize: number;
  preset: 'bar' | 'dual-ring' | 'pulse' | 'ring';
  thickness: number;
  trackColor: string;
};

const round2 = (value: number): number => Number(value.toFixed(2));

const keyframes: Record<LoaderOptions['preset'], { body: string[]; easing: string }> = {
  bar: {
    body: ['0% { background-position: -66.67% 0; }', '100% { background-position: 166.67% 0; }'],
    easing: 'ease-in-out',
  },
  'dual-ring': { body: ['to { transform: rotate(360deg); }'], easing: 'linear' },
  pulse: {
    body: ['0% { transform: scale(0); opacity: 1; }', '100% { transform: scale(1); opacity: 0; }'],
    easing: 'ease-out',
  },
  ring: { body: ['to { transform: rotate(360deg); }'], easing: 'linear' },
};

function shapeDeclarations(options: LoaderOptions): string[] {
  const { color, loaderSize, preset, thickness, trackColor } = options;
  const square = [`width: ${round2(loaderSize)}px;`, `height: ${round2(loaderSize)}px;`];
  const border = `border: ${round2(thickness)}px solid ${preset === 'ring' ? trackColor : 'transparent'};`;

  if (preset === 'pulse') return [...square, `background: ${color};`, 'border-radius: 50%;'];
  if (preset === 'bar')
    return [
      `width: ${round2(loaderSize * 4)}px;`,
      `height: ${round2(thickness)}px;`,
      `background: linear-gradient(${color} 0 0) 0 0 / 40% 100% no-repeat, ${trackColor};`,
      `border-radius: ${round2(thickness / 2)}px;`,
    ];

  return [
    'box-sizing: border-box;',
    ...square,
    preset === 'ring' ? border : `border: ${round2(thickness)}px solid transparent;`,
    preset === 'ring' ? `border-top-color: ${color};` : `border-color: ${color} transparent;`,
    'border-radius: 50%;',
  ];
}

export function generateLoaderCss(options: LoaderOptions): string {
  const { duration, preset } = options;
  const color = cssColorHex(options.color, 'Color');
  const { body, easing } = keyframes[preset];

  const trackColor =
    preset === 'ring' || preset === 'bar'
      ? cssColorHex(options.trackColor, 'Track color')
      : options.trackColor;

  const name = `loader-${preset}`;

  return [
    '/* <span class="loader" role="status" aria-label="Loading"></span> */',
    `@keyframes ${name} {`,
    ...body.map((line) => `  ${line}`),
    '}',
    '',
    '.loader {',
    // The documented markup is a span, and width, height and transforms skip inline boxes.
    '  display: inline-block;',
    ...shapeDeclarations({ ...options, color, trackColor }).map((line) => `  ${line}`),
    `  animation: ${name} ${round2(duration)}ms ${easing} infinite;`,
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  .loader {',
    `    animation-duration: ${round2(duration * 3)}ms;`,
    '  }',
    '}',
  ].join('\n');
}
