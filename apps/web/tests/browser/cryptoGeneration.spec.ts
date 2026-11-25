import { expect, openTool, platforms, test, toolOutput, type Page } from './fixtures';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

async function download(page: Page, id: string): Promise<string> {
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: `Download ${id}.txt` }).click();
  const path = await (await pending).path();

  if (!path) throw new Error('Missing crypto text export.');

  return readFileSync(path, 'utf8');
}

for (const platform of platforms) {
  test(`Crypto Hash ${platform}: empty text, binary file and exact export`, async ({ page }) => {
    await openTool(page, platform, 'hash');
    const output = toolOutput(page);

    await page.getByRole('button', { name: 'Run Hash Generator' }).click();
    await expect(output).toHaveText(createHash('sha256').update('').digest('hex'));
    const bytes = Buffer.from([0, 255, 128, 13, 10]);

    await page.locator('input[type="file"]').setInputFiles({
      buffer: bytes,
      mimeType: 'application/octet-stream',
      name: 'binary-fixture.bin',
    });

    await expect(page.locator('.selected-file-name')).toContainText('binary-fixture.bin');
    await page.getByRole('button', { name: 'Run Hash Generator' }).click();
    await expect(output).toHaveText(createHash('sha256').update(bytes).digest('hex'));
    expect(await download(page, 'hash')).toBe(await output.textContent());

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`crypto-hash-${platform}.png`),
    });

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Trailing newline' });

    await page.getByRole('button', { name: 'Run Hash Generator' }).click();
    await expect(output).toHaveText(createHash('sha256').update('hello\n').digest('hex'));
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Crypto HMAC ${platform}: literal secret, empty message and secret-free export`, async ({
    page,
  }) => {
    await openTool(page, platform, 'hmac');
    await page.getByLabel('Secret', { exact: true }).fill(' browser secret ');
    await page.getByRole('button', { name: 'Run HMAC Generator' }).click();
    const expected = createHmac('sha256', ' browser secret ').update('').digest('hex');

    await expect(toolOutput(page)).toHaveText(expected);
    expect(await download(page, 'hmac')).toBe(expected);

    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
      ' browser secret ',
    );

    await page.getByLabel('Secret', { exact: true }).fill('');
    await expect(page.getByRole('button', { name: 'Download hmac.txt' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Run HMAC Generator' })).toBeDisabled();
  });

  for (const id of ['uuid', 'ulid', 'random-token', 'password-generator']) {
    test(`Crypto ${id} ${platform}: manual batches, fresh values and invalidation`, async ({
      page,
    }) => {
      await openTool(page, platform, id);
      const run = page.getByRole('button', { name: /^Run / });

      await expect(run).toBeVisible();
      await expect(page.getByRole('button', { name: `Download ${id}.txt` })).toHaveCount(0);
      await page.getByRole('spinbutton', { exact: true, name: 'Count' }).fill('3');

      if (id === 'random-token') {
        await page.getByRole('combobox', { exact: true, name: 'Mode' }).selectOption('bytes');

        await page
          .getByRole('combobox', { exact: true, name: 'Encoding' })
          .selectOption('base64url');
      }

      await run.click();
      const output = toolOutput(page);

      await expect.poll(() => output.textContent()).toMatch(/\n.*\n/);
      const before = await output.textContent();
      const lines = before?.split('\n') ?? [];

      expect(lines).toHaveLength(3);
      if (id === 'uuid')
        for (const line of lines)
          expect(line).toMatch(
            /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
          );
      if (id === 'ulid')
        for (const line of lines) expect(line).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
      if (id === 'random-token')
        for (const line of lines) expect(line).toMatch(/^[A-Za-z0-9_-]{43}$/);
      if (id === 'password-generator') for (const line of lines) expect(line).toHaveLength(20);

      expect(await download(page, id)).toBe(before);
      await run.click();
      await expect.poll(() => output.textContent()).not.toBe(before);

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`crypto-${id}-${platform}.png`),
      });

      await page.getByRole('spinbutton', { exact: true, name: 'Count' }).fill('1.5');
      await expect(page.getByRole('button', { name: `Download ${id}.txt` })).toHaveCount(0);
      await run.click();
      await expect(page.getByRole('alert')).toContainText('whole number');
      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
}
