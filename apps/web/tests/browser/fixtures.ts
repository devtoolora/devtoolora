import { test as base, type Locator, type Page } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

// React Router imports its client entry dynamically, so the load event can fire before the
// prerendered page hydrates, and input sent in that gap is lost.
async function waitForHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

export const test = base.extend({
  page: async ({ page }, providePage) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);

    page.goto = async (url, options) => {
      const response = await goto(url, options);

      await waitForHydration(page);

      return response;
    };

    page.reload = async (options) => {
      const response = await reload(options);

      await waitForHydration(page);

      return response;
    };

    await providePage(page);
  },
});

export const platforms = ['web', 'desktop'] as const;

type Platform = (typeof platforms)[number];

export async function openTool(page: Page, platform: Platform, id: string): Promise<void> {
  await page.goto(platform === 'web' ? `/tools/${id}` : `/desktop?tool=${id}`);
}

export async function openToolWithSample(
  page: Page,
  platform: Platform,
  id: string,
  sample?: string,
): Promise<void> {
  await openTool(page, platform, id);

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption(sample === undefined ? { index: 1 } : { label: sample });
}

export const toolGuide = (page: Page, platform: Platform): Locator =>
  page.locator(
    platform === 'web' ? '[data-testid="tool-information"]' : '[data-testid="conversion-help"]',
  );

export const toolInput = (page: Page): Locator =>
  page.getByTestId('primary-input').locator('textarea');

export const toolOutput = (page: Page): Locator => page.getByTestId('output-panel').locator('code');
