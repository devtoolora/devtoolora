import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { calculateChmod } from '../src/dev';

describe('chmod bit decoding', () => {
  it('decodes all ordinary masks including omitted leading digits and all zero bits', () => {
    const triplets = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];

    for (let mode = 0; mode <= 0o777; mode += 1) {
      const text = mode.toString(8);
      const padded = text.padStart(3, '0');
      const result = calculateChmod(text);

      assert.equal(result.octal, padded);
      assert.equal(result.fullOctal, `0${padded}`);
      assert.equal(result.compact, [...padded].map((digit) => triplets[Number(digit)]).join(''));
    }

    assert.equal(calculateChmod('000').compact, '---------');
    assert.equal(calculateChmod('0755').octal, '755');
    assert.equal(calculateChmod('000755').octal, '755');
    assert.equal(calculateChmod('0004755').fullOctal, '4755');
    assert.equal(calculateChmod('7').compact, '------rwx');
  });

  it('distinguishes special bits from execute permissions using s/S and t/T', () => {
    const cases: Array<[string, string]> = [
      ['4755', 'rwsr-xr-x'],
      ['4644', 'rwSr--r--'],
      ['2750', 'rwxr-s---'],
      ['2640', 'rw-r-S---'],
      ['1777', 'rwxrwxrwt'],
      ['1666', 'rw-rw-rwT'],
      ['7777', 'rwsrwsrwt'],
      ['7000', '--S--S--T'],
    ];

    for (const [input, symbolic] of cases) assert.equal(calculateChmod(input).compact, symbolic);
    const result = calculateChmod('4644');

    assert.deepEqual(result.special, { setgid: false, setuid: true, sticky: false });

    assert.deepEqual(result.groups.owner, {
      execute: false,
      read: true,
      special: 'setuid',
      symbolic: 'rwS',
      write: true,
    });
  });

  it('maps every one of the 4096 masks to independent ordinary and special flags', () => {
    for (let mode = 0; mode <= 0o7777; mode += 1) {
      const result = calculateChmod(mode.toString(8));

      assert.equal(result.fullOctal, mode.toString(8).padStart(4, '0'));
      assert.equal(result.groups.owner.read, (mode & 0o400) !== 0);
      assert.equal(result.groups.owner.write, (mode & 0o200) !== 0);
      assert.equal(result.groups.owner.execute, (mode & 0o100) !== 0);
      assert.equal(result.groups.group.read, (mode & 0o40) !== 0);
      assert.equal(result.groups.group.write, (mode & 0o20) !== 0);
      assert.equal(result.groups.group.execute, (mode & 0o10) !== 0);
      assert.equal(result.groups.others.read, (mode & 0o4) !== 0);
      assert.equal(result.groups.others.write, (mode & 0o2) !== 0);
      assert.equal(result.groups.others.execute, (mode & 0o1) !== 0);
      assert.equal(result.special.setuid, (mode & 0o4000) !== 0);
      assert.equal(result.special.setgid, (mode & 0o2000) !== 0);
      assert.equal(result.special.sticky, (mode & 0o1000) !== 0);
      assert.equal(result.compact.length, 9);
    }
  });

  it('rejects invalid syntax, file-type masks, controls and excess length without coercion', () => {
    for (const input of [
      '',
      '8',
      '999',
      '-755',
      '+755',
      '0o755',
      '0x755',
      '100755',
      '017777',
      'u+x',
      'rwxr-xr-x',
      'chmod 755 file',
      '755junk',
      '7 55',
      '755\u0000',
      '755\u2028',
      '\u00A0755',
    ])
      assert.throws(() => calculateChmod(input), /octal digits/);
    assert.equal(calculateChmod(`${' '.repeat(61)}755`).octal, '755');
    assert.throws(() => calculateChmod(`${' '.repeat(62)}755`), /64 UTF-16/);
    assert.equal(calculateChmod(' \t0755\r\n').fullOctal, '0755');
  });
});
