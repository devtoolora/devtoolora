import { expect, test, type Page } from './fixtures';
import { readFileSync } from 'node:fs';
import { pngPixels } from '../../../../tests/browser-helpers/pixels';

async function renderedPng(page: Page): Promise<Buffer> {
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: 'Download rendered.png' }).click();
  const path = await (await pending).path();

  return readFileSync(path);
}

async function render(page: Page, markup: string): Promise<Buffer> {
  await page.locator('textarea').first().fill(markup);
  await page.getByRole('button', { name: /^Run / }).click();

  return renderedPng(page);
}

const blue = [0, 0, 255, 255];
const red = [255, 0, 0, 255];
const transparent = [0, 0, 0, 0];

for (const route of ['/tools/svg-to-png', '/desktop?tool=svg-to-png']) {
  test(`svg-to-png on ${route} draws what the browser draws`, async ({ page }) => {
    await page.goto(route);

    const scene = await render(
      page,
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><g fill="#00f" transform="translate(100 0)"><rect width="100" height="100"/></g><text x="10" y="50" font-size="30" fill="#000">Hello</text><ellipse cx="50" cy="80" rx="40" ry="15" fill="#f00"/></svg>',
    );

    expect(
      await pngPixels(page, scene, [
        [150, 50],
        [50, 80],
        [5, 5],
      ]),
    ).toEqual([blue, red, transparent]);

    const textRow = await pngPixels(
      page,
      scene,
      Array.from({ length: 80 }, (_, x): [number, number] => [x + 10, 40]),
    );

    expect(textRow.some(([, , , alpha]) => alpha > 200)).toBe(true);

    // fill="none" and stroke on the root, as in an icon set, without the xmlns inline markup omits.
    const icon = await render(
      page,
      '<svg width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    );

    expect(
      await pngPixels(page, icon, [
        [90, 170],
        [140, 90],
      ]),
    ).toEqual([[0, 0, 0, 255], transparent]);

    const styled = await render(
      page,
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><style>.a{fill:#f00}</style><defs><linearGradient id="g"><stop stop-color="#00f"/></linearGradient></defs><rect class="a" width="10" height="10"/><rect x="10" width="10" height="10" fill="url(#g)"/></svg>',
    );

    expect(
      await pngPixels(page, styled, [
        [5, 5],
        [15, 5],
      ]),
    ).toEqual([red, blue]);

    await page.getByRole('spinbutton', { name: 'Max width' }).fill('100');
    const scaled = await render(
      page,
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect x="10" width="10" height="10" fill="#f00"/></svg>',
    );

    expect(
      await pngPixels(page, scaled, [
        [75, 25],
        [25, 25],
      ]),
    ).toEqual([red, transparent]);
  });
}

test('svg-to-png names malformed markup instead of drawing a part of it', async ({ page }) => {
  await page.goto('/tools/svg-to-png');

  await page
    .locator('textarea')
    .first()
    .fill('<svg xmlns="http://www.w3.org/2000/svg"><rect></svg>');

  await page.getByRole('button', { name: /^Run / }).click();

  await expect(page.getByText(/could not render this SVG/)).toBeVisible();
});

test('svg-to-png runs from an uploaded file alone', async ({ page }) => {
  await page.goto('/tools/svg-to-png');
  const run = page.getByRole('button', { name: /^Run / });

  await expect(run).toBeDisabled();

  await page.getByLabel('SVG file (optional)').setInputFiles({
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#f00"/></svg>',
    ),
    mimeType: 'image/svg+xml',
    name: 't.svg',
  });

  await run.click();

  expect(await pngPixels(page, await renderedPng(page), [[2, 2]])).toEqual([red]);
});
