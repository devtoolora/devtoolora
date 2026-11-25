import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  for (const id of ['slugify', 'case-convert']) {
    test(`Text naming ${id} ${platform}: Unicode, honest controls, exact artifacts, empty output and recovery`, async ({
      page,
    }) => {
      const isSlug = id === 'slugify';

      await openTool(page, platform, id);
      const run = page.getByRole('button', {
        exact: true,
        name: isSlug ? 'Run Slugify' : 'Run Case Converter',
      });
      const samples = page.getByRole('combobox', { name: 'Apply sample' });
      const output = toolOutput(page);

      if (isSlug) {
        await expect(page.getByRole('checkbox', { name: 'Remove Latin accents' })).toHaveCount(0);
        await samples.selectOption({ label: 'Latin letters beyond accent marks' });
        await run.click();
        await expect(output).toHaveText('strasse-aesir-lodz-oresund-oeuvre');
        await samples.selectOption({ label: 'Keep Czech accents' });

        await expect(
          page.getByRole('checkbox', { name: 'Remove Latin accents' }),
        ).not.toBeChecked();

        await run.click();
        await expect(output).toHaveText('příliš-žluťoučký-kůň-42');
        await samples.selectOption({ label: 'Keep non-Latin scripts' });
        await run.click();
        await expect(output).toHaveText('你好-世界-नमस्ते-दुनिया');
      } else {
        await samples.selectOption({ label: 'Acronyms and numeric word parts' });
        await run.click();
        await expect(output).toHaveText('xml_http_request_version2_value_api_response_code');
        await samples.selectOption({ label: 'Preserve punctuation and line endings' });
        await expect(page.getByRole('checkbox', { name: 'Remove Latin accents' })).toHaveCount(0);
        await run.click();
        await expect(output).toHaveText('PŘÍLIŠ ŽLUŤOUČKÝ, WORLD!\nNEXT LINE: STRASSE 42.');
        await samples.selectOption({ label: 'Turkish dotted and dotless I' });
        await run.click();
        await expect(output).toHaveText('istanbul ı');
      }

      const converted = await output.textContent();
      const fileName = isSlug ? 'slug.txt' : 'converted-case.txt';
      const saving = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
      const path = await (await saving).path();

      if (!path) throw new Error('Naming result was not saved.');

      expect(readFileSync(path, 'utf8')).toBe(converted);

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`${id}-${platform}.png`),
      });

      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      if (isSlug) {
        await page.getByRole('button', { exact: true, name: 'ASCII' }).click();
        await run.click();
        await expect(page.getByRole('alert')).toContainText('Choose Unicode');
        await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
        await samples.selectOption({ label: 'Case-preserving underscore name' });
        await run.click();
        await expect(output).toHaveText('Release_Build_Alpha');
        await samples.selectOption({ label: 'French with accents' });
        await run.click();
        await expect(output).toHaveText('creme-brulee-a-la-vanille-42');
      } else {
        await samples.selectOption({ label: 'Alternate letters not spaces' });
        await run.click();
        await expect(output).toHaveText('aB 42 😀 cD');
        await toolInput(page).fill('');
        await expect(run).toBeEnabled();
        await run.click();
        await expect(page.getByTestId('result-summary')).toContainText('empty result');
        const emptySaving = page.waitForEvent('download');

        await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
        const emptyPath = await (await emptySaving).path();

        if (!emptyPath) throw new Error('Empty case result was not saved.');

        expect(readFileSync(emptyPath)).toHaveLength(0);
      }

      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveText([
        isSlug ? 'What is a slug?' : 'What is case conversion?',
        isSlug ? 'When to slugify text' : 'When to convert text case',
        'How to use it',
        'Examples',
        'Notes',
      ]);
    });
  }
}
