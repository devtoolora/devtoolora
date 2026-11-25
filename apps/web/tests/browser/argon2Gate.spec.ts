import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, test } from './fixtures';

const MAX_MEDIAN_MS = 3000;
const RUNS = 5;

const workerSource = `
import { argon2id } from '/__gate/noble/argon2.js';

const durations = [];
for (let run = 0; run < ${RUNS}; run += 1) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const start = performance.now();
  argon2id('password', salt, { m: 19456, t: 2, p: 1, dkLen: 32 });
  durations.push(performance.now() - start);
}
postMessage(durations);
`;

// @noble/hashes is a dependency of the functions workspace, not of apps/web.
const functionsRequire = createRequire(join(process.cwd(), 'packages/functions/package.json'));
const nobleDir = dirname(functionsRequire.resolve('@noble/hashes/argon2.js'));

test('Argon2 timing gate @gate', async ({ browser, browserName, page }) => {
  test.setTimeout(120_000);

  await page.route('**/__gate/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const contentType = 'text/javascript';

    if (pathname === '/__gate/worker.js') {
      await route.fulfill({ body: workerSource, contentType });

      return;
    }

    const file = pathname.replace('/__gate/noble/', '');

    if (!/^[\w-]+\.js$/.test(file)) {
      await route.fulfill({ status: 404 });

      return;
    }

    await route.fulfill({ body: readFileSync(join(nobleDir, file)), contentType });
  });

  await page.goto('/');

  const durations = await page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const worker = new Worker('/__gate/worker.js', { type: 'module' });

        worker.onmessage = (event: MessageEvent<number[]>) => resolve(event.data);
        worker.onerror = (event) => reject(new Error(event.message));
      }),
  );
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? Number.POSITIVE_INFINITY;
  const summary = `${browserName} ${browser.version()}: ${durations
    .map((value) => value.toFixed(0))
    .join(', ')} ms, median ${median.toFixed(0)} ms`;

  process.stdout.write(`${summary}\n`);
  test.info().annotations.push({ description: summary, type: 'argon2-gate' });
  expect(durations).toHaveLength(RUNS);
  expect(median).toBeLessThanOrEqual(MAX_MEDIAN_MS);
});
