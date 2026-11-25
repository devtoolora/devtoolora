import { FunctionError } from '../errors';
import { formatCssColor, namedColors, parseCssColor } from './cssColor';
import { linearToOklab, round, toLinear, type Vector } from './cssColorSpace';

export type NamedColorMatch = { deltaE: number; hex: string; name: string };
export type ColorNameLookup =
  | { alphaIgnored: boolean; exact: NamedColorMatch[]; kind: 'color'; nearest: NamedColorMatch[] }
  | { kind: 'name'; matches: NamedColorMatch[] };

const nearestCount = 5;

function hexToOklab(hex: string): Vector {
  const channel = (start: number) => toLinear(parseInt(hex.slice(start, start + 2), 16) / 255);

  return linearToOklab([channel(0), channel(2), channel(4)]);
}

function distance(a: Vector, b: Vector): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
}

function lookupName(fragment: string): ColorNameLookup {
  const needle = fragment.toLowerCase().replace(/[\s-]/g, '');
  const matches = [...namedColors]
    .filter(([name]) => needle !== '' && name.includes(needle))
    .map(([name, hex]) => ({ deltaE: 0, hex: `#${hex}`, name }));

  if (matches.length === 0)
    throw new FunctionError('NO_COLOR_NAME', `No CSS named color contains "${fragment.trim()}".`);

  return { kind: 'name', matches };
}

export function lookupColorNames(input: string): ColorNameLookup {
  const text = input.trim();
  const keyword = text.toLowerCase();

  if (keyword === 'transparent')
    throw new FunctionError(
      'INVALID_COLOR',
      'transparent is not in the 148 CSS named colors because it has no color of its own.',
    );
  if (keyword === 'currentcolor')
    throw new FunctionError(
      'INVALID_COLOR',
      'currentColor is not in the 148 CSS named colors because it depends on where it is used.',
    );

  // Letters that are valid bare hex, such as "cad", may also be the promised name fragment.
  if (/^[a-f]+$/.test(keyword) && [...namedColors.keys()].some((name) => name.includes(keyword)))
    return lookupName(text);

  let color;

  try {
    color = parseCssColor(text);
  } catch (error) {
    if (/^[a-z\s-]+$/i.test(text)) return lookupName(text);

    throw error;
  }

  const target = hexToOklab(formatCssColor(color).hex.slice(1));
  const all = [...namedColors]
    .map(([name, hex]) => ({
      deltaE: round(distance(target, hexToOklab(hex)), 1),
      exactDistance: distance(target, hexToOklab(hex)),
      hex: `#${hex}`,
      name,
    }))
    .sort((a, b) => a.exactDistance - b.exactDistance || a.name.localeCompare(b.name));
  const strip = ({ deltaE, hex, name }: (typeof all)[number]): NamedColorMatch => ({
    deltaE,
    hex,
    name,
  });
  const isExact = (entry: (typeof all)[number]) => entry.exactDistance < 1e-6;

  return {
    alphaIgnored: color.alpha < 1,
    exact: all.filter(isExact).map(strip),
    kind: 'color',
    nearest: all
      .filter((entry) => !isExact(entry))
      .slice(0, nearestCount)
      .map(strip),
  };
}
