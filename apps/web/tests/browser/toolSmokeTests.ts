import { expect, openTool, platforms, test, toolInput, toolOutput, type Page } from './fixtures';

interface FieldSetup {
  kind: 'number' | 'segmented' | 'select' | 'text';
  label: RegExp;
  value: string;
}

export interface SmokeTool {
  alert?: RegExp;
  autoRun?: boolean;
  fields?: FieldSetup[];
  id: string;
  inputless?: boolean;
  invalidText?: string;
  name: string;
  oversizeInput?: number;
  result?: RegExp;
  runLabel?: RegExp;
}

async function setField(page: Page, field: FieldSetup): Promise<void> {
  if (field.kind === 'segmented') {
    await page
      .getByRole('group', { name: field.label })
      .getByRole('button', { name: field.value })
      .click();
  } else if (field.kind === 'select') {
    await page.getByRole('combobox', { name: field.label }).selectOption(field.value);
  } else if (field.kind === 'number') {
    await page.getByRole('spinbutton', { name: field.label }).fill(field.value);
  } else {
    await page.getByRole('textbox', { name: field.label }).fill(field.value);
  }
}

export function defineToolSmokeTests(category: string, tools: SmokeTool[]): void {
  for (const platform of platforms) {
    for (const tool of tools) {
      test(`${category} ${platform}: ${tool.id}`, async ({ page }) => {
        await openTool(page, platform, tool.id);
        const run = page.getByRole('button', {
          exact: true,
          name: tool.runLabel ?? `Run ${tool.name}`,
        });
        const output = toolOutput(page);
        const input = toolInput(page);

        await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });

        if (!tool.autoRun) await run.click();

        if (tool.result) {
          // OCR compiles its wasm first and can outlast the default wait on a loaded host.
          await expect(page.getByRole('region', { name: 'Result' })).toContainText(tool.result, {
            timeout: 20_000,
          });
        } else {
          await expect
            .poll(async () => (await output.textContent())?.length ?? 0)
            .toBeGreaterThan(0);
        }

        if (tool.alert) {
          if (tool.oversizeInput) {
            await input.evaluate((element: HTMLTextAreaElement, length: number) => {
              const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype,
                'value',
              )?.set;

              setter?.call(element, 'x'.repeat(length));
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }, tool.oversizeInput);
          } else {
            for (const field of tool.fields ?? []) await setField(page, field);

            if (tool.inputless) await expect(input).toHaveCount(0);
            else await input.fill(tool.invalidText ?? '');
          }

          if (!tool.autoRun) await run.click();

          await expect(page.getByRole('alert')).toContainText(tool.alert);
        }

        await page.setViewportSize({ height: 844, width: 390 });

        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
    }
  }
}
