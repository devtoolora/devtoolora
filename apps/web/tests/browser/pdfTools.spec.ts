import { expect, openTool, platforms, test, toolGuide, type Page } from './fixtures';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { threePagePdf } from '../../../../tests/browser-helpers/pdf';

async function download(page: Page, fileName: string): Promise<Buffer> {
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
  const saved = await pending;

  expect(saved.suggestedFilename()).toBe(fileName);
  const path = await saved.path();

  if (!path) throw new Error(`${fileName} was not saved.`);

  return readFileSync(path);
}

for (const platform of platforms) {
  const guide = (page: Page) => toolGuide(page, platform);

  test(`PDF Pages ${platform}: thumbnails pick, reorder, split and rotate pages and keep the page fields in sync`, async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));
    await openTool(page, platform, 'pdf-toolkit');
    if (platform === 'desktop') await guide(page).locator('summary').click();

    await expect(guide(page).locator('h3')).toHaveText([
      'What can PDF Pages do?',
      'When to use PDF Pages',
      'Writing page selections',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const summary = page.getByTestId('result-summary');
    const pages = page.getByLabel('PDF pages');

    await samples.selectOption({ label: 'Merge a report and its appendix' });
    const files = page.getByLabel('Files to merge');

    await expect(files.locator('li')).toHaveCount(2);
    await expect(files.locator('li').first()).toContainText('1. quarterly-report.pdf');
    await expect(files.locator('li').first()).toContainText('4 pages');
    await expect(files.locator('li img')).toHaveCount(2);
    await page.getByRole('button', { exact: true, name: 'Move appendix.pdf up' }).click();
    await expect(files.locator('li').first()).toContainText('1. appendix.pdf');
    await expect(summary).toContainText('Merged 2 files in the order shown');
    const merged = await PDFDocument.load(await download(page, 'merged.pdf'), {
      updateMetadata: false,
    });

    expect(merged.getPageCount()).toBe(6);
    expect(merged.getPage(0).getWidth()).toBe(612);
    expect(merged.getTitle()).toBe('Appendix');

    await samples.selectOption({ label: 'Delete pages 2-3' });
    const selection = page.getByLabel('Pages', { exact: true });

    await expect(pages.locator('img')).toHaveCount(4);

    await expect(pages.getByRole('button', { exact: true, name: 'Page 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await pages.getByRole('button', { exact: true, name: 'Page 4' }).click();
    await expect(selection).toHaveValue('2-4');
    await expect(summary).toContainText('Deleted pages 2-4 of 4');
    await pages.getByRole('button', { exact: true, name: 'Clear' }).click();
    await pages.getByRole('button', { exact: true, name: 'Page 1' }).click();

    await pages
      .getByRole('button', { exact: true, name: 'Page 3' })
      .click({ modifiers: ['Shift'] });

    await expect(selection).toHaveValue('1-3');
    await expect(pages.getByRole('status')).toHaveText('3 of 4 pages will be deleted.');
    await expect(summary).toContainText('Deleted pages 1-3 of 4');

    expect(
      (await PDFDocument.load(await download(page, 'quarterly-report-edited.pdf'))).getPageCount(),
    ).toBe(1);

    await selection.fill('2, last');

    await expect(pages.getByRole('button', { exact: true, name: 'Page 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await expect(pages.getByRole('button', { exact: true, name: 'Page 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await samples.selectOption({ label: 'Move the last page to the front' });
    const order = page.getByLabel('New page order', { exact: true });

    await expect(pages.getByRole('img', { name: 'Page 4, position 1' })).toBeVisible();

    await pages
      .getByRole('img', { name: 'Page 3, position 4' })
      .dragTo(pages.getByRole('img', { name: 'Page 4, position 1' }));

    await expect(order).toHaveValue('3-4, 1-2');
    await pages.getByRole('button', { exact: true, name: 'Leave out page 1' }).click();
    await expect(order).toHaveValue('3-4, 2');
    await pages.getByRole('button', { exact: true, name: 'Add page 1 back' }).click();
    await pages.getByRole('button', { exact: true, name: 'Move page 1 earlier' }).click();
    await expect(order).toHaveValue('3-4, 1-2');
    await expect(summary).toContainText('New order 3-4, 1-2');
    const reordered = await PDFDocument.load(
      await download(page, 'quarterly-report-reordered.pdf'),
    );

    expect(reordered.getPageCount()).toBe(4);
    await pages.getByRole('button', { exact: true, name: 'Reverse' }).click();
    await expect(order).toHaveValue('2, 1, 4, 3');

    await samples.selectOption({ label: 'Split into 2-page files' });
    await expect(pages.getByRole('img', { name: 'Page 3, file 2' })).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Custom ranges' }).click();
    await page.getByLabel('Ranges', { exact: true }).fill('1, 3-');
    await expect(pages.getByRole('img', { name: 'Page 2, not exported' })).toBeVisible();
    await expect(pages.getByRole('status')).toHaveText('2 files; page 2 is not in any range.');
    await expect(summary).toContainText('Split 4 pages into 2 files');

    await samples.selectOption({ label: 'Rotate even pages 90° right' });

    await expect(pages.getByRole('button', { exact: true, name: 'Page 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await expect(pages.getByRole('button', { exact: true, name: 'Page 2' })).toHaveAttribute(
      'data-rotation',
      '90',
    );

    expect(
      await pages
        .getByRole('button', { exact: true, name: 'Page 2' })
        .locator('img')
        .evaluate((image) => getComputedStyle(image).transform),
    ).not.toBe('none');

    await pages.getByRole('button', { exact: true, name: 'Page 1' }).click();
    await expect(page.getByLabel('Pages to rotate', { exact: true })).toHaveValue('1-2, 4');
    await page.getByRole('button', { exact: true, name: '90° left' }).click();
    await expect(summary).toContainText('Rotated pages 1-2, 4 of 4 90° left');
    const rotated = await PDFDocument.load(await download(page, 'quarterly-report-rotated.pdf'));

    expect(rotated.getPages().map((item) => item.getRotation().angle)).toEqual([270, 270, 0, 270]);

    await page.screenshot({ fullPage: true, path: `test-results/pdf-pages-${platform}.png` });
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    expect(errors).toEqual([]);
  });

  test(`PDF Page Numbers ${platform}: live stamped page preview, placeholder errors and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'pdf-page-numbers');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const preview = page.getByLabel('Stamped page preview');

    await samples.selectOption({ label: 'Number from page 2, skip the cover' });

    await expect(
      preview.getByRole('img', { name: 'Page 1 with the header, footer and watermark' }),
    ).toBeVisible();

    await expect(preview.locator('img')).toHaveCount(4);
    await expect(preview).toContainText('First 4 of 4 pages');
    const stamped = await PDFDocument.load(await download(page, 'quarterly-report-stamped.pdf'));

    expect(stamped.getPageCount()).toBe(4);
    await page.getByLabel('Footer', { exact: true }).fill('Page {page}');
    await expect(page.getByRole('alert')).toContainText('{page} is not a placeholder');
    await expect(preview.locator('ol')).toHaveAttribute('data-stale', 'true');
    await page.getByLabel('Footer', { exact: true }).fill('Page {n} of {total}');
    await expect(preview.locator('ol')).toHaveAttribute('data-stale', 'false');
    await expect(page.getByTestId('result-summary')).toContainText('pages 2-4');
    await samples.selectOption({ label: 'Logo image watermark' });

    await expect(page.getByTestId('result-summary')).toContainText(
      'Added image watermark at 25% to all 4 pages',
    );

    await expect(page.getByLabel('Image width (% of page)', { exact: true })).toHaveValue('50');
  });
}

test('PDF Pages web: add more PDFs to merge from the thumbnail list', async ({ page }) => {
  await page.goto('/tools/pdf-toolkit');

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: 'Merge a report and its appendix' });

  await page.getByLabel('Add PDF files').setInputFiles({
    buffer: await threePagePdf(),
    mimeType: 'application/pdf',
    name: 'letters.pdf',
  });

  const files = page.getByLabel('Files to merge');

  await expect(files.locator('li')).toHaveCount(3);
  await expect(files.locator('li').nth(2)).toContainText('3. letters.pdf');
  await expect(files.locator('li').nth(2)).toContainText('3 pages');
  await files.getByRole('button', { exact: true, name: 'Remove quarterly-report.pdf' }).click();
  await expect(files.locator('li')).toHaveCount(2);
  await expect(page.getByTestId('result-summary')).toContainText('Merged 2 files');
  const merged = await PDFDocument.load(await download(page, 'merged.pdf'));

  expect(merged.getPageCount()).toBe(5);
});

test('PDF Pages web: drag a file to change the merge order', async ({ page }) => {
  await page.goto('/tools/pdf-toolkit');

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: 'Merge a report and its appendix' });

  const files = page.getByLabel('Files to merge').locator('li');

  await expect(files).toHaveCount(2);
  await files.nth(1).dragTo(files.nth(0));
  await expect(files.first()).toContainText('1. appendix.pdf');
  await expect(files.nth(1)).toContainText('2. quarterly-report.pdf');
  await expect(files.first()).toHaveAttribute('data-drop', 'false');

  await expect(page.getByTestId('result-summary')).toContainText(
    'Merged 2 files in the order shown',
  );
});

test('PDF aliases open the matching operation with page thumbnails', async ({ page }) => {
  await page.goto('/tools/pdf-delete-pages');
  await expect(page.getByLabel('Operation', { exact: true })).toHaveValue('delete');
  await page.goto('/tools/pdf-watermark');
  await expect(page.getByLabel('Watermark', { exact: true })).toHaveValue('DRAFT');
});
