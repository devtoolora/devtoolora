import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

type Suppressions = Record<string, Record<string, { count: number }>>;

// Every long function is split; a new one must be split too, not suppressed.
const BASELINE: Record<string, number> = {
  'max-depth': 0,
  'max-lines-per-function': 0,
};

const suppressions = JSON.parse(
  readFileSync(join(process.cwd(), 'eslint-suppressions.json'), 'utf8'),
) as Suppressions;

function totalsByRule(): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const rules of Object.values(suppressions)) {
    for (const [rule, { count }] of Object.entries(rules)) {
      totals[rule] = (totals[rule] ?? 0) + count;
    }
  }

  return totals;
}

describe('lint suppressions', () => {
  it('only suppresses function length and depth', () => {
    for (const rule of Object.keys(totalsByRule())) {
      assert.ok(rule in BASELINE, `unexpected suppressed rule: ${rule}`);
    }
  });

  it('does not grow past the baseline', () => {
    for (const [rule, total] of Object.entries(totalsByRule())) {
      assert.ok(
        total <= (BASELINE[rule] ?? 0),
        `${rule}: ${total} suppressions > ${BASELINE[rule]}`,
      );
    }
  });
});
