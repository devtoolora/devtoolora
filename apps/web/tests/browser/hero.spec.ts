import { expect, test } from '@playwright/test';

// The worker only reports ready once the GPU has drawn the fully prewarmed field, which takes about
// a minute on the software GPU of headless Chromium.
const LIVE_FIELD_TIMEOUT = 120_000;

test('reduced motion keeps the hero glow without loading the renderer', async ({ page }) => {
  const requests: string[] = [];

  page.on('request', (request) => requests.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('[data-testid="hero-poster"][data-fallback="true"]')).toBeAttached();

  expect(requests.filter((url) => /\/assets\/flowField\.worker-/.test(url))).toEqual([]);
  await expect(page.locator('canvas.devtoolora')).toHaveCount(0);

  const glow = page.getByTestId('hero-poster');

  await expect(glow).toBeVisible();

  expect(await glow.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain(
    'radial-gradient',
  );
});

test('renders the hero canvas at display resolution', async ({ page }) => {
  test.setTimeout(LIVE_FIELD_TIMEOUT + 30_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 862, height: 900 });
  await page.goto('/');
  await expect(page.getByTestId('hero-poster')).toBeVisible();

  // The canvas buffer lives in the worker and is reported through data attributes.
  const field = page.locator('canvas.devtoolora[data-ready="true"]');

  await expect(field).toBeVisible({ timeout: LIVE_FIELD_TIMEOUT });

  const bufferSize = () =>
    field.evaluate((canvas: HTMLCanvasElement) => ({
      bufferHeight: Number(canvas.dataset.bufferHeight),
      bufferWidth: Number(canvas.dataset.bufferWidth),
    }));
  const state = await field.evaluate((canvas: HTMLCanvasElement) => ({
    clientHeight: canvas.clientHeight,
    clientWidth: canvas.clientWidth,
  }));

  expect(state.clientWidth).toBe(862);
  expect(state.clientHeight).toBeGreaterThanOrEqual(900);
  const buffer = await bufferSize();

  expect(buffer.bufferWidth).toBeGreaterThanOrEqual(state.clientWidth);
  expect(buffer.bufferHeight).toBeGreaterThanOrEqual(state.clientHeight);

  await page.setViewportSize({ width: 1200, height: 900 });

  await expect
    .poll(async () => (await bufferSize()).bufferWidth, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(1200);
});

test('live hero leaves the main thread free', async ({ page }) => {
  test.setTimeout(LIVE_FIELD_TIMEOUT + 30_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // A phone viewport: the case that matters, and the cheaper field for the software GPU.
  await page.setViewportSize({ width: 412, height: 915 });

  await page.addInitScript(() => {
    const longTasks: Array<{ duration: number; startTime: number }> = [];

    Object.assign(window, { longTasks });

    new PerformanceObserver((list) => {
      for (const { duration, startTime } of list.getEntries()) {
        longTasks.push({ duration, startTime });
      }
    }).observe({ buffered: true, type: 'longtask' });
  });

  await page.goto('/');

  const field = page.locator('canvas.devtoolora[data-ready="true"]');

  await expect(field).toBeAttached({ timeout: LIVE_FIELD_TIMEOUT });

  const readyAt = await page.evaluate(() => performance.now());

  // Long tasks have no end event to wait for, so sample a fixed window after ready.
  await page.waitForTimeout(2000);

  const longTasks = await page.evaluate(
    () =>
      (window as unknown as { longTasks: Array<{ duration: number; startTime: number }> })
        .longTasks,
  );

  expect(longTasks.filter((task) => task.startTime >= readyAt && task.duration >= 100)).toEqual([]);
});

test('hero keeps the poster when the worker cannot start', async ({ page }) => {
  const requests: string[] = [];

  page.on('request', (request) => requests.push(request.url()));
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.addInitScript(() => {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
  });

  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('[data-testid="hero-poster"][data-fallback="true"]')).toBeAttached();
  await expect(page.locator('canvas.devtoolora')).toHaveCount(0);
  expect(requests.filter((url) => url.includes('/assets/flowField.worker'))).toEqual([]);
  await expect(page.getByTestId('hero-poster')).toBeVisible();
});

test('disables search effects when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const animationNames = await page.evaluate(() => ({
    auroraGlow: getComputedStyle(
      document.querySelector('[data-testid="search-aurora"]')!,
      '::before',
    ).animationName,
    auroraCore: getComputedStyle(
      document.querySelector('[data-testid="search-aurora"]')!,
      '::after',
    ).animationName,
    particle: getComputedStyle(document.querySelector('[data-testid="search-particle"]')!)
      .animationName,
    search: getComputedStyle(document.querySelector('[data-testid="command-search"]')!, '::before')
      .animationName,
  }));

  expect(animationNames).toEqual({
    auroraCore: 'none',
    auroraGlow: 'none',
    particle: 'none',
    search: 'none',
  });
});

test('matches the approved hero proportions, hover inset, ecosystem, and light contrast', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 862, height: 900 });
  await page.goto('/');

  // The schematic overlay is part of the hero above 860 px and hidden by its module below it.
  const overlay = page.getByTestId('technical-overlay');

  await expect(overlay).toBeVisible();

  const layout = await page.evaluate(() => {
    const hero = document.querySelector('[data-testid="hero"]')?.getBoundingClientRect();
    const search = document.querySelector('[data-testid="hero-search"]')?.getBoundingClientRect();
    const panel = document.querySelector('[data-testid="command-search"]')?.getBoundingClientRect();
    const aurora = document.querySelector('[data-testid="search-aurora"]')?.getBoundingClientRect();

    return {
      auroraLeftOverflow: panel && aurora ? panel.left - aurora.left : 0,
      auroraRightOverflow: panel && aurora ? aurora.right - panel.right : 0,
      auroraVerticalOverlap: panel && aurora ? aurora.bottom - panel.top : 0,
      heroHeight: hero?.height ?? 0,
      searchBottom: search?.bottom ?? 0,
      searchTop: search?.top ?? 0,
      searchWidth: search?.width ?? 0,
    };
  });

  expect(layout.heroHeight).toBeGreaterThanOrEqual(900);
  expect(layout.heroHeight).toBeLessThanOrEqual(902);
  expect(layout.searchTop).toBeGreaterThanOrEqual(489);
  expect(layout.searchTop).toBeLessThanOrEqual(491);
  expect(layout.searchBottom).toBeGreaterThanOrEqual(854);
  expect(layout.searchBottom).toBeLessThanOrEqual(856);
  expect(layout.searchWidth).toBeGreaterThanOrEqual(551);
  expect(layout.searchWidth).toBeLessThanOrEqual(553);
  expect(layout.auroraLeftOverflow).toBe(3);
  expect(layout.auroraRightOverflow).toBe(3);
  expect(layout.auroraVerticalOverlap).toBe(4);

  const searchEffects = await page.evaluate(() => ({
    auroraGlowAnimation: getComputedStyle(
      document.querySelector('[data-testid="search-aurora"]')!,
      '::before',
    ).animationName,
    auroraCoreAnimation: getComputedStyle(
      document.querySelector('[data-testid="search-aurora"]')!,
      '::after',
    ).animationName,
    particleAnimation: getComputedStyle(document.querySelector('[data-testid="search-particle"]')!)
      .animationName,
    particleCount: document.querySelectorAll('[data-testid="search-particle"]').length,
    searchAnimation: getComputedStyle(
      document.querySelector('[data-testid="command-search"]')!,
      '::before',
    ).animationName,
  }));

  // Keyframe names carry the CSS-module hash, so match the base name only.
  expect(searchEffects).toEqual({
    auroraCoreAnimation: expect.stringContaining('search-aurora-flow'),
    auroraGlowAnimation: expect.stringContaining('search-aurora-flow'),
    particleAnimation: expect.stringContaining('search-particle-drift'),
    particleCount: 10,
    searchAnimation: expect.stringContaining('search-signal-scan'),
  });

  const firstCategory = page.getByTestId('category-row').first();

  await firstCategory.hover();

  // The hover background transitions in; read it once the transition has started painting.
  await expect
    .poll(() => firstCategory.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe('rgba(0, 0, 0, 0)');

  const iconInset = await firstCategory.evaluate((element) => {
    const row = element.getBoundingClientRect();
    const icon = element.querySelector('[data-testid="category-icon"]')?.getBoundingClientRect();

    return icon ? icon.left - row.left : 0;
  });

  expect(iconInset).toBeGreaterThanOrEqual(12);
  await expect(page.getByTestId('surface-item')).toHaveCount(4);
  await expect(page.getByTestId('shared-core')).toHaveCount(1);

  await page.getByRole('switch', { name: 'Light theme' }).click();
  const lightTheme = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const hero = getComputedStyle(document.querySelector('[data-testid="hero"]')!);

    return {
      heroText: hero.getPropertyValue('--color-text').trim(),
      pageMuted: root.getPropertyValue('--color-muted').trim(),
      pageText: root.getPropertyValue('--color-text').trim(),
    };
  });

  expect(lightTheme).toEqual({
    heroText: '#081722',
    pageMuted: '#475569',
    pageText: '#081722',
  });

  await page.setViewportSize({ width: 1280, height: 1040 });
  const wideLayout = await page.evaluate(() => {
    const copy = document.querySelector('[data-testid="hero-copy"]')?.getBoundingClientRect();
    const search = document.querySelector('[data-testid="hero-search"]')?.getBoundingClientRect();

    return {
      copyBottom: copy?.bottom ?? 0,
      searchTop: search?.top ?? 0,
    };
  });

  expect(wideLayout.copyBottom).toBeLessThanOrEqual(wideLayout.searchTop);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('hero')).toBeVisible();
  await expect(overlay).toBeHidden();
});
