import { expect, openTool, platforms, test, toolInput, type Page } from './fixtures';
import { readFileSync } from 'node:fs';

async function download(page: Page, id: string): Promise<Record<string, unknown>> {
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: `Download ${id}.json` }).click();
  const path = await (await pending).path();

  if (!path) throw new Error('Missing inspection report.');

  return JSON.parse(readFileSync(path, 'utf8'));
}

for (const platform of platforms) {
  test(`Crypto inspection password ${platform}: masked input, no secret export and stale invalidation`, async ({
    page,
  }) => {
    await openTool(page, platform, 'password-strength');
    const password = page.getByLabel('Password', { exact: true });

    await expect(password).toHaveAttribute('type', 'password');
    await expect(toolInput(page)).toHaveCount(0);
    await password.fill('Password123!');
    await page.getByRole('button', { name: 'Run Password Strength' }).click();
    await expect(page.getByLabel('Interactive JSON outline')).toBeVisible();
    const report = await download(page, 'password-strength');

    expect(report.rating).toBe('weak');
    expect(report.method).toBe('heuristic-checklist');
    expect(JSON.stringify(report)).not.toContain('Password123!');
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('Password123!');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`inspection-password-${platform}.png`),
    });

    await password.fill(' leading spaces ');

    await expect(page.getByRole('button', { name: 'Download password-strength.json' })).toHaveCount(
      0,
    );

    await page.getByRole('button', { name: 'Run Password Strength' }).click();
    expect((await download(page, 'password-strength')).length).toBe(16);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  for (const id of ['certificate-inspector', 'certificate-chain-analyzer', 'pem-key-inspector']) {
    test(`Crypto inspection ${id} ${platform}: structured report, samples, exact export and invalid input`, async ({
      page,
    }) => {
      await openTool(page, platform, id);
      const samples = page.getByRole('combobox', { name: 'Apply sample' });

      await samples.selectOption({ index: 1 });
      await page.getByRole('button', { name: /^Run / }).click();
      await expect(page.getByLabel('Interactive JSON outline')).toBeVisible();
      const report = await download(page, id);

      if (id.includes('certificate')) expect(report.trustEstablished).toBe(false);
      else expect(report.fingerprintFormat).toBe('SPKI DER');

      expect(JSON.stringify(report)).not.toContain('-----BEGIN');

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`inspection-${id}-${platform}.png`),
      });

      if (id === 'certificate-chain-analyzer') {
        await samples.selectOption({ label: 'Reversed order' });
        await page.getByRole('button', { name: /^Run / }).click();
        const reversed = await download(page, id);

        expect(reversed.links).toEqual([
          expect.objectContaining({ issuerMatchesNextSubject: false, signatureVerified: false }),
        ]);
      }

      if (id === 'pem-key-inspector')
        await expect(page.getByLabel('Private key passphrase', { exact: true })).toHaveCount(0);

      await toolInput(page).fill('malformed PEM');
      await expect(page.getByRole('button', { name: `Download ${id}.json` })).toHaveCount(0);
      await page.getByRole('button', { name: /^Run / }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
}
