import { expect, test, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

test('Base64 workspace switches direction, preserves text and rejects binary output', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/tools/base64-encode');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base64 Encode / Decode');
  await page.getByRole('textbox', { name: 'UTF-8 text', exact: true }).fill('Příliš žluťoučký 🐎');
  await page.getByRole('button', { name: 'Encode input', exact: true }).click();
  await expect(toolOutput(page)).not.toBeEmpty();
  await page.getByRole('button', { name: 'Copy', exact: true }).click();

  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'UMWZw61sacWhIMW+bHXFpW91xI1rw70g8J+Qjg==',
  );

  await page.getByRole('button', { name: 'Use result & reverse' }).click();

  await expect(page.getByRole('button', { name: 'Decode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await expect(toolOutput(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('Příliš žluťoučký 🐎');
  await page.screenshot({ path: 'test-results/encoding-base64-preview.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Base64 text', exact: true }).fill('/w==');
  await expect(toolOutput(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not valid UTF-8');

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: 'URL-safe decode' });

  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('Hi?');
  await expect(page.getByTestId('tool-information')).toContainText('not encryption');
});

for (const [surface, path] of [
  ['web', '/tools/base64-encode'],
  ['desktop', '/desktop?tool=base64-encode'],
]) {
  test(`Base64 files: ${surface} preserves binary bytes through upload, reverse and download`, async ({
    page,
  }) => {
    const bytes = Buffer.from([0, 255, 128, 10, 13, 0]);

    await page.goto(path);
    await page.getByRole('button', { exact: true, name: 'File' }).click();
    await expect(page.getByTestId('primary-input')).toHaveCount(0);
    await expect(page.getByRole('button', { exact: true, name: 'Encode file' })).toBeDisabled();

    await page
      .getByLabel('Local file', { exact: true })
      .setInputFiles({ buffer: bytes, mimeType: 'application/octet-stream', name: 'bytes.bin' });

    await expect(page.locator('.selected-file-name')).toHaveText('bytes.bin · 6 bytes');
    await page.getByRole('button', { exact: true, name: 'Encode file' }).click();
    await expect(toolOutput(page)).toHaveText(bytes.toString('base64'));
    await page.getByRole('button', { name: 'Use result & reverse' }).click();

    await expect(page.getByRole('textbox', { exact: true, name: 'Base64 / Data URI' })).toHaveValue(
      bytes.toString('base64'),
    );

    await page
      .getByRole('textbox', { exact: true, name: 'Download filename' })
      .fill('recovered.bin');

    await page.getByRole('button', { exact: true, name: 'Decode file' }).click();
    await expect(page.getByRole('button', { exact: true, name: 'Copy' })).toHaveCount(0);
    await expect(page.getByRole('button', { exact: true, name: 'Save' })).toHaveCount(0);
    const downloaded = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download recovered.bin' }).click();
    const download = await downloaded;
    const downloadPath = await download.path();

    if (!downloadPath) throw new Error('Recovered file was not downloaded.');

    expect(download.suggestedFilename()).toBe('recovered.bin');
    expect(readFileSync(downloadPath)).toEqual(bytes);
    await page.getByRole('button', { name: 'Use result & reverse' }).click();
    await expect(page.locator('.selected-file-name')).toHaveText('recovered.bin · 6 bytes');
    await page.getByRole('button', { exact: true, name: 'Data URI' }).click();
    await expect(page.getByRole('combobox', { exact: true, name: 'Alphabet' })).toHaveCount(0);
    await page.getByRole('button', { exact: true, name: 'Encode file' }).click();

    await expect(toolOutput(page)).toHaveText(
      `data:application/octet-stream;base64,${bytes.toString('base64')}`,
    );

    await page.getByRole('button', { exact: true, name: 'Base64' }).click();
    await page.getByRole('combobox', { exact: true, name: 'Alphabet' }).selectOption('url-safe');
    await page.getByRole('button', { exact: true, name: 'Encode file' }).click();
    await expect(toolOutput(page)).toHaveText(bytes.toString('base64url'));
    await page.setViewportSize({ height: 844, width: 390 });

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.getByLabel('Local file', { exact: true }).setInputFiles({
      buffer: Buffer.alloc(0),
      mimeType: 'application/octet-stream',
      name: 'empty.bin',
    });

    await page.getByRole('button', { exact: true, name: 'Encode file' }).click();
    await expect(page.getByTestId('result-summary')).toContainText('0 bytes');
    await expect(page.getByRole('button', { exact: true, name: 'Copy' })).toBeVisible();
    const emptyDownloaded = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Save' }).click();
    const emptyPath = await (await emptyDownloaded).path();

    if (!emptyPath) throw new Error('Empty Base64 result was not downloaded.');

    expect(readFileSync(emptyPath)).toEqual(Buffer.alloc(0));
    await page.getByRole('button', { exact: true, name: 'Clear' }).click();

    await expect(page.getByRole('button', { exact: true, name: 'Text' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await expect(toolOutput(page)).toHaveCount(0);
  });

  test(`Base64 files: ${surface} previews a real image, rejects oversized replacement and handles drop`, async ({
    page,
  }) => {
    await page.goto(path);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Decode PNG file' });

    await page.getByRole('button', { exact: true, name: 'Decode file' }).click();
    await expect(page.getByTestId('result-preview')).toBeVisible();

    await expect
      .poll(() =>
        page
          .getByTestId('result-preview')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBe(1);

    await page.screenshot({
      fullPage: true,
      path: `test-results/base64-file-${surface}-preview.png`,
    });

    await page.getByRole('button', { name: 'Use result & reverse' }).click();

    await page.getByLabel('Local file', { exact: true }).setInputFiles({
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
      mimeType: 'application/octet-stream',
      name: 'too-large.bin',
    });

    await expect(page.getByRole('alert')).toContainText('10 MiB');
    await expect(page.getByRole('button', { exact: true, name: 'Encode file' })).toBeDisabled();
    await expect(page.locator('.selected-file-name')).toHaveCount(0);
    const transfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();

      data.items.add(
        new File([Uint8Array.from([255])], 'dropped.bin', { type: 'application/octet-stream' }),
      );

      return data;
    });

    await page.locator('.tool-file-field').dispatchEvent('drop', { dataTransfer: transfer });
    await transfer.dispose();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.selected-file-name')).toHaveText('dropped.bin · 1 bytes');
    await page.getByRole('button', { exact: true, name: 'Encode file' }).click();
    await expect(toolOutput(page)).toHaveText('/w==');
    await page.getByRole('button', { name: 'Use result & reverse' }).click();

    await page
      .getByRole('textbox', { exact: true, name: 'Base64 / Data URI' })
      .fill('not valid Base64!');

    await page.getByRole('button', { exact: true, name: 'Decode file' }).click();
    await expect(page.getByRole('alert')).toContainText('Base64');
    await expect(page.getByTestId('artifact-list').locator('button')).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: `test-results/base64-file-${surface}.png` });
  });

  test(`Base64 files: ${surface} keeps large results scrollable and saves the complete value`, async ({
    page,
  }) => {
    const bytes = Buffer.alloc(512 * 1024);
    const encoded = bytes.toString('base64');

    await page.goto(path);
    await page.getByRole('button', { exact: true, name: 'File' }).click();

    await page
      .getByLabel('Local file', { exact: true })
      .setInputFiles({ buffer: bytes, mimeType: 'application/octet-stream', name: 'large.bin' });

    await page.getByRole('button', { exact: true, name: 'Encode file' }).click();

    await expect
      .poll(() => toolOutput(page).evaluate((output) => output.textContent?.length))
      .toBe(encoded.length);

    expect(
      await page
        .getByTestId('output-panel')
        .locator('pre')
        .evaluate((output) => output.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(600);

    const saved = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Save' }).click();
    const savedPath = await (await saved).path();

    if (!savedPath) throw new Error('Base64 result was not saved.');

    expect(readFileSync(savedPath, 'utf8')).toBe(encoded);
  });
}

test('Base64 files: desktop native bridge checks size before reading and saves exact bytes', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const nativeWindow = window as unknown as {
      __base64Native: { bytes: number[]; commands: string[]; saved: number[]; tooLarge: boolean };
      __TAURI_INTERNALS__: { invoke(command: string, args?: unknown): Promise<unknown> };
      isTauri: boolean;
    };
    const fixture = {
      bytes: [0, 255, 128, 10, 13, 0],
      commands: [] as string[],
      saved: [] as number[],
      tooLarge: false,
    };

    nativeWindow.__base64Native = fixture;
    nativeWindow.isTauri = true;

    nativeWindow.__TAURI_INTERNALS__ = {
      async invoke(command: string, args?: unknown): Promise<unknown> {
        fixture.commands.push(command);
        if (command === 'plugin:dialog|open') return '/fixture/bytes.bin';
        if (command === 'plugin:dialog|save') return '/fixture/recovered.bin';
        if (command === 'plugin:fs|stat')
          return { size: fixture.tooLarge ? 10 * 1024 * 1024 + 1 : fixture.bytes.length };
        if (command === 'plugin:fs|read_file') return fixture.bytes;

        if (command === 'plugin:fs|write_file' && args instanceof Uint8Array) {
          fixture.saved = Array.from(args);

          return;
        }

        throw new Error(`Unexpected native command: ${command}`);
      },
    };
  });

  await page.goto('/desktop?tool=base64-encode');
  await page.getByRole('button', { exact: true, name: 'File' }).click();
  await page.getByRole('button', { exact: true, name: 'Choose local file…' }).click();
  await expect(page.locator('.selected-file-name')).toHaveText('bytes.bin · 6 bytes');
  await page.getByRole('button', { exact: true, name: 'Encode file' }).click();
  await expect(toolOutput(page)).toHaveText('AP+ACg0A');
  await page.getByRole('button', { name: 'Use result & reverse' }).click();
  await page.getByRole('button', { exact: true, name: 'Decode file' }).click();
  await page.getByRole('button', { exact: true, name: 'Download bytes.bin' }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __base64Native: { saved: number[] } }).__base64Native.saved,
      ),
    )
    .toEqual([0, 255, 128, 10, 13, 0]);

  await page.getByRole('button', { name: 'Use result & reverse' }).click();

  await page.evaluate(() => {
    (window as unknown as { __base64Native: { tooLarge: boolean } }).__base64Native.tooLarge = true;
  });

  await page.getByRole('button', { exact: true, name: 'Choose different local file…' }).click();
  await expect(page.getByRole('alert')).toContainText('10 MiB');
  await expect(page.getByRole('button', { exact: true, name: 'Encode file' })).toBeDisabled();
  const commands = await page.evaluate(
    () => (window as unknown as { __base64Native: { commands: string[] } }).__base64Native.commands,
  );

  expect(commands.filter((command) => command === 'plugin:fs|read_file')).toHaveLength(1);
  expect(commands.indexOf('plugin:fs|stat')).toBeLessThan(commands.indexOf('plugin:fs|read_file'));
  await expect(page.getByLabel('Local file', { exact: true })).toBeVisible();
});

test('Base64 help renders separate paragraphs on web and desktop', async ({ page }) => {
  await page.goto('/tools/base64-encode');
  const webParagraphs = page
    .getByTestId('tool-information')
    .locator('p:not([data-testid="eyebrow"])');

  await expect(page.getByTestId('tool-information').locator('h3')).toHaveText([
    'What is Base64?',
    'When to use Base64 Encode / Decode',
    'How to use it',
    'Examples',
    'Notes',
  ]);

  await expect(webParagraphs).toHaveCount(10);

  await expect(webParagraphs.nth(5)).toHaveText(
    'Encoding uses UTF-8, preserving spaces and line breaks.',
  );

  expect(
    await webParagraphs
      .nth(0)
      .evaluate((paragraph) => parseFloat(getComputedStyle(paragraph).marginBottom)),
  ).toBeGreaterThan(0);

  await page.goto('/desktop?tool=base64-encode');
  await page.getByTestId('conversion-help').locator('summary').click();

  await expect(page.getByTestId('conversion-help').locator('h3')).toHaveText([
    'What is Base64?',
    'When to use Base64 Encode / Decode',
    'How to use it',
    'Examples',
    'Notes',
  ]);

  await expect(page.getByTestId('conversion-help').locator('p')).toHaveCount(10);

  await expect(page.getByTestId('conversion-help').locator('p').nth(5)).toHaveText(
    'Encoding uses UTF-8, preserving spaces and line breaks.',
  );
});
