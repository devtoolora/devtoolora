import { imageError } from './formats';

export type Annotation =
  | { kind: 'text' | 'label'; message: string; x: number; y: number }
  | { height: number; kind: 'highlight' | 'rect' | 'redact'; width: number; x: number; y: number }
  | { kind: 'arrow'; x1: number; x2: number; y1: number; y2: number }
  | { kind: 'circle'; r: number; x: number; y: number };

const maxCommands = 200;
const maxMessage = 500;
const maxCoordinate = 100_000;
const numberPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const maxEcho = 40;
const boxKinds = ['rect', 'highlight', 'redact'] as const;

export function parseAnnotations(text: string): Annotation[] {
  const commands: Annotation[] = [];

  text.split(/\r\n|\r|\n/).forEach((raw, index) => {
    const line = raw.trim();

    if (!line || line.startsWith('#')) return;

    if (commands.length === maxCommands)
      throw imageError(`Line ${index + 1}: at most ${maxCommands} commands are allowed.`);

    commands.push(parseLine(line, index + 1));
  });

  return commands;
}

function parseLine(line: string, number: number): Annotation {
  const fail = (message: string) => imageError(`Line ${number}: ${message}`);
  const [word = ''] = line.split(/\s+/, 1);
  const kind = word.toLowerCase();
  const rest = line.slice(word.length).trim();

  if (kind === 'text' || kind === 'label') {
    const match = /^(\S+)\s+(\S+)\s+(.+)$/s.exec(rest);

    if (!match) throw fail(`${kind} needs X, Y and a message.`);

    const message = (match[3] ?? '').trim();

    if ([...message].length > maxMessage)
      throw fail(`the message is longer than ${maxMessage} characters.`);

    return {
      kind,
      message,
      x: coordinate(match[1] ?? '', fail),
      y: coordinate(match[2] ?? '', fail),
    };
  }

  const count = kind === 'circle' ? 3 : 4;

  if (!['arrow', 'circle', ...boxKinds].includes(kind))
    throw fail(
      `unknown command "${echo(word)}". Use text, label, rect, highlight, redact, arrow or circle.`,
    );

  const tokens = rest ? rest.split(/\s+/) : [];

  if (tokens.length !== count) throw fail(`${kind} needs ${count} numbers: ${usage[kind]}.`);

  const [a = 0, b = 0, c = 0, d = 0] = tokens.map((token) => coordinate(token, fail));

  if (kind === 'arrow') {
    if (a === c && b === d) throw fail('the arrow starts and ends at the same point.');

    return { kind, x1: a, x2: c, y1: b, y2: d };
  }

  if (kind === 'circle') {
    if (c <= 0) throw fail('R must be above 0.');

    return { kind, r: c, x: a, y: b };
  }

  if (c <= 0 || d <= 0) throw fail('W and H must be above 0.');

  return { height: d, kind: kind as (typeof boxKinds)[number], width: c, x: a, y: b };
}

const usage: Record<string, string> = {
  arrow: 'X1 Y1 X2 Y2',
  circle: 'CX CY R',
  highlight: 'X Y W H',
  rect: 'X Y W H',
  redact: 'X Y W H',
};

function coordinate(token: string, fail: (message: string) => Error): number {
  const value = Number(token);

  if (!numberPattern.test(token)) throw fail(`"${echo(token)}" is not a number.`);
  if (Math.abs(value) > maxCoordinate)
    throw fail(
      `numbers must be between -${maxCoordinate.toLocaleString('en-US')} and ${maxCoordinate.toLocaleString('en-US')}.`,
    );

  return value;
}

function echo(token: string): string {
  return token.length > maxEcho ? `${token.slice(0, maxEcho)}…` : token;
}
