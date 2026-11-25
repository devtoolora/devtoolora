import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  for (const entry of [
    {
      fileName: 'types.ts',
      id: 'json-to-typescript',
      name: 'JSON to TypeScript Types',
      titles: ['What is JSON to TypeScript conversion?', 'When to generate TypeScript types'],
    },
    {
      fileName: 'schema.ts',
      id: 'json-to-zod',
      name: 'JSON to Zod Schema',
      titles: ['What is a Zod schema?', 'When to generate a Zod schema'],
    },
  ]) {
    test(`Schema types ${platform} ${entry.id}: guide, live output, options, exact artifact and recovery`, async ({
      page,
    }) => {
      await openTool(page, platform, entry.id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveText([
        ...entry.titles,
        'How to use it',
        'Examples',
        'Notes',
      ]);

      await expect(page.getByText('Auto-run', { exact: true })).toBeVisible();

      await expect(
        page.getByRole('button', { exact: true, name: `Run ${entry.name}` }),
      ).toHaveCount(0);

      const output = toolOutput(page);
      const samples = page.getByRole('combobox', { name: 'Apply sample' });

      if (entry.id === 'json-to-typescript') {
        await samples.selectOption({ label: 'Records with optional fields' });
        await expect(output).toContainText('export type Users = User[];');
        await expect(output).toContainText('email?: string;');
        await expect(output).toContainText('phone?: string;');
        await page.getByRole('button', { exact: true, name: 'Type alias' }).click();
        await page.getByRole('checkbox', { name: 'Readonly' }).check();
        await expect(output).toContainText('export type User = {');
        await expect(output).toContainText('readonly id: number;');
      } else {
        await samples.selectOption({ label: 'Webhook with offsets and UUIDs' });
        await expect(output).toContainText('eventId: z.uuid(),');
        await expect(output).toContainText('occurredAt: z.iso.datetime({ offset: true }),');
        await expect(output).toContainText('paidOn: z.iso.date(),');
        await expect(output).toContainText('export type Webhook = z.infer<typeof WebhookSchema>;');
        await page.getByRole('button', { exact: true, name: 'Zod 3' }).click();
        await expect(output).toContainText('eventId: z.string().uuid(),');
        await page.getByRole('checkbox', { name: 'Strict objects' }).check();
        await expect(output).toContainText('}).strict(),');
      }

      const content = await output.textContent();
      const downloadPromise = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${entry.fileName}` }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(entry.fileName);
      const path = await download.path();

      if (!path) throw new Error(`${entry.fileName} was not saved.`);

      expect(readFileSync(path, 'utf8')).toBe(`${content}\n`);
      await page.screenshot({ fullPage: true, path: `test-results/${entry.id}-${platform}.png` });
      const input = toolInput(page);

      await input.fill('{"a":');
      await expect(page.getByRole('alert')).toContainText('Invalid JSON at line 1, column 6');
      await expect(output).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
      await input.fill('[{"id":1},{"id":2,"note":null}]');

      await expect(output).toContainText(
        entry.id === 'json-to-typescript' ? 'note?: null;' : 'note: z.null().optional(),',
      );

      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
}
