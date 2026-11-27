import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { serveStatic } from './lighthouse/serve.mjs';
import { summarizeRuns } from './lighthouse/summary.mjs';

const ROOT = 'out/web';
const OUTPUT_DIR = 'out/lighthouse';
const PORT = 4174;
const FORM_FACTORS = ['mobile', 'desktop'];

const { values } = parseArgs({
  options: {
    pages: { default: '/,/tools,/tools/json-format,/extension,/about', type: 'string' },
    runs: { default: '3', type: 'string' },
  },
});

function slugOf(page) {
  return page === '/' ? 'home' : page.slice(1).replaceAll('/', '-');
}

function runLighthouse(url, formFactor, outputPath) {
  const args = ['--yes', 'lighthouse@12.8.2', url, '--output=json', `--output-path=${outputPath}`];

  args.push('--chrome-flags=--headless=new', '--quiet');
  if (formFactor === 'desktop') args.push('--preset=desktop');

  // spawnSync would block the event loop and starve the in-process static server.
  return new Promise((resolve, reject) => {
    spawn('npx', args, { stdio: 'inherit' }).on('close', (status) => {
      if (status === 0) resolve();
      else reject(new Error(`lighthouse failed for ${url} (${formFactor})`));
    });
  });
}

async function measure(baseUrl, page, formFactor, runs) {
  const reports = [];

  for (let run = 1; run <= runs; run += 1) {
    const outputPath = `${OUTPUT_DIR}/${slugOf(page)}-${formFactor}-${run}.json`;

    await runLighthouse(`${baseUrl}${page}`, formFactor, outputPath);
    reports.push(JSON.parse(readFileSync(outputPath, 'utf8')));
  }

  return summarizeRuns(reports);
}

function printRow(key, { categories, failingAudits }) {
  const scores = Object.entries(categories)
    .map(([id, score]) => `${id}=${score}`)
    .join(' ');

  console.log(`${key}: ${scores}`);

  for (const audit of failingAudits) {
    console.log(`    ${audit.id} (${audit.score}) ${audit.displayValue ?? ''}`.trimEnd());
  }
}

async function main() {
  if (!existsSync(`${ROOT}/index.html`)) {
    console.error(`${ROOT}/index.html is missing. Run "npm run build:web" first.`);
    process.exit(1);
  }

  rmSync(OUTPUT_DIR, { force: true, recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const server = await serveStatic(ROOT, PORT);
  const summary = {};

  try {
    for (const page of values.pages.split(',')) {
      for (const formFactor of FORM_FACTORS) {
        const key = `${page} [${formFactor}]`;

        summary[key] = await measure(server.url, page, formFactor, Number(values.runs));
        printRow(key, summary[key]);
      }
    }
  } finally {
    await server.close();
  }

  writeFileSync(`${OUTPUT_DIR}/summary.json`, JSON.stringify(summary, null, 2));

  process.exit(
    Object.values(summary).some(({ categories }) => Object.values(categories).some((s) => s < 100))
      ? 1
      : 0,
  );
}

await main();
