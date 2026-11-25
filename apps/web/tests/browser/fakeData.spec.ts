import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Fake Data Generator ${platform}: field specs, seeded users, formats, table, downloads and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'fake-data-generator');

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is the fake data generator?',
      'When to generate fake data',
      'Field types',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(page.getByText('Auto-run', { exact: true })).toBeVisible();
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Built-in users (seed 42)' });
    await expect(output).toContainText('linus.lovelace.1@example.test');
    const users = JSON.parse((await output.textContent()) ?? '[]');

    expect(users).toHaveLength(5);
    await samples.selectOption({ label: 'Built-in users as CSV' });
    await expect(output).toContainText('id,name,email,active');
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download seeded-users.csv' }).click();
    const path = await (await saving).path();

    if (!path) throw new Error('Fixture CSV was not saved.');

    const saved = readFileSync(path, 'utf8');

    expect(saved).toContain('\r\n');
    expect(saved.split('\r\n').filter(Boolean)).toHaveLength(6);
    await samples.selectOption({ label: 'Users with roles' });
    // The CSV above also has this address, so wait for the JSON shape too.
    await expect(output).toContainText('"id"');
    await expect(output).toContainText('@example.test');
    const records = JSON.parse((await output.textContent()) ?? '[]');

    expect(records).toHaveLength(10);

    expect(records.map((record: { id: number }) => record.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);

    expect(records.every((record: { age: number }) => record.age >= 18 && record.age <= 90)).toBe(
      true,
    );

    await expect(
      page.getByRole('button', { exact: true, name: 'Download fake-data.json' }),
    ).toBeVisible();

    await samples.selectOption({ label: 'Contacts with nulls (table)' });
    const table = page.getByRole('region', { name: 'Scrollable JSON records' });

    await expect(table).toBeVisible();

    await expect(table.locator('thead th')).toHaveText([
      '#',
      '"id"',
      '"firstName"',
      '"lastName"',
      '"phone"',
      '"city"',
      '"country"',
      '"countryCode"',
      '"nickname"',
    ]);

    await expect(page.getByText('25 of 25 matching rows', { exact: false })).toBeVisible();
    await page.screenshot({ fullPage: true, path: `test-results/fake-data-${platform}.png` });
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('spinbutton', { name: 'Count', exact: true }).fill('1001');
    await expect(page.getByRole('alert')).toContainText('Count must be an integer');
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await toolInput(page).fill('price: money');
    await page.getByRole('spinbutton', { name: 'Count', exact: true }).fill('3');
    await expect(page.getByRole('alert')).toContainText('Line 1: unknown type "money"');
    await samples.selectOption({ label: 'Built-in users (seed 42)' });
    await expect(output).toContainText('linus.lovelace.1@example.test');
    expect(JSON.parse((await output.textContent()) ?? '[]')).toEqual(users);
  });
}

test('Seeded Fake Data keeps its old route through the merged generator', async ({ page }) => {
  await page.goto('/tools/seeded-fake-data');
  await expect(page.getByRole('heading', { level: 1, name: 'Seeded Fake Data' })).toBeVisible();

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: 'Built-in users (seed 42)' });

  await expect(toolOutput(page)).toContainText('linus.lovelace.1@example.test');
});
