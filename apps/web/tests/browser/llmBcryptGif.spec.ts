import { expect, openToolWithSample, platforms, test, toolOutput, type Page } from './fixtures';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  { autoRun: true, id: 'token-estimator', name: 'Token Estimator', result: /tokens/ },
  { autoRun: true, id: 'text-chunker', name: 'Text Chunker', result: /chunk/ },
  {
    autoRun: true,
    id: 'prompt-template-renderer',
    name: 'Prompt Template Renderer',
    result: /Ada/,
  },
  {
    autoRun: true,
    id: 'jsonl-dataset-validator',
    name: 'JSONL Dataset Validator',
    result: /Lines/i,
  },
  {
    autoRun: true,
    id: 'function-schema-builder',
    name: 'Function-Calling Schema Builder',
    result: /get_weather/,
  },
  {
    autoRun: false,
    id: 'bcrypt-hash',
    inputless: true,
    name: 'Bcrypt Hash & Verify',
    result: /\$2b\$10\$/,
  },
  {
    autoRun: true,
    id: 'gif-frame-extractor',
    inputless: true,
    name: 'GIF Frame Extractor',
    result: /frame/i,
  },
];

defineToolSmokeTests('LLM, bcrypt and GIF tools', tools);

const result = (page: Page) => page.getByRole('region', { name: 'Result' });

for (const platform of platforms) {
  test(`LLM, bcrypt and GIF tools ${platform}: gif sample downloads a zip with 3 PNGs and a JSON file`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'gif-frame-extractor');
    await expect(result(page)).toContainText('frame');
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download blink-frames.zip' }).click();
    const files = unzipSync(new Uint8Array(readFileSync(await (await pending).path())));
    const names = Object.keys(files);

    expect(names.filter((name) => name.endsWith('.png'))).toHaveLength(3);
    expect(names.filter((name) => name.endsWith('.json'))).toHaveLength(1);
  });

  test(`LLM, bcrypt and GIF tools ${platform}: bcrypt hash then verify matches`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'bcrypt-hash', 'Fast hash at cost 4');
    const run = page.getByRole('button', { exact: true, name: 'Run Bcrypt Hash & Verify' });

    await run.click();
    const code = toolOutput(page);

    await expect(code).toContainText('$2b$04$');
    const hash = (await code.textContent()) ?? '';

    await page.getByRole('group', { name: /Mode/ }).getByRole('button', { name: 'Verify' }).click();
    await page.getByLabel('Hash', { exact: true }).fill(hash.trim());
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery staple');
    await run.click();
    await expect(result(page)).toContainText('Match');
    await expect(result(page)).not.toContainText('No match');
  });

  test(`LLM, bcrypt and GIF tools ${platform}: bcrypt rejects a password over 72 bytes then recovers`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'bcrypt-hash', 'Fast hash at cost 4');
    const run = page.getByRole('button', { exact: true, name: 'Run Bcrypt Hash & Verify' });
    const password = page.getByLabel('Password', { exact: true });

    await password.fill('x'.repeat(73));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('Bcrypt uses only the first 72 bytes');
    await password.fill('short');
    await run.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(toolOutput(page)).toContainText('$2b$04$');
  });

  test(`LLM, bcrypt and GIF tools ${platform}: jsonl errors list the line number`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'jsonl-dataset-validator', 'Common mistakes');
    await expect(result(page)).toContainText(/Line \d+/);
  });

  test(`LLM, bcrypt and GIF tools ${platform}: invalid input recovers`, async ({ page }) => {
    const cases: [string, string, string, string][] = [
      ['token-estimator', '[data-testid="primary-input"] textarea', '', 'tokens'],
      ['jsonl-dataset-validator', '[data-testid="primary-input"] textarea', '', 'Lines'],
      ['prompt-template-renderer', '[data-testid="primary-input"] textarea', '{{', 'Ada'],
      [
        'function-schema-builder',
        'textarea[aria-label="Example arguments (JSON)"], [data-testid="primary-input"] textarea',
        '{',
        'get_weather',
      ],
    ];

    for (const [id, selector, bad, good] of cases) {
      await openToolWithSample(page, platform, id);
      const input = page.locator(selector);
      const valid = await input.inputValue();

      await input.fill(bad);
      if (bad !== '') await expect(page.getByRole('alert')).toBeVisible();

      await input.fill(valid);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(result(page)).toContainText(good);
    }
  });
}

test('LLM, bcrypt and GIF tools web: gif frames out of range recover', async ({ page }) => {
  await openToolWithSample(page, 'web', 'gif-frame-extractor');
  const frames = page.getByRole('textbox', { name: 'Frames' });

  await expect(result(page)).toContainText('frame');
  await frames.fill('99');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  await frames.fill('');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(result(page)).toContainText('frame');
});

test('LLM, bcrypt and GIF tools web: chunker overlap not below size recovers', async ({ page }) => {
  await openToolWithSample(page, 'web', 'text-chunker');
  const overlap = page.getByRole('spinbutton', { name: /Overlap/ });
  const valid = await overlap.inputValue();

  await overlap.fill('99999');
  await expect(page.getByRole('alert')).toBeVisible();
  await overlap.fill(valid);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(result(page)).toContainText('chunk');
});

test('LLM, bcrypt and GIF tools web: bcrypt cost 14 hashes in at most 3 s (median of 3)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await openToolWithSample(page, 'web', 'bcrypt-hash', 'Fast hash at cost 4');
  await page.getByRole('spinbutton', { name: /Cost/ }).fill('14');
  const run = page.getByRole('button', { exact: true, name: 'Run Bcrypt Hash & Verify' });
  const timings: number[] = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const summary = page.getByText(/Cost 14 .* took \d+ ms/);

    await page.getByLabel('Password', { exact: true }).fill(`timing gate ${attempt}`);
    // Changing the input hides the previous run's summary, so the next one is always fresh.
    await expect(summary).toBeHidden();
    await run.click();
    await expect(summary).toContainText(`took`, { timeout: 60_000 });
    const text = (await summary.first().textContent()) ?? '';

    timings.push(Number(/took (\d+) ms/.exec(text)?.[1]));
  }

  const median = [...timings].sort((a, b) => a - b)[1] ?? Infinity;

  test.info().annotations.push({
    description: `bcrypt cost 14 timings (ms): ${timings.join(', ')}; median ${median}`,
    type: 'timings',
  });

  expect(median).toBeLessThanOrEqual(3000);
});

for (const size of [
  { height: 844, width: 390 },
  { height: 800, width: 1280 },
]) {
  test(`LLM, bcrypt and GIF tools web: jsonl report wraps its messages at ${size.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openToolWithSample(page, 'web', 'jsonl-dataset-validator', 'Common mistakes');
    const pre = result(page).locator('pre');

    await expect(pre).toContainText(/Line \d+/);
    await result(page).scrollIntoViewIfNeeded();

    await expect(pre).not.toHaveAttribute('data-no-wrap');
    expect(await pre.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
