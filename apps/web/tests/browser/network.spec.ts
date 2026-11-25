import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

const cases = [
  {
    artifact: 'ipv4-conversion.json',
    expected: '192.168.1.10',
    id: 'ipv4-converter',
    name: 'IPv4 Converter',
    sample: 'Hex input',
  },
  {
    artifact: 'ipv4-range.txt',
    expected: '192.168.1.12',
    id: 'ipv4-range',
    name: 'IPv4 Range Expander',
    sample: 'Shorthand endpoint',
  },
  {
    artifact: 'ipv4-subnet.json',
    expected: '203.0.113.10/31',
    id: 'ipv4-subnet',
    name: 'IPv4 Subnet Calculator',
    sample: 'Point-to-point /31',
  },
  {
    artifact: 'mac-addresses.txt',
    expected: '.',
    id: 'mac-generator',
    name: 'MAC Address Generator',
    sample: 'Dotted batch',
  },
  {
    artifact: 'ipv6-ula-plan.json',
    expected: 'exampleSubnet',
    id: 'ipv6-ula',
    name: 'IPv6 ULA Generator',
    sample: 'Site, subnet and host report',
  },
];

for (const platform of platforms) {
  for (const entry of cases) {
    test(`Network tools ${platform} ${entry.id}: guides, real worker, saved bytes and narrow layout`, async ({
      page,
    }) => {
      await openTool(page, platform, entry.id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveCount(5);

      await expect(
        guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
      ).toHaveCount(7);

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: entry.sample });

      await page.getByRole('button', { exact: true, name: `Run ${entry.name}` }).click();
      const output = toolOutput(page);

      await expect(output).toContainText(entry.expected);
      const content = await output.textContent();

      if (entry.id === 'ipv4-subnet') {
        const report = JSON.parse(content ?? '{}');

        expect(report.broadcastAddress).toBeNull();
        expect(report.hostCount).toBe(2);
      }

      if (entry.id === 'mac-generator') expect(content?.split('\n')).toHaveLength(3);

      if (entry.id === 'ipv6-ula') {
        const report = JSON.parse(content ?? '{}');

        expect(report.prefix).toMatch(/^fd[0-9a-f]{2}:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})?::\/48$/);
        expect(report.exampleHost).toBe(report.prefix.replace('::/48', ':1::1'));
      }

      const downloading = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${entry.artifact}` }).click();
      const download = await downloading;
      const path = await download.path();

      if (!path) throw new Error('Network artifact was not saved.');

      expect(readFileSync(path, 'utf8')).toBe(content);
      expect(download.suggestedFilename()).toBe(entry.artifact);

      await page.screenshot({
        fullPage: true,
        path: `test-results/network-${entry.id}-${platform}.png`,
      });

      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      if (entry.id === 'ipv4-converter' || entry.id === 'ipv4-range') {
        if (entry.id === 'ipv4-converter')
          await page
            .getByRole('combobox', { name: 'Apply sample' })
            .selectOption({ label: 'Local IP' });

        await toolInput(page).fill(entry.id === 'ipv4-converter' ? '1..2.3' : '192.168.0.0/21');

        await page.getByRole('button', { exact: true, name: `Run ${entry.name}` }).click();

        await expect(page.getByRole('alert')).toContainText(
          entry.id === 'ipv4-converter' ? 'four decimal octets' : '1024 addresses',
        );

        await expect(output).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);

        await page
          .getByRole('combobox', { name: 'Apply sample' })
          .selectOption({ label: entry.sample });

        await page.getByRole('button', { exact: true, name: `Run ${entry.name}` }).click();
        await expect(output).toContainText(entry.expected);
      }
    });
  }
}
