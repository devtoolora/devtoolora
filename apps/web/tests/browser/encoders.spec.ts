import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { vscodeToolMetadata } from '../../../vscode/src/extension/toolMetadata.generated';
import { toolContentLoaders } from '../../../../packages/tools/src/catalog/content.generated';

const expectedResults: Record<string, string> = {
  'ascii-text': '65 66 67',
  'basic-auth': 'Authorization: Basic ZGVtbzpzZWNyZXQ=',
  'caesar-cipher': 'Uryyb',
  'hex-text': '48 65 6c 6c 6f',
  'html-entities': '&lt;span title=&quot;A&amp;B&quot;&gt;Hello&lt;/span&gt;',
  'morse-code': '... --- ...',
  'text-binary': '01001000 01100101 01101100 01101100 01101111',
  'unicode-escape': '\\u{48}\\u{69}\\u{20}\\u{2713}',
};

for (const tool of vscodeToolMetadata.filter((entry) => entry.id in expectedResults)) {
  for (const platform of platforms) {
    test(`Encoders ${platform}: ${tool.id} guide, sample and result`, async ({ page }) => {
      await openTool(page, platform, tool.id);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(tool.name);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      const { content } = await toolContentLoaders[tool.aliasOf ?? tool.id]();

      await expect(guide.locator('h3')).toHaveText([
        ...(content.documentation?.map((section) => section.title) ?? []),
        'How to use it',
        'Examples',
        'Notes',
      ]);

      await expect(
        guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
      ).toHaveCount(6);

      const sample = tool.samples?.[0];

      if (!sample) throw new Error(`Missing sample for ${tool.id}`);

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: sample.label });

      const runName = tool.textConversion ? 'Encode input' : `Run ${tool.name}`;

      await page.getByRole('button', { exact: true, name: runName }).click();
      await expect(toolOutput(page)).toHaveText(expectedResults[tool.id]);

      if (tool.textConversion) {
        await page.getByRole('button', { name: 'Use result & reverse' }).click();

        await expect(
          page.getByRole('textbox', { exact: true, name: tool.textConversion.encodedLabel }),
        ).toHaveValue(expectedResults[tool.id]);

        await page.getByRole('button', { exact: true, name: 'Decode input' }).click();
        await expect(toolOutput(page)).toHaveText(sample.text ?? '');
      }

      if (platform === 'web' && tool.id === 'html-entities') {
        await page.screenshot({ fullPage: true, path: 'test-results/encoders-html-guide.png' });
      }

      await page.setViewportSize({ height: 844, width: 390 });

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }
}

for (const platform of platforms) {
  test(`HTML Entities ${platform}: complete references, plain-text output and reverse`, async ({
    page,
  }) => {
    await openTool(page, platform, 'html-entities');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Named symbols' });

    await page.getByRole('button', { exact: true, name: 'Decode input' }).click();

    await expect(toolOutput(page)).toHaveText('Price: 10 €\n© 2026 — A\u00A0B', {
      useInnerText: false,
    });

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Numeric Unicode' });

    await page.getByRole('button', { exact: true, name: 'Decode input' }).click();
    await expect(toolOutput(page)).toHaveText('č ✓ 🐎');

    const source =
      '&NotEqualTilde; &#128014; &copy; &nbsp; &amp;lt; &Copy; &notanentity; &copy &#65\n&lt;img src=x onerror=alert(1)&gt;';
    const decoded =
      '\u2242\u0338 🐎 © \u00A0 &lt; &Copy; &notanentity; &copy &#65\n<img src=x onerror=alert(1)>';

    await page.getByRole('textbox', { exact: true, name: 'Escaped HTML text' }).fill(source);
    await page.getByRole('button', { exact: true, name: 'Decode input' }).click();
    await expect.poll(() => toolOutput(page).textContent()).toBe(decoded);

    await expect(
      page.locator('[data-testid="output-panel"] img, [data-testid="output-panel"] script'),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Use result & reverse' }).click();

    await expect(
      page.getByRole('textbox', { exact: true, name: 'Plain text / HTML source' }),
    ).toHaveValue(decoded);

    await page.getByRole('button', { exact: true, name: 'Encode input' }).click();

    await expect(toolOutput(page)).toContainText('&lt;img src=x onerror=alert(1)&gt;');

    await page.setViewportSize({ height: 844, width: 390 });

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test('Encoders validate UTF-8, ASCII range, Unicode code points and Morse input', async ({
  page,
}) => {
  const cases = [
    { error: 'not valid UTF-8', id: 'text-binary', sample: 'Decode letter A', text: '11111111' },
    { error: 'not valid UTF-8', id: 'hex-text', sample: 'Decode greeting', text: 'ff' },
    { error: 'between 0 and 127', id: 'ascii-text', sample: 'Decode greeting', text: '128' },
    {
      error: 'outside the valid range',
      id: 'unicode-escape',
      sample: 'Decode code points',
      text: '\\u{110000}',
    },
    { error: 'Unknown Morse sequence', id: 'morse-code', sample: 'Decode SOS', text: '.......' },
  ];

  for (const entry of cases) {
    await page.goto(`/tools/${entry.id}`);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: entry.sample });

    await toolInput(page).fill(entry.text);
    await page.getByRole('button', { exact: true, name: 'Decode input' }).click();
    await expect(page.getByRole('alert')).toContainText(entry.error);
    await expect(toolOutput(page)).toHaveCount(0);
  }
});

test('Encoders preserve Basic Auth spaces and handle Caesar zero shift', async ({ page }) => {
  await page.goto('/tools/basic-auth');
  await page.getByRole('textbox', { exact: true, name: 'Username' }).fill(' demo ');
  await page.getByLabel('Password', { exact: true }).fill(' secret ');
  await page.getByRole('button', { exact: true, name: 'Run Basic Auth Generator' }).click();

  await expect(toolOutput(page)).toHaveText(
    `Authorization: Basic ${Buffer.from(' demo : secret ').toString('base64')}`,
  );

  await page.getByRole('textbox', { exact: true, name: 'Username' }).fill('user:name');
  await page.getByRole('button', { exact: true, name: 'Run Basic Auth Generator' }).click();
  await expect(page.getByRole('alert')).toContainText('colon');
  await page.getByRole('button', { exact: true, name: 'Clear' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(toolOutput(page)).toHaveCount(0);

  await page.goto('/tools/caesar-cipher');
  await page.getByRole('textbox', { exact: true, name: 'Text' }).fill('Abc xyz!');
  await page.getByRole('spinbutton', { exact: true, name: 'Shift' }).fill('0');
  await page.getByRole('button', { exact: true, name: 'Run Caesar/ROT13 Cipher' }).click();
  await expect(toolOutput(page)).toHaveText('Abc xyz!');
});
