import { expect, openTool, platforms, test, toolGuide, toolOutput, type Page } from './fixtures';
import { readFileSync } from 'node:fs';

async function download(page: Page, name: string): Promise<string> {
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
  const path = await (await pending).path();

  if (!path) throw new Error('Missing CSS download.');

  return readFileSync(path, 'utf8');
}

for (const platform of platforms) {
  test(`CSS Grid ${platform}: matching live tracks, scrollable overflow and validated exports`, async ({
    page,
  }) => {
    await openTool(page, platform, 'css-grid-generator');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const stage = page.locator('[data-css-preview="grid"]');
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Compact grid' });
    await page.keyboard.press('Control+Enter');
    await expect(stage).toBeVisible();

    await expect
      .poll(() => stage.evaluate((element) => (element as HTMLElement).style.gridTemplateRows))
      .toBe('repeat(2, minmax(80px, auto))');

    await expect
      .poll(() => stage.evaluate((element) => (element as HTMLElement).style.columnGap))
      .toBe('8px');

    await expect(stage.locator('span')).toHaveCount(6);
    const css = await download(page, 'grid.css');

    expect(css).toBe(await output.textContent());
    expect(JSON.parse(await download(page, 'css-grid-report.json')).css).toBe(css);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-grid-${platform}.png`),
    });

    await samples.selectOption({ label: 'Minimum width overflow' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(() =>
        stage.evaluate(
          (element) => element.parentElement!.scrollWidth > element.parentElement!.clientWidth,
        ),
      )
      .toBe(true);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('spinbutton', { exact: true, name: 'Columns' }).fill('1.5');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('whole number');
    await expect(page.getByRole('button', { name: 'Download grid.css' })).toHaveCount(0);
    await samples.selectOption({ label: 'Column-first placement' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(() => stage.evaluate((element) => (element as HTMLElement).style.gridAutoFlow))
      .toBe('column');

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a CSS grid layout?',
      'When to use CSS Grid Generator',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });

  test(`CSS Flexbox ${platform}: actual wrapping, featured growth and reverse direction`, async ({
    page,
  }) => {
    await openTool(page, platform, 'css-flexbox-generator');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const stage = page.locator('[data-css-preview="flexbox"]');

    await samples.selectOption({ label: 'Wrapped toolbar' });
    await page.keyboard.press('Control+Enter');
    await expect(stage.locator('span')).toHaveCount(8);

    await expect
      .poll(() =>
        stage
          .locator('span')
          .evaluateAll(
            (items) =>
              new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size,
          ),
      )
      .toBeGreaterThan(1);

    await samples.selectOption({ label: 'Centered row (gap 16px)' });
    await page.keyboard.press('Control+Enter');
    await expect(stage.locator('span')).toHaveCount(3);
    const featured = stage.locator('span').nth(1);
    const before = (await featured.boundingBox())!.width;

    await samples.selectOption({ label: 'Growing featured item' });
    await page.keyboard.press('Control+Enter');
    await expect.poll(async () => (await featured.boundingBox())!.width).toBeGreaterThan(before);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-flex-${platform}.png`),
    });

    await samples.selectOption({ label: 'Featured item first' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(() => featured.evaluate((element) => (element as HTMLElement).style.order))
      .toBe('-1');

    expect((await featured.boundingBox())!.x).toBeLessThan(
      (await stage.locator('span').first().boundingBox())!.x,
    );

    await samples.selectOption({ label: 'Reversed row' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(() => stage.evaluate((element) => (element as HTMLElement).style.flexDirection))
      .toBe('row-reverse');

    await samples.selectOption({ label: 'Fractional flex factors' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(() => featured.evaluate((element) => (element as HTMLElement).style.flexGrow))
      .toBe('0.5');

    const css = await download(page, 'flexbox.css');

    expect(css).toContain('flex: 0.5 0.5 120px');
    expect(JSON.parse(await download(page, 'css-flexbox-report.json')).css).toBe(css);
    await page.getByRole('spinbutton', { exact: true, name: 'Featured item basis' }).fill('801');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('between 0 and 800');
    await expect(page.getByRole('button', { name: 'Download flexbox.css' })).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`CSS Shadow ${platform}: real shadow, preserved opacity, editable layers and strict JSON`, async ({
    page,
  }) => {
    await openTool(page, platform, 'css-box-shadow-generator');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const card = page.locator('[data-css-preview="shadow"]');
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Soft floating card' });
    await page.keyboard.press('Control+Enter');
    await expect(card).toBeVisible();
    await page.getByTestId('input-panel').locator('input[type="color"]').fill('#ff0000');
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('rgba(255, 0, 0, 0.18)');

    await expect
      .poll(() => card.evaluate((element) => getComputedStyle(element).boxShadow))
      .toContain('rgba(255, 0, 0, 0.18)');

    const light = await card.evaluate(
      (element) =>
        getComputedStyle(element.closest('[data-surface]')!.querySelector('[tabindex]')!)
          .backgroundColor,
    );

    await page.getByRole('combobox', { name: 'Preview surface' }).selectOption('dark');
    await expect(page.locator('[data-surface="dark"]')).toBeVisible();

    expect(
      await card.evaluate(
        (element) =>
          getComputedStyle(element.closest('[data-surface]')!.querySelector('[tabindex]')!)
            .backgroundColor,
      ),
    ).not.toBe(light);

    await expect(output).toContainText('rgba(255, 0, 0, 0.18)');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-shadow-${platform}.png`),
    });

    await page.getByRole('slider', { exact: true, name: 'Opacity slider' }).press('Home');
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('rgba(255, 0, 0, 0)');
    await samples.selectOption({ label: 'Inset outline' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(() => card.evaluate((element) => getComputedStyle(element).boxShadow))
      .toContain('inset');

    await page.getByRole('button', { exact: true, name: 'Add layer' }).click();
    await expect(page.getByTestId('input-panel').locator('fieldset')).toHaveCount(2);
    await page.getByRole('button', { name: 'Move up layer 2' }).click();
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('0px 18px 40px -8px');
    const css = await download(page, 'box-shadow.css');

    expect(JSON.parse(await download(page, 'css-shadow-report.json')).css).toBe(css);
    for (let index = 0; index < 3; index += 1)
      await page.getByRole('button', { exact: true, name: 'Add layer' }).click();
    await expect(page.getByRole('button', { exact: true, name: 'Add layer' })).toBeDisabled();
    await expect(page.getByTestId('input-panel').locator('fieldset')).toHaveCount(5);
    await page.getByText('Layer JSON (advanced)', { exact: true }).click();

    await page
      .getByRole('textbox', { name: 'Layer JSON', exact: true })
      .fill('[{"x":0,"y":0,"blur":0,"spread":0,"color":"#12345","inset":false}]');

    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('Shadow color must');
    await expect(page.getByRole('button', { name: 'Download box-shadow.css' })).toHaveCount(0);
    await samples.selectOption({ label: 'Transparent layer' });
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('rgba(0,0,0,0)');
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
