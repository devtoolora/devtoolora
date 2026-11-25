import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';

// @ts-expect-error The script is plain .mjs without type declarations.
import { findFunctionsOverCeiling } from '../../scripts/check-function-ceiling.mjs';

interface Finding {
  file: string;
  line: number;
  lines: number;
  message: string;
}

const find = findFunctionsOverCeiling as (patterns: string[], cwd?: string) => Promise<Finding[]>;

describe('function ceiling', () => {
  it('reports a 101-line function and ignores the suppressions file', async () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'function-ceiling-'));

    try {
      const body = Array.from({ length: 97 }, (_, index) => `  total += ${index};`).join('\n');

      writeFileSync(
        join(fixtureDir, 'a.ts'),
        `export function big(): number {\n  let total = 0;\n${body}\n\n  return total;\n}\n`,
      );

      writeFileSync(
        join(fixtureDir, 'eslint-suppressions.json'),
        JSON.stringify({ 'a.ts': { 'max-lines-per-function': { count: 1 } } }),
      );

      const found = await find(['a.ts'], fixtureDir);

      assert.equal(found.length, 1);
      assert.equal(found[0]!.lines, 101);
      assert.match(found[0]!.message, /'big'/);
    } finally {
      rmSync(fixtureDir, { force: true, recursive: true });
    }
  });

  it('reports a 101-line function behind an inline eslint-disable comment', async () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'function-ceiling-'));

    try {
      const body = Array.from({ length: 97 }, (_, index) => `  total += ${index};`).join('\n');

      writeFileSync(
        join(fixtureDir, 'a.ts'),
        `/* eslint-disable */\n// eslint-disable-next-line max-lines-per-function\nexport function big(): number {\n  let total = 0;\n${body}\n\n  return total;\n}\n`,
      );

      const found = await find(['a.ts'], fixtureDir);

      assert.equal(found.length, 1);
      assert.equal(found[0]!.lines, 101);
    } finally {
      rmSync(fixtureDir, { force: true, recursive: true });
    }
  });

  it('passes on the repo', { timeout: 240_000 }, async () => {
    assert.deepEqual(await find(['.']), []);
  });
});
