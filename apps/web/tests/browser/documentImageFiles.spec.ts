import { expect, openTool, openToolWithSample, platforms, test, type Page } from './fixtures';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const fileTool = (id: string, name: string, result: RegExp): SmokeTool => ({
  autoRun: true,
  id,
  inputless: true,
  name,
  result,
});

const tools: SmokeTool[] = [
  fileTool('xlsx-to-csv', 'XLSX to CSV & JSON', /Name,Team,Joined,Hours,Billable/),
  {
    autoRun: true,
    id: 'csv-to-xlsx',
    name: 'CSV & JSON to XLSX',
    result: /Wrote 4 rows × 5 columns to "Sheet1"/,
  },
  fileTool('docx-to-text', 'DOCX to Text & Markdown', /Sprint/),
  fileTool('pdf-text-extractor', 'PDF Text Extractor', /Quarterly report/),
  fileTool(
    'pdf-form-filler',
    'PDF Form Filler',
    /3 form fields[\s\S]*fullName[\s\S]*country[\s\S]*size/,
  ),
  fileTool('pdf-crop-resize', 'PDF Crop & Resize', /Cropped 4 pages;/),
  fileTool('pdf-signature-inspector', 'PDF Signature Inspector', /Sample Signer/),
  fileTool(
    'sprite-sheet-generator',
    'CSS Sprite Sheet Generator',
    /6 images packed into 51×67 px[\s\S]*\.sprite-home/,
  ),
];

defineToolSmokeTests('Document and image files', tools);

const run = (page: Page) => page.getByRole('button', { name: /^Run / }).click();
const annotateSample = 'Annotate (label, box & redaction)';

for (const platform of platforms) {
  test(`Document and image files ${platform}: social media resizer exports a 1080x1080 JPEG`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'social-media-image-resizer');
    await run(page);
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('Processed 1 image.');

    const pending = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download images.zip' }).click();
    const path = await (await pending).path();
    const names = Object.keys(unzipSync(new Uint8Array(readFileSync(path))));

    expect(names.some((name) => name.endsWith('-1080x1080.jpg'))).toBe(true);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test(`Document and image files ${platform}: svg placeholder offers a PNG download`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'svg-placeholder');
    await page.getByRole('combobox', { name: 'Format' }).selectOption('png');
    await run(page);

    await expect(
      page.getByRole('button', { name: 'Download placeholder-1200x630.png' }),
    ).toBeVisible();

    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test(`Document and image files ${platform}: sprite sheet shows a preview`, async ({ page }) => {
    await openToolWithSample(page, platform, 'sprite-sheet-generator');
    await expect(page.getByTestId('result-preview').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('.sprite-home');
  });

  test(`Document and image files ${platform}: image tools annotate sample shows a preview`, async ({
    page,
  }) => {
    await openTool(page, platform, 'image-tools');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: annotateSample });

    await run(page);
    await expect(page.getByTestId('result-preview').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('annotate complete.');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('Document and image files: pdf form filler recovers after bad JSON', async ({ page }) => {
  await openToolWithSample(page, 'web', 'pdf-form-filler');
  await page.getByRole('group', { name: 'Action' }).getByRole('button', { name: 'Fill' }).click();
  const values = page.getByRole('textbox', { name: 'Values' });

  await expect(page.getByRole('alert')).toHaveCount(0);

  await values.fill('{nope');
  await expect(page.getByRole('alert')).toContainText('Values must be a JSON object');
  await values.fill('{"fullName": "Ada"}');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Result' })).toContainText('Filled 1 of 3 fields.');
  await expect(page.getByRole('button', { name: 'Download document-filled.pdf' })).toBeVisible();
});

test('Document and image files: image tools recovers after a bad annotation command', async ({
  page,
}) => {
  await page.goto('/tools/image-tools');

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: annotateSample });

  const commands = page.getByRole('textbox', { name: /Annotations/ });

  await commands.fill('bogus 1 2 3');
  await run(page);
  await expect(page.getByRole('alert')).toContainText('Line 1: unknown command "bogus"');
  await commands.fill('label 2 2 Note');
  await run(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('result-preview').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Result' })).toContainText('annotate complete.');
});

test('Document and image files: xlsx-to-csv rejects a non-xlsx file and recovers', async ({
  page,
}) => {
  await page.goto('/tools/xlsx-to-csv');

  await page.locator('input[type=file]').setInputFiles({
    buffer: Buffer.from('not a workbook'),
    mimeType: 'text/plain',
    name: 'bad.xlsx',
  });

  await expect(page.getByRole('alert')).toContainText('This is not a .xlsx file.');
  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });
  await expect(page.getByRole('alert')).toHaveCount(0);

  await expect(page.getByRole('region', { name: 'Result' })).toContainText(
    'Name,Team,Joined,Hours,Billable',
  );
});
