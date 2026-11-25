import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

// @ts-expect-error plain .mjs script without type declarations
import { summarizeRuns } from '../../scripts/lighthouse/summary.mjs';

interface Audit {
  displayValue?: string;
  score: number | null;
  scoreDisplayMode: string;
}

function report(performance: number, audits: Record<string, Audit> = {}) {
  return {
    audits,
    categories: {
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      performance: { score: performance },
      seo: { score: 1 },
    },
  };
}

describe('lighthouse summary', () => {
  it('takes the median of each category', () => {
    const { categories } = summarizeRuns([report(0.47), report(0.9), report(0.38)]);

    assert.deepEqual(categories, {
      accessibility: 100,
      'best-practices': 100,
      performance: 47,
      seo: 100,
    });
  });

  it('lists failing audits from the median performance run', () => {
    const medianAudits: Record<string, Audit> = {
      fine: { score: 1, scoreDisplayMode: 'binary' },
      lcp: { displayValue: '3.1 s', score: 0.4, scoreDisplayMode: 'numeric' },
      manual: { score: 0, scoreDisplayMode: 'manual' },
      na: { score: 0, scoreDisplayMode: 'notApplicable' },
      info: { score: 0, scoreDisplayMode: 'informative' },
    };
    const otherAudits: Record<string, Audit> = {
      other: { score: 0, scoreDisplayMode: 'binary' },
    };
    const { failingAudits } = summarizeRuns([
      report(0.9, otherAudits),
      report(0.47, medianAudits),
      report(0.38, otherAudits),
    ]);

    assert.deepEqual(failingAudits, [{ displayValue: '3.1 s', id: 'lcp', score: 0.4 }]);
  });
});
