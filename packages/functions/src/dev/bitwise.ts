import { devError } from './shared';

export type BitwiseOperation =
  | 'add'
  | 'and'
  | 'mul'
  | 'nand'
  | 'nor'
  | 'not'
  | 'or'
  | 'rol'
  | 'ror'
  | 'sar'
  | 'sdiv'
  | 'shl'
  | 'shr'
  | 'srem'
  | 'sub'
  | 'udiv'
  | 'urem'
  | 'xnor'
  | 'xor';

export type BitwiseWidth = 8 | 16 | 32 | 64;

export type BitwiseValue = {
  binary: string;
  hex: string;
  signed: string;
  unsigned: string;
};

type BitwiseOptions = {
  a: string;
  b: string;
  operation: BitwiseOperation;
  width: BitwiseWidth;
};

type BitwiseResult = {
  flags?: { carry?: boolean; overflow: boolean };
  result: BitwiseValue;
  setBits: number[];
  text: string;
};

const maxInputLength = 256;
const digits = (pattern: string) => `${pattern}+(?:_${pattern}+)*`;
const numberPattern = new RegExp(
  `^(-)?(?:0x(${digits('[0-9a-f]')})|0b(${digits('[01]')})|0o(${digits('[0-7]')})|(${digits('[0-9]')}))$`,
  'i',
);
const titles: Record<BitwiseOperation, string> = {
  add: 'A + B',
  and: 'A AND B',
  mul: 'A * B',
  nand: 'A NAND B',
  nor: 'A NOR B',
  not: 'NOT A',
  or: 'A OR B',
  rol: 'A ROL n',
  ror: 'A ROR n',
  sar: 'A >> n',
  sdiv: 'A / B (signed)',
  shl: 'A << n',
  shr: 'A >>> n',
  srem: 'A % B (signed)',
  sub: 'A - B',
  udiv: 'A / B (unsigned)',
  urem: 'A % B (unsigned)',
  xnor: 'A XNOR B',
  xor: 'A XOR B',
};
const shiftOperations: BitwiseOperation[] = ['rol', 'ror', 'sar', 'shl', 'shr'];
const arithmeticOperations: BitwiseOperation[] = [
  'add',
  'mul',
  'sdiv',
  'srem',
  'sub',
  'udiv',
  'urem',
];

function parseInteger(label: string, source: string): bigint {
  const value = source.replace(/^[ \t\r\n]+/, '').replace(/(?<![ \t\r\n])[ \t\r\n]+$/, '');

  if (value === '') throw devError(`Enter ${label}.`);

  if (value.length > maxInputLength)
    throw devError(`${label} must be at most ${maxInputLength} characters.`);

  const match = numberPattern.exec(value);

  if (!match) throw devError(`${label} is not a number: use decimal, 0x, 0b or 0o.`);

  const [, sign, hex, binary, octal, decimal] = match;
  const [prefix, body] = [
    ['0x', hex],
    ['0b', binary],
    ['0o', octal],
    ['', decimal],
  ].find(([, part]) => part !== undefined) ?? ['', ''];
  const parsed = BigInt(prefix + (body ?? '').replaceAll('_', ''));

  return sign ? -parsed : parsed;
}

function parseOperand(label: string, source: string, width: BitwiseWidth): bigint {
  const value = parseInteger(label, source);
  const min = -(1n << BigInt(width - 1));
  const max = (1n << BigInt(width)) - 1n;

  if (value < min || value > max)
    throw devError(`${label} must fit ${width} bits: ${min} to ${max}.`);

  return BigInt.asUintN(width, value);
}

function describeValue(value: bigint, width: BitwiseWidth): BitwiseValue {
  const binary = value.toString(2).padStart(width, '0');

  return {
    binary: binary.replace(/(.{4})(?=.)/g, '$1 '),
    hex: `0x${value
      .toString(16)
      .toUpperCase()
      .padStart(width / 4, '0')}`,
    signed: BigInt.asIntN(width, value).toString(),
    unsigned: value.toString(),
  };
}

function block(label: string, value: BitwiseValue): string {
  const rows: [string, string][] = [
    ['hex', value.hex],
    ['unsigned', value.unsigned],
    ['signed', value.signed],
    ['binary', value.binary],
  ];

  return [label, ...rows.map(([name, row]) => `  ${name.padEnd(10)}${row}`)].join('\n');
}

function shift(operation: BitwiseOperation, a: bigint, amount: bigint, width: BitwiseWidth) {
  const bits = BigInt(width);

  if (operation === 'shl') return a << amount;

  if (operation === 'shr') return a >> amount;

  if (operation === 'sar') return BigInt.asIntN(width, a) >> amount;

  return operation === 'rol'
    ? (a << amount) | (a >> (bits - amount))
    : (a >> amount) | (a << (bits - amount));
}

function combine(operation: BitwiseOperation, a: bigint, b: bigint): bigint {
  if (operation === 'and' || operation === 'nand') return a & b;

  if (operation === 'or' || operation === 'nor') return a | b;

  if (operation === 'xor' || operation === 'xnor') return a ^ b;

  return a;
}

type Arithmetic = { flags?: BitwiseResult['flags']; value: bigint };

function arithmetic(
  operation: BitwiseOperation,
  a: bigint,
  b: bigint,
  width: BitwiseWidth,
): Arithmetic {
  const [sa, sb] = [BigInt.asIntN(width, a), BigInt.asIntN(width, b)];
  const wrapped = (exact: bigint, signedExact: bigint, carry: boolean) => ({
    flags: { carry, overflow: BigInt.asIntN(width, signedExact) !== signedExact },
    value: exact,
  });

  if (operation === 'add') return wrapped(a + b, sa + sb, (a + b) >> BigInt(width) > 0n);

  if (operation === 'sub') return wrapped(a - b, sa - sb, a < b);

  if (operation === 'mul') return wrapped(a * b, sa * sb, (a * b) >> BigInt(width) > 0n);

  if (b === 0n) throw devError('Division by zero.');

  if (operation === 'udiv') return { value: a / b };

  if (operation === 'urem') return { value: a % b };

  if (operation === 'srem') return { value: sa % sb };

  return { flags: { overflow: BigInt.asIntN(width, sa / sb) !== sa / sb }, value: sa / sb };
}

export function calculateBitwise({ a, b, operation, width }: BitwiseOptions): BitwiseResult {
  const left = parseOperand('A', a, width);
  const shifting = shiftOperations.includes(operation);
  const arithmetical = arithmeticOperations.includes(operation);
  const twoOperands = !shifting && operation !== 'not';
  let amount = 0n;
  let right = 0n;

  if (shifting) {
    amount = parseInteger('B', b);

    if (amount < 0n || amount > BigInt(width)) throw devError(`Shift amount must be 0-${width}.`);
  } else if (twoOperands) {
    right = parseOperand('B', b, width);
  }

  const math = arithmetical ? arithmetic(operation, left, right, width) : undefined;
  const raw =
    math?.value ??
    (shifting ? shift(operation, left, amount, width) : combine(operation, left, right));
  const negated =
    operation === 'nand' || operation === 'nor' || operation === 'xnor' || operation === 'not';
  const value = BigInt.asUintN(width, negated ? ~raw : raw);
  const result = describeValue(value, width);
  const setBits = [...Array(width).keys()].filter(
    (index) => ((value >> BigInt(index)) & 1n) === 1n,
  );
  const title = titles[operation].replace(/ n$/, ` ${amount}`);
  const blocks = [block('A', describeValue(left, width))];

  if (twoOperands) blocks.push(block('B', describeValue(right, width)));

  blocks.push(block('Result', result));

  const bits = setBits.length
    ? setBits.map((index) => `${index} (${1n << BigInt(index)})`).join(', ')
    : 'none';

  const { flags } = math ?? {};
  const flagLine = flags
    ? `Flags: ${[
        ...(flags.carry === undefined ? [] : [`carry ${flags.carry ? 'yes' : 'no'}`]),
        `overflow ${flags.overflow ? 'yes' : 'no'}`,
      ].join(', ')}\n`
    : '';

  return {
    ...(flags && { flags }),
    result,
    setBits,
    text: `${title} (${width}-bit)\n\n${blocks.join('\n\n')}\n\nSet bits: ${bits}\n${flagLine}`,
  };
}
