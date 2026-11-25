const round4 = (value: number): number => Number(value.toFixed(4));
const commonRatios: Array<[string, number]> = [
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['3:2', 3 / 2],
  ['2:3', 2 / 3],
  ['1:1', 1],
  ['5:4', 5 / 4],
  ['4:5', 4 / 5],
  ['21:9', 21 / 9],
  ['1.91:1', 1.91],
  ['2.39:1', 2.39],
];

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function aspectRatio(
  width: number,
  height: number,
): {
  css: string;
  decimal: number;
  nearest: { deviation: number; label: string };
  paddingTop: number;
  ratio: [number, number];
} {
  const decimal = width / height;
  const whole = Number.isInteger(width) && Number.isInteger(height);
  const [a, b] = whole ? [width, height] : [Math.round(width * 100), Math.round(height * 100)];
  const divisor = gcd(a, b);
  const ratio: [number, number] = [a / divisor, b / divisor];
  const [label, reference] = commonRatios.reduce((best, entry) =>
    Math.abs(decimal / entry[1] - 1) < Math.abs(decimal / best[1] - 1) ? entry : best,
  );

  return {
    css: `aspect-ratio: ${ratio[0]} / ${ratio[1]};`,
    decimal: round4(decimal),
    nearest: { deviation: round4((decimal / reference - 1) * 100), label },
    paddingTop: round4((height / width) * 100),
    ratio,
  };
}

export function solveAspect(
  ratio: [number, number],
  known: { height?: number; width?: number },
): number {
  if (known.width !== undefined) return round4((known.width * ratio[1]) / ratio[0]);

  return round4(((known.height ?? 0) * ratio[0]) / ratio[1]);
}
