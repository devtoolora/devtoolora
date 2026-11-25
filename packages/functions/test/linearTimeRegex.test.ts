import { describe, it } from 'vitest';
import { parseCssColor } from '@devtoolora/functions/color';
import { decodeCsr, parseArgon2Salt } from '@devtoolora/functions/crypto';
import { calculateBitwise } from '@devtoolora/functions/dev';
import { parseProperties, plistToJson } from '@devtoolora/functions/format';
import { describeNumbers } from '@devtoolora/functions/math';
import { markdownToPdf } from '@devtoolora/functions/pdf';
import { cleanWhitespace, deduplicateLinesDetailed, sortLines } from '@devtoolora/functions/text';
import { parseHttpHeaders, parseRfc5322Date } from '@devtoolora/functions/web';
import { assertLinear, assertLinearAsync } from './fixtures/linearTime';

// Large enough that a quadratic regex blows the budget, small enough that the red run ends quickly.
const n = 20_000;

describe('regexes stay linear on hostile input', () => {
  it('parses headers that end in many line breaks', () => {
    assertLinear(() => parseHttpHeaders('HTTP/1.1 200 OK\r\nA: b' + '\r\n'.repeat(22) + 'x'));
  });

  it('reads an argon2 salt with a long padding run', () => {
    assertLinear(() => parseArgon2Salt('='.repeat(n) + 'x'));
  });

  it('parses properties with a long backslash run', () => {
    assertLinear(() => parseProperties(`a=${'\\'.repeat(n)}x`));
  });

  it('trims a line with a long whitespace run', () => {
    assertLinear(() => cleanWhitespace(`a${' \t'.repeat(n)}x`));
    assertLinear(() => deduplicateLinesDetailed(`a${' \t'.repeat(n)}x`, { trimComparison: true }));
    assertLinear(() => sortLines(`a${' \t'.repeat(n)}x`, { trimComparison: true }));
  });

  it('strips comments from a date full of open parentheses', () => {
    assertLinear(() => parseRfc5322Date('('.repeat(n)));
  });

  it('reads long digit runs as numbers', () => {
    assertLinear(() => describeNumbers(`${'1'.repeat(n)}x`));
    assertLinear(() => parseCssColor(`rgb(${'1'.repeat(n)}x 0 0)`));
    assertLinear(() => plistToJson(`<plist><real>${'1'.repeat(n)}x</real></plist>`));
  });

  it('finds PEM blocks when no block ever ends', async () => {
    await assertLinearAsync(async () => decodeCsr('-----BEGIN A-----'.repeat(10_000)));
  });

  it('finds PEM blocks when every block has its own label and never ends', async () => {
    const labels = Array.from({ length: 10_000 }, (_, index) => `-----BEGIN ${index}-----`);

    await assertLinearAsync(async () => decodeCsr(labels.join('')));
  });

  it('trims a bitwise operand with a long inner space run', () => {
    assertLinear(() =>
      calculateBitwise({ a: `1${' '.repeat(n)}1`, b: '1', operation: 'add', width: 32 }),
    );
  });

  it('reads a Markdown heading with a long space run', async () => {
    await markdownToPdf('warm-up');
    await assertLinearAsync(() => markdownToPdf(`# a${' '.repeat(n)}x`), 1_000);
  });
});
