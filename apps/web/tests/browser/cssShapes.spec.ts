import { expect, openTool, platforms, test, toolOutput } from './fixtures';

for (const platform of platforms) {
  test(`CSS Radius ${platform}: linked corners and exact visual output`, async ({ page }) => {
    await openTool(page, platform, 'css-border-radius-generator');
    await page.getByRole('spinbutton', { exact: true, name: 'Top left' }).fill('32');
    await page.keyboard.press('Control+Enter');
    await expect(toolOutput(page)).toContainText('32px 32px 32px 32px');
    await expect(page.locator('[data-css-preview="radius"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download border-radius.css' })).toBeVisible();

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-radius-${platform}.png`),
    });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`CSS Triangle ${platform}: actual direction and invalid color clears export`, async ({
    page,
  }) => {
    await openTool(page, platform, 'css-triangle-generator');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Right pointer' });

    await page.keyboard.press('Control+Enter');
    await expect(toolOutput(page)).toContainText('border-left:');
    await expect(page.locator('[data-css-preview="triangle"]')).toBeVisible();

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-triangle-${platform}.png`),
    });

    await page.getByRole('textbox', { exact: true, name: 'Color' }).fill('red;display:none');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download triangle.css' })).toHaveCount(0);
  });

  test(`CSS Clip ${platform}: keyboard handles, add/remove and invalid draft`, async ({ page }) => {
    await openTool(page, platform, 'css-clip-path-generator');
    await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ label: 'Triangle' });
    const first = page.getByRole('button', { exact: true, name: 'Polygon point 1' });

    await first.focus();
    await first.press('Shift+ArrowRight');
    await page.keyboard.press('Control+Enter');
    await expect(toolOutput(page)).toContainText('60% 0%');
    await page.getByLabel('Polygon canvas').scrollIntoViewIfNeeded();
    const bounds = await page.getByLabel('Polygon canvas').boundingBox();
    const handle = await first.boundingBox();

    if (!bounds || !handle) throw new Error('Missing polygon drag surface.');

    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 4);
    await page.mouse.up();

    await expect
      .poll(() =>
        page
          .locator('[data-css-preview="clip-path"]')
          .evaluate((element) => (element as HTMLElement).style.clipPath),
      )
      .toContain('50% 25%');

    await page.getByRole('button', { name: 'Click canvas to add' }).click();
    await page.getByLabel('Polygon canvas').click({ position: { x: 80, y: 80 } });
    await expect(page.getByRole('button', { name: /^Polygon point / })).toHaveCount(4);
    await page.getByRole('button', { name: 'Remove selected point' }).click();
    await expect(page.getByRole('button', { name: /^Polygon point / })).toHaveCount(3);

    await page.getByLabel('Preview image (local only)').setInputFiles({
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=',
        'base64',
      ),
      mimeType: 'image/png',
      name: 'local-preview.png',
    });

    await expect
      .poll(() =>
        page
          .locator('[data-css-preview="clip-path"]')
          .evaluate((element) => (element as HTMLElement).style.backgroundImage),
      )
      .toContain('data:image/png');

    await page.getByRole('button', { name: 'Remove preview image' }).click();
    await expect(page.getByLabel('Preview image (local only)')).toHaveValue('');

    await expect
      .poll(() =>
        page
          .locator('[data-css-preview="clip-path"]')
          .evaluate((element) => (element as HTMLElement).style.backgroundImage),
      )
      .toBe('');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-clip-${platform}.png`),
    });

    await page.getByText('Points JSON (advanced)', { exact: true }).click();
    await page.getByRole('textbox', { exact: true, name: 'Points JSON' }).fill('[]');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('button', { name: /^Polygon point / })).toHaveCount(0);
    await expect(page.locator('[data-css-preview="clip-path"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download clip-path.css' })).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`CSS Clip ${platform}: presets, moving the polygon, circle, ellipse, inset, outside view and -webkit-`, async ({
    page,
  }) => {
    await openTool(page, platform, 'css-clip-path-generator');
    const output = toolOutput(page);
    const presets = page.getByRole('group', { name: 'Shape presets' });

    await expect(presets.getByRole('button')).toHaveCount(28);
    await presets.getByRole('button', { exact: true, name: 'Hexagon' }).click();

    await expect(output).toContainText(
      'clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);',
    );

    await page.getByText('Points JSON (advanced)', { exact: true }).click();
    const json = page.getByRole('textbox', { exact: true, name: 'Points JSON' });

    await json.fill('[[30,30],[50,30],[40,50]]');
    await page.getByLabel('Polygon canvas').scrollIntoViewIfNeeded();
    const bounds = await page.getByLabel('Polygon canvas').boundingBox();

    if (!bounds) throw new Error('Missing polygon canvas.');

    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.37);
    await page.mouse.down();

    await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.42, {
      steps: 4,
    });

    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.47, {
      steps: 4,
    });

    await page.mouse.up();

    await expect
      .poll(async () =>
        (JSON.parse(await json.inputValue()) as number[][]).map((point) => point.map(Math.round)),
      )
      .toEqual([
        [50, 40],
        [70, 40],
        [60, 60],
      ]);

    const shape = page.getByRole('group', { exact: true, name: 'Shape' });

    await shape.getByRole('button', { exact: true, name: 'Circle' }).click();
    await expect(output).toContainText('clip-path: circle(50% at 50% 50%);');
    await expect(page.getByRole('textbox', { exact: true, name: 'Points JSON' })).toHaveCount(0);
    await page.getByRole('button', { exact: true, name: 'Shape center' }).focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.getByRole('spinbutton', { exact: true, name: 'Radius' }).fill('30');
    await expect(output).toContainText('clip-path: circle(30% at 40% 50%);');
    await shape.getByRole('button', { exact: true, name: 'Ellipse' }).click();
    await expect(output).toContainText('clip-path: ellipse(50% 35% at 40% 50%);');
    await shape.getByRole('button', { exact: true, name: 'Inset' }).click();
    await page.getByRole('spinbutton', { exact: true, name: 'Corner radius' }).fill('16');
    await expect(output).toContainText('clip-path: inset(10% 10% 10% 10% round 16px);');
    await page.getByRole('checkbox', { name: 'Add -webkit- prefix' }).check();

    await expect(output).toContainText(
      '-webkit-clip-path: inset(10% 10% 10% 10% round 16px);\n  clip-path: inset(10% 10% 10% 10% round 16px);',
    );

    await page.getByRole('checkbox', { name: 'Show outside clip-path' }).check();
    await expect(page.locator('[data-css-preview="outside"]')).toBeVisible();
    await page.getByRole('combobox', { name: 'Preview surface' }).selectOption('checkerboard');
    await expect(page.locator('[data-css-preview="clip-path"]')).toHaveClass(/checkerboard/);
    await page.getByRole('spinbutton', { exact: true, name: 'Inset top' }).fill('60');
    await page.getByRole('spinbutton', { exact: true, name: 'Inset bottom' }).fill('40');

    await expect(page.getByRole('alert')).toContainText(
      'Inset top and bottom together must stay below 100%',
    );

    await expect(page.locator('[data-css-preview="clip-path"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download clip-path.css' })).toHaveCount(0);

    await presets
      .getByRole('button', { exact: true, name: 'Rounded inset with -webkit- prefix' })
      .click();

    await expect(output).toContainText('-webkit-clip-path: inset(10% 10% 10% 10% round 24px);');
    await page.screenshot({ fullPage: true, path: `test-results/css-clip-shapes-${platform}.png` });
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
