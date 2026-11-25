import assert from 'node:assert/strict';

/** Fails when one call takes longer than the budget; errors from `run` are ignored. */
export function assertLinear(run: () => unknown, budgetMs = 250): void {
  const start = performance.now();

  try {
    run();
  } catch {
    // Only the time matters here.
  }

  const elapsed = performance.now() - start;

  assert.ok(elapsed < budgetMs, `took ${Math.round(elapsed)} ms, budget ${budgetMs} ms`);
}

export async function assertLinearAsync(
  run: () => Promise<unknown>,
  budgetMs = 250,
): Promise<void> {
  const start = performance.now();

  await run().catch(() => undefined);

  const elapsed = performance.now() - start;

  assert.ok(elapsed < budgetMs, `took ${Math.round(elapsed)} ms, budget ${budgetMs} ms`);
}
