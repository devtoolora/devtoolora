import { FunctionError } from '../errors';

export type LineEndingOptions = {
  bom: 'add' | 'keep' | 'remove';
  ending: 'cr' | 'crlf' | 'keep' | 'lf';
};
export type LineEndingResult = {
  counts: { cr: number; crlf: number; lf: number };
  hadBom: boolean;
  mixed: boolean;
  text: string;
};

const maxUnits = 1_000_000;
const bom = '\uFEFF';
const terminators: Record<Exclude<LineEndingOptions['ending'], 'keep'>, string> = {
  cr: '\r',
  crlf: '\r\n',
  lf: '\n',
};

export function convertLineEndings(text: string, options: LineEndingOptions): LineEndingResult {
  if (text.length > maxUnits)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 1,000,000 UTF-16 units.');

  const hadBom = text.startsWith(bom);
  const body = hadBom ? text.slice(1) : text;
  const counts = { cr: 0, crlf: 0, lf: 0 };

  for (const match of body.matchAll(/\r\n|\r|\n/g)) {
    if (match[0] === '\r\n') counts.crlf += 1;
    else if (match[0] === '\r') counts.cr += 1;
    else counts.lf += 1;
  }

  const converted =
    options.ending === 'keep' ? body : body.replace(/\r\n|\r|\n/g, terminators[options.ending]);
  const withBom = options.bom === 'keep' ? hadBom : options.bom === 'add';

  return {
    counts,
    hadBom,
    mixed: Object.values(counts).filter((count) => count > 0).length > 1,
    text: withBom ? `${bom}${converted}` : converted,
  };
}
