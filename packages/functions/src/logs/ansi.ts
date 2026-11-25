import { checkLogInput } from './shared';

type ScanState = 'csi' | 'escape' | 'other' | 'osc' | 'oscEscape' | 'text';

interface Style {
  bg: string | null;
  bold: boolean;
  dim: boolean;
  fg: string | null;
  inverse: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
}

const ESC = 27;
const BEL = 7;
const C1_CSI = 0x9b;
const C1_OSC = 0x9d;
const C1_ST = 0x9c;
// DCS, SOS, PM and APC carry a payload up to a terminator, as OSC does.
const STRING_ESCAPES = new Set([0x50, 0x58, 0x5d, 0x5e, 0x5f]);
const C1_STRINGS = new Set([0x90, 0x98, C1_OSC, 0x9e, 0x9f]);
const NEWLINE = 10;

const baseColors = [
  '#000000',
  '#cd0000',
  '#00cd00',
  '#cdcd00',
  '#0000ee',
  '#cd00cd',
  '#00cdcd',
  '#e5e5e5',
  '#7f7f7f',
  '#ff0000',
  '#00ff00',
  '#ffff00',
  '#5c5cff',
  '#ff00ff',
  '#00ffff',
  '#ffffff',
];
const cubeLevels = [0, 95, 135, 175, 215, 255];

const hex = (value: number): string => value.toString(16).padStart(2, '0');
const rgb = (r: number, g: number, b: number): string => `#${hex(r)}${hex(g)}${hex(b)}`;

const ansiPalette: string[] = [...baseColors];

for (let index = 0; index < 216; index += 1) {
  ansiPalette.push(
    rgb(
      cubeLevels[Math.floor(index / 36)] ?? 0,
      cubeLevels[Math.floor(index / 6) % 6] ?? 0,
      cubeLevels[index % 6] ?? 0,
    ),
  );
}

for (let index = 0; index < 24; index += 1) {
  const level = 8 + 10 * index;

  ansiPalette.push(rgb(level, level, level));
}

const emptyStyle = (): Style => ({
  bg: null,
  bold: false,
  dim: false,
  fg: null,
  inverse: false,
  italic: false,
  strike: false,
  underline: false,
});

const inRange = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value >= 0 && value <= 255;

function applyExtendedColor(style: Style, params: number[], at: number): number {
  const target = params[at] === 38 ? 'fg' : 'bg';
  const kind = params[at + 1];

  if (kind === 5) {
    const index = params[at + 2];

    if (inRange(index)) style[target] = ansiPalette[index] ?? null;

    return 3;
  }

  if (kind === 2) {
    const [r, g, b] = params.slice(at + 2, at + 5);

    if (inRange(r) && inRange(g) && inRange(b)) style[target] = rgb(r, g, b);

    return 5;
  }

  // Unknown kind (e.g. 38;7): only the 38/48 is skipped, the next parameter is read on its own.
  return 1;
}

function applyAttribute(style: Style, code: number): void {
  if (code === 1) style.bold = true;
  else if (code === 2) style.dim = true;
  else if (code === 3) style.italic = true;
  else if (code === 4) style.underline = true;
  else if (code === 7) style.inverse = true;
  else if (code === 9) style.strike = true;
  else if (code === 22) {
    style.bold = false;
    style.dim = false;
  } else if (code === 23) style.italic = false;
  else if (code === 24) style.underline = false;
  else if (code === 27) style.inverse = false;
  else if (code === 29) style.strike = false;
  else if (code === 39) style.fg = null;
  else if (code === 49) style.bg = null;
}

function applyCode(style: Style, code: number): void {
  if (code >= 30 && code <= 37) style.fg = ansiPalette[code - 30] ?? null;
  else if (code >= 90 && code <= 97) style.fg = ansiPalette[code - 90 + 8] ?? null;
  else if (code >= 40 && code <= 47) style.bg = ansiPalette[code - 40] ?? null;
  else if (code >= 100 && code <= 107) style.bg = ansiPalette[code - 100 + 8] ?? null;
  else applyAttribute(style, code);
}

function applySgr(style: Style, params: number[]): void {
  let at = 0;

  while (at < params.length) {
    const code = params[at] ?? 0;

    if (code === 0) Object.assign(style, emptyStyle());
    else if (code === 38 || code === 48) {
      at += applyExtendedColor(style, params, at);

      continue;
    } else applyCode(style, code);

    at += 1;
  }
}

function styleOf(style: Style): string {
  const parts: string[] = [];
  const color = style.inverse ? (style.bg ?? '#ffffff') : style.fg;
  const background = style.inverse ? (style.fg ?? '#000000') : style.bg;

  if (color) parts.push(`color:${color}`);

  if (background) parts.push(`background:${background}`);

  if (style.bold) parts.push('font-weight:bold');

  if (style.italic) parts.push('font-style:italic');

  if (style.underline || style.strike) {
    parts.push(
      `text-decoration:${[style.underline ? 'underline' : '', style.strike ? 'line-through' : '']
        .filter(Boolean)
        .join(' ')}`,
    );
  }

  if (style.dim && !style.bold) parts.push('opacity:0.6');

  return parts.join(';');
}

/** Rewrites an ITU T.416 colon group such as 38:2::r:g:b to its semicolon form. */
function parseColonGroup(part: string): number[] {
  const [head = '', kind, ...rest] = part.split(':');

  if ((head === '38' || head === '48') && kind === '2')
    return [Number(head), 2, ...rest.slice(-3).map(Number)];

  return (head === '38' || head === '48') && kind === '5'
    ? [Number(head), 5, Number(rest[0])]
    : [Number(head)];
}

const parseParams = (raw: string): number[] =>
  raw === '' ? [0] : raw.split(';').flatMap((part) => (part === '' ? [0] : parseColonGroup(part)));

interface Scan {
  paramStart: number;
  removed: number;
  state: ScanState;
  textStart: number;
}

function endSequence(scan: Scan, index: number, consume: boolean): boolean {
  scan.removed += 1;
  scan.state = 'text';
  scan.textStart = consume ? index + 1 : index;

  return !consume;
}

function stepText(scan: Scan, text: string, index: number, onText: (chunk: string) => void): void {
  const code = text.charCodeAt(index);

  if (code !== ESC && code !== C1_CSI && !C1_STRINGS.has(code)) return;

  if (index > scan.textStart) onText(text.slice(scan.textStart, index));

  scan.paramStart = index + 1;

  if (code === ESC) scan.state = 'escape';
  else scan.state = code === C1_CSI ? 'csi' : 'osc';
}

function stepEscape(scan: Scan, code: number, index: number): boolean {
  if (code === 0x5b) scan.state = 'csi';
  else if (STRING_ESCAPES.has(code)) scan.state = 'osc';
  else if (code >= 0x20 && code <= 0x2f) scan.state = 'other';
  else return endSequence(scan, index, code !== NEWLINE && code !== ESC);

  scan.paramStart = index + 1;

  return false;
}

function stepCsi(
  scan: Scan,
  text: string,
  index: number,
  onSgr: (params: number[]) => void,
): boolean {
  const code = text.charCodeAt(index);

  if (code >= 0x20 && code <= 0x3f) return false;

  const final = code >= 0x40 && code <= 0x7e;

  if (final && code === 0x6d) onSgr(parseParams(text.slice(scan.paramStart, index)));

  return endSequence(scan, index, final);
}

function stepOsc(scan: Scan, code: number, index: number): boolean {
  if (code === ESC) scan.state = 'oscEscape';
  else if (code === BEL || code === C1_ST) return endSequence(scan, index, true);
  else if (code === NEWLINE) return endSequence(scan, index, false);

  return false;
}

/** ESC inside an OSC ends it; anything but a backslash after it starts a new sequence. */
function stepOscEscape(scan: Scan, code: number, index: number): boolean {
  if (code === 0x5c || code === NEWLINE) return endSequence(scan, index, code === 0x5c);

  scan.removed += 1;
  scan.state = 'escape';

  return stepEscape(scan, code, index);
}

function scanAnsi(
  text: string,
  onText: (chunk: string) => void,
  onSgr: (params: number[]) => void,
): number {
  const scan: Scan = { paramStart: 0, removed: 0, state: 'text', textStart: 0 };

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    let again = false;

    if (scan.state === 'text') stepText(scan, text, index, onText);
    else if (scan.state === 'escape') again = stepEscape(scan, code, index);
    else if (scan.state === 'other')
      again = endSequence(scan, index, code !== NEWLINE && code !== ESC);
    else if (scan.state === 'csi') again = stepCsi(scan, text, index, onSgr);
    else if (scan.state === 'osc') again = stepOsc(scan, code, index);
    else again = stepOscEscape(scan, code, index);

    if (again) index -= 1;
  }

  if (scan.state !== 'text') scan.removed += 1;
  else if (text.length > scan.textStart) onText(text.slice(scan.textStart));

  return scan.removed;
}

export function stripAnsi(text: string): { removed: number; text: string } {
  checkLogInput(text);

  const chunks: string[] = [];
  const removed = scanAnsi(
    text,
    (chunk) => chunks.push(chunk),
    () => undefined,
  );

  return { removed, text: chunks.join('') };
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function ansiToHtml(text: string): { spans: number; text: string } {
  checkLogInput(text);

  const style = emptyStyle();
  const out: string[] = [];
  let open = '';
  let spans = 0;

  scanAnsi(
    text,
    (chunk) => {
      const current = styleOf(style);

      if (current !== open) {
        if (open) out.push('</span>');

        if (current) {
          out.push(`<span style="${current}">`);
          spans += 1;
        }

        open = current;
      }

      out.push(escapeHtml(chunk));
    },
    (params) => applySgr(style, params),
  );

  if (open) out.push('</span>');

  return { spans, text: `<pre class="ansi">${out.join('')}</pre>` };
}
