import { expect, openTool, openToolWithSample, platforms, test, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';
import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    autoRun: true,
    id: 'systemd-unit-builder',
    name: 'systemd Service Unit Builder',
    result: /WantedBy=multi-user\.target/,
  },
  {
    autoRun: true,
    id: 'ssh-config-generator',
    inputless: true,
    name: 'SSH Config Generator',
    result: /Host prod/,
  },
  {
    autoRun: false,
    id: 'wireguard-config-generator',
    inputless: true,
    name: 'WireGuard Config Generator',
    result: /PersistentKeepalive = 25/,
  },
  {
    autoRun: true,
    id: 'docker-compose-validator',
    name: 'Docker Compose Validator',
    result: /No issues found\./,
  },
  {
    autoRun: true,
    id: 'source-map-resolver',
    name: 'Source Map Resolver',
    result: /at boom \(src\/app\.ts:1:10\)/,
  },
  {
    autoRun: true,
    id: 'regex-explainer',
    name: 'Regex Explainer',
    result: /Named capture group "year" \(group 1\)/,
  },
  {
    autoRun: true,
    id: 'markdown-linter',
    name: 'Markdown Linter',
    result: /3:1 MD001\/heading-increment/,
  },
  {
    autoRun: true,
    id: 'pdf-compare',
    inputless: true,
    name: 'PDF Compare',
    result: /Revenue 120/,
  },
];

defineToolSmokeTests('DevOps and review tools', tools);

const key = /^[A-Za-z0-9+/]{43}=$/;

for (const platform of platforms) {
  test(`DevOps and review tools ${platform}: wireguard downloads server and client files with valid keys`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'wireguard-config-generator');
    await page.getByRole('button', { exact: true, name: 'Run WireGuard Config Generator' }).click();
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('wg0.conf');

    const kinds = new Set<string>();

    for (const name of ['wg0.conf', 'client1.conf']) {
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
      const path = await (await pending).path();
      const text = readFileSync(path, 'utf8');
      const matches = [...text.matchAll(/^(PrivateKey|PublicKey|PresharedKey) = (.+)$/gm)];

      expect(matches.length).toBeGreaterThan(0);

      for (const [, kind = '', value = ''] of matches) {
        kinds.add(kind);
        expect(value).toMatch(key);
      }
    }

    expect([...kinds].sort()).toEqual(['PresharedKey', 'PrivateKey', 'PublicKey']);
  });

  test(`DevOps and review tools ${platform}: compose typo sample suggests environment`, async ({
    page,
  }) => {
    await openTool(page, platform, 'docker-compose-validator');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Typos and a bad port' });

    await expect(page.getByRole('region', { name: 'Result' })).toContainText(
      'did you mean "environment"',
    );
  });

  test(`DevOps and review tools ${platform}: pdf compare split view shows both revenue values in one row`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'pdf-compare');
    const row = page
      .getByTestId('output-panel')
      .locator('article', { hasText: 'Revenue 100' })
      .first();

    await expect(row).toContainText('Revenue 120');
  });
}

test('DevOps and review tools web: systemd rejects a relative ExecStart then accepts an absolute one', async ({
  page,
}) => {
  await openToolWithSample(page, 'web', 'systemd-unit-builder');
  const execStart = page.getByRole('textbox', { name: 'ExecStart' });

  await execStart.fill('node app.js');
  await expect(page.getByRole('alert')).toContainText('ExecStart must start with an absolute path');
  await execStart.fill('/usr/bin/node app.js');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('DevOps and review tools web: compose recovers from invalid YAML', async ({ page }) => {
  await openToolWithSample(page, 'web', 'docker-compose-validator');
  const input = toolInput(page);
  const valid = await input.inputValue();

  await input.fill('services: [');
  await expect(page.getByRole('alert')).toBeVisible();
  await input.fill(valid);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Result' })).toContainText('Valid');
});

test('DevOps and review tools web: pdf compare recovers from a missing page', async ({ page }) => {
  await openToolWithSample(page, 'web', 'pdf-compare');
  const pages = page.getByRole('textbox', { name: 'Pages' });

  await pages.fill('9');

  await expect(page.getByRole('alert')).toContainText('before.pdf: Page 9 does not exist');

  await pages.fill('');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('DevOps and review tools web: pdf compare unified view fits a 390px screen', async ({
  page,
}) => {
  await openToolWithSample(page, 'web', 'pdf-compare');
  await page.setViewportSize({ height: 844, width: 390 });

  await page
    .getByRole('group', { name: 'Output' })
    .getByRole('button', { name: 'Unified view' })
    .click();

  const result = page.getByRole('region', { name: 'Result' });

  await expect(result).toContainText('Revenue 100');
  await expect(result).toContainText('Revenue 120');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('DevOps and review tools web: a very long changed diff line is not clipped at 390 px', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/tools/text-diff');
  const long = 'lorem ipsum dolor sit amet '.repeat(56);

  await page.getByRole('textbox', { exact: true, name: 'Before text' }).fill(`${long}one`);
  await page.getByRole('textbox', { exact: true, name: 'After text' }).fill(`${long}two`);
  await page.getByRole('button', { exact: true, name: 'Run Text Diff' }).click();
  const cells = page.getByRole('region', { name: 'Text difference report' }).locator('article pre');

  await expect(cells.first()).toBeVisible();
  const clipped = await cells.evaluateAll(
    (nodes) => nodes.filter((node) => node.scrollHeight > node.clientHeight + 1).length,
  );

  expect(clipped).toBe(0);
});

test('DevOps and review tools web: regex explainer shows warnings and does not wrap the tree', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/tools/regex-explainer');

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: 'Nested quantifier warning' });

  const region = page.getByRole('region', { name: 'Result' });

  await expect(region).toContainText('Warning: Nested unbounded quantifier at index 5');
  const pre = region.locator('pre[data-no-wrap="true"]');

  await expect(pre).toHaveCSS('white-space', 'pre');
  await expect(pre).toHaveAttribute('role', 'region');
  await expect(pre).toHaveAttribute('aria-label', 'Text output');
  await expect(pre).toHaveAttribute('tabindex', '0');
});

test('DevOps and review tools web: a loaded sample names its file fields', async ({ page }) => {
  await openToolWithSample(page, 'web', 'pdf-compare');

  await expect(page.locator('.selected-file-name')).toHaveText([/^Sample file/, /^Sample file/]);
  await expect(page.locator('article h4').first()).toHaveText(/^Before \d+$/);
});

for (const size of [
  { height: 844, width: 390 },
  { height: 800, width: 1280 },
]) {
  test(`DevOps and review tools web: compose report wraps its messages at ${size.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('/tools/docker-compose-validator');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Typos and a bad port' });

    const result = page.getByRole('region', { name: 'Result' });
    const pre = result.locator('pre');

    await expect(result).toContainText('unknown key; did you mean "environment"?');
    await result.scrollIntoViewIfNeeded();

    await expect(pre).not.toHaveAttribute('data-no-wrap');
    expect(await pre.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
