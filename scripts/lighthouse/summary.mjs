const CATEGORY_IDS = ['accessibility', 'best-practices', 'performance', 'seo'];
const SKIPPED_MODES = new Set(['informative', 'manual', 'notApplicable']);

function categoryScore(report, id) {
  return report.categories[id].score;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function medianPerformanceRun(reports) {
  const target = median(reports.map((report) => categoryScore(report, 'performance')));

  return reports.find((report) => categoryScore(report, 'performance') === target);
}

function failingAuditsOf(report) {
  return Object.entries(report.audits)
    .filter(
      ([, audit]) =>
        typeof audit.score === 'number' &&
        audit.score < 1 &&
        !SKIPPED_MODES.has(audit.scoreDisplayMode),
    )
    .map(([id, audit]) => ({ displayValue: audit.displayValue, id, score: audit.score }));
}

export function summarizeRuns(reports) {
  const categories = Object.fromEntries(
    CATEGORY_IDS.map((id) => [
      id,
      Math.round(median(reports.map((report) => categoryScore(report, id))) * 100),
    ]),
  );

  return { categories, failingAudits: failingAuditsOf(medianPerformanceRun(reports)) };
}
