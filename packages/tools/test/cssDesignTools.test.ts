import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cssDesignTools } from '../src/catalog/cssDesign';

const tool = (id: string) => cssDesignTools.find((candidate) => candidate.id === id)!;
const run = async (id: string, fields: Record<string, string> = {}, text = '') =>
  tool(id).run({ fields, text });

describe('CSS & Design tool adapters', () => {
  it('rejects a bare hex color that color-mix() would drop', async () => {
    await assert.rejects(run('color-mixer', { colorA: '2563eb' }), /needs its #/);
    await assert.rejects(run('color-mixer', { colorB: 'f97316' }), /needs its #/);
    assert.match((await run('color-mixer', { colorA: 'red' })).text, /color-mix\(in oklch, red /);
  });

  it('converts common rem values and fractional font sizes', async () => {
    for (const [value, px] of [
      ['0.875', '14px'],
      ['0.125', '2px'],
      ['1.125', '18px'],
      ['0.0625', '1px'],
    ] as const)
      assert.match(
        (await run('css-unit-converter', { unit: 'rem', value })).text,
        new RegExp(` ${px}\\n`),
      );

    assert.match(
      (await run('css-unit-converter', { parentFontSize: '17.6', unit: 'em', value: '1' })).text,
      / 17\.6px\n/,
    );

    await assert.rejects(run('css-unit-converter', { value: '0.00001' }), /up to 4 decimals/);

    await assert.rejects(
      run('css-unit-converter', { viewportWidth: '1440.5' }),
      /Viewport width must be a whole number/,
    );
  });

  it('warns when the Pulse preset has nothing to animate', async () => {
    const pulse = (scale: string) => run('css-keyframes-generator', { preset: 'pulse', scale });

    assert.match((await pulse('90')).summary ?? '', /Pulse needs a Scale from above 100%/);
    assert.doesNotMatch((await pulse('105')).summary ?? '', /Pulse needs/);

    assert.doesNotMatch(
      (await run('css-keyframes-generator', { preset: 'fade-up', scale: '90' })).summary ?? '',
      /Pulse needs/,
    );
  });

  it('keeps the exact-value promise to colors that fit in sRGB', async () => {
    const wide = await run('color-scale-generator', {}, 'oklch(70% 0.4 150)');
    const fitting = await run('color-scale-generator', {}, '#2563eb');

    assert.match(wide.summary ?? '', /outside sRGB/);
    assert.doesNotMatch(wide.summary ?? '', /exact value/);
    assert.match(fitting.summary ?? '', /keeps its exact value/);
  });

  it('gives each gradient alias only samples of its own type', () => {
    for (const [id, type] of [
      ['radial-gradient-generator', 'radial'],
      ['conic-gradient-generator', 'conic'],
    ] as const) {
      const samples = tool(id).samples ?? [];

      assert.ok(samples.length > 0, id);

      assert.ok(
        samples.every((sample) => sample.fields?.type === type),
        id,
      );
    }
  });
});
