import { FunctionError } from '../errors';

export type ChmodSubject = 'owner' | 'group' | 'others';
export type ChmodPermissions = {
  execute: boolean;
  read: boolean;
  special: 'setuid' | 'setgid' | 'sticky' | null;
  symbolic: string;
  write: boolean;
};
export type ChmodResult = {
  compact: string;
  fullOctal: string;
  groups: Record<ChmodSubject, ChmodPermissions>;
  octal: string;
  special: { setgid: boolean; setuid: boolean; sticky: boolean };
  symbolic: Record<ChmodSubject, string>;
};

function permissions(digit: number, special: ChmodPermissions['special']): ChmodPermissions {
  const execute = (digit & 1) !== 0;
  const read = (digit & 4) !== 0;
  const write = (digit & 2) !== 0;

  return {
    execute,
    read,
    special,
    symbolic: `${read ? 'r' : '-'}${write ? 'w' : '-'}${executionSymbol(execute, special)}`,
    write,
  };
}

function executionSymbol(execute: boolean, special: ChmodPermissions['special']): string {
  if (special === 'sticky') return execute ? 't' : 'T';
  if (special !== null) return execute ? 's' : 'S';

  return execute ? 'x' : '-';
}

export function calculateChmod(value: string): ChmodResult {
  if (value.length > 64)
    throw new FunctionError('INVALID_DEV_INPUT', 'Octal input is limited to 64 UTF-16 units.');

  const input = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

  if (!/^0*[0-7]{1,4}$/.test(input))
    throw new FunctionError(
      'INVALID_DEV_INPUT',
      'Enter octal digits (0–7) for mode bits 0000–7777, such as 755, 000 or 4755; extra leading zeroes are accepted. Symbolic commands, signs, prefixes and file-type bits are not accepted.',
    );

  const fullOctal = input.replace(/^0+/, '').padStart(4, '0');
  const bits = Number(fullOctal[0]);
  const special = { setgid: (bits & 2) !== 0, setuid: (bits & 4) !== 0, sticky: (bits & 1) !== 0 };
  const groups = {
    group: permissions(Number(fullOctal[2]), special.setgid ? 'setgid' : null),
    others: permissions(Number(fullOctal[3]), special.sticky ? 'sticky' : null),
    owner: permissions(Number(fullOctal[1]), special.setuid ? 'setuid' : null),
  };
  const symbolic = {
    group: groups.group.symbolic,
    others: groups.others.symbolic,
    owner: groups.owner.symbolic,
  };

  return {
    compact: `${symbolic.owner}${symbolic.group}${symbolic.others}`,
    fullOctal,
    groups,
    octal: bits === 0 ? fullOctal.slice(1) : fullOctal,
    special,
    symbolic,
  };
}
