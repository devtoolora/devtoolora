import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { contentOf } from './toolContent';
import { rangedNumber, rangeField } from '../src/adapters/fields';
import { result } from './tools.helpers';

const toolIds: string[] = [
  'css-gradient-generator',
  'css-text-shadow-generator',
  'css-filter-generator',
  'css-transform-generator',
  'css-glassmorphism-generator',
  'css-neumorphism-generator',
  'css-cubic-bezier-generator',
  'css-loader-generator',
  'css-clamp-generator',
  'css-unit-converter',
  'aspect-ratio-calculator',
  'css-specificity-calculator',
];

describe('CSS design generators and calculators', () => {
  it('documents every tool and runs each of its six samples', async () => {
    for (const id of toolIds) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.ok((contentOf(tool).documentation?.length ?? 0) >= 2, id);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) >= 4, id);
      assert.equal(tool.samples?.length, 6, id);
      const fieldIds = new Set(tool.fields?.map((field) => field.id));

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).filter((key) => !fieldIds.has(key)),
          [],
          `${id}: ${sample.label}`,
        );

        const output = await result(id, sample.text ?? '', {
          ...Object.fromEntries(
            (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
          ),
          ...sample.fields,
        });

        assert.ok(output.text.length > 0, `${id}: ${sample.label}`);
        assert.ok((output.summary ?? '').length > 0, `${id}: ${sample.label}`);
      }
    }
  });

  it('reports reordered gradient stops and sets the alias gradient type', async () => {
    const output = await result('css-gradient-generator', '', {
      stops: '[{"color":"red","position":100},{"color":"blue","position":0}]',
    });

    assert.match(output.text, /blue 0%, red 100%/);
    assert.match(output.summary ?? '', /order changed/);
    for (const [id, type] of [
      ['radial-gradient-generator', 'radial'],
      ['conic-gradient-generator', 'conic'],
    ])
      assert.equal(
        listBrowserWorkerTools()
          .find((tool) => tool.id === id)
          ?.fields?.find((field) => field.id === 'type')?.defaultValue,
        type,
      );
  });

  it('defaults the backdrop alias to the backdrop-filter target', () => {
    const alias = listBrowserWorkerTools().find(
      (tool) => tool.id === 'css-backdrop-filter-generator',
    );

    assert.equal(
      alias?.fields?.find((field) => field.id === 'target')?.defaultValue,
      'backdrop-filter',
    );

    assert.ok(alias?.samples?.every((sample) => sample.fields?.target === 'backdrop-filter'));
  });

  it('rejects out-of-range custom bezier points and names keyword presets', async () => {
    for (const [id, value] of [
      ['x1', '1.01'],
      ['y1', '2.01'],
    ] as const)
      await assert.rejects(
        result('css-cubic-bezier-generator', '', { preset: 'custom', [id]: value }),
        /must be a number between/,
        id,
      );

    const keyword = await result('css-cubic-bezier-generator', '', { preset: 'ease-in-out' });

    assert.match(keyword.text, /cubic-bezier\(0\.42, 0, 0\.58, 1\)/);
    assert.match(keyword.summary ?? '', /ease-in-out/);
  });

  it('keeps the easing point rows visible and fills them from preset samples', () => {
    const tool = listBrowserWorkerTools().find(
      (entry) => entry.id === 'css-cubic-bezier-generator',
    );
    const pointIds = ['x1', 'y1', 'x2', 'y2'];
    const spring = tool?.samples?.find((sample) => sample.label === 'Spring out');

    assert.deepEqual(
      tool?.fields?.filter((field) => pointIds.includes(field.id) && field.visibleWhen),
      [],
    );

    assert.deepEqual(
      pointIds.map((id) => spring?.fields?.[id]),
      ['0.34', '1.56', '0.64', '1'],
    );
  });

  it('keeps the neumorphism example colors equal to the tool output', async () => {
    const tool = listBrowserWorkerTools().find((entry) => entry.id === 'css-neumorphism-generator');
    const printed = new Set<string>();

    for (const sample of tool?.samples ?? []) {
      const output = await result('css-neumorphism-generator', '', {
        ...Object.fromEntries(
          (tool?.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
        ),
        ...sample.fields,
      });

      output.text.match(/#[0-9a-f]{6}/g)?.forEach((hex) => printed.add(hex));
    }

    const quoted = (tool ? (contentOf(tool).examples ?? []) : []).flatMap(
      (example) => example.match(/#[0-9a-f]{6}/g) ?? [],
    );

    assert.deepEqual(
      quoted.filter((hex) => !printed.has(hex)),
      [],
    );
  });

  it('draws the default loader track dark enough to read on a light page', async () => {
    const loader = await result('css-loader-generator', '', {});

    assert.match(loader.text, /border: 4px solid #cbd5e1;/);
  });

  it('prints the calculators as aligned text with the spec values', async () => {
    const clamp = await result('css-clamp-generator', '', { unit: 'px' });

    assert.ok(
      clamp.text.startsWith(
        '.fluid-type {\n  font-size: clamp(16px, 10.6667px + 1.6667vw, 32px);\n}',
      ),
    );

    assert.equal(Buffer.from(clamp.artifact?.base64 ?? '', 'base64').toString('utf8'), clamp.text);

    assert.equal(clamp.artifact?.fileName, 'fluid-type.css');

    const stripes = await result('css-gradient-generator', '', {
      ...(listBrowserWorkerTools()
        .find((tool) => tool.id === 'css-gradient-generator')
        ?.samples?.find((entry) => entry.label === 'Repeating stripes')?.fields ?? {}),
    });

    assert.match(stripes.text, /20%/);
    assert.match(stripes.text, /40%/);

    await assert.rejects(
      result('css-clamp-generator', '', { minSize: '40' }),
      /Minimum size must be smaller than maximum size\./,
    );

    const units = await result('css-unit-converter', '', {});

    assert.match(units.text, /1\.5rem/);
    assert.match(units.text, /1\.6667vw/);

    const ratio = await result('aspect-ratio-calculator', '', { height: '768', width: '1366' });

    assert.match(ratio.text, /683:384/);
    assert.match(ratio.text, /16:9 \(\+0\.0488 %\)/);
    assert.match(ratio.text, /aspect-ratio: 683 \/ 384;\n\s+padding-top: 56\.2225%;/);
    assert.doesNotMatch(ratio.text, /Height|Width/);

    const solved = await result('aspect-ratio-calculator', '', {
      solveFor: 'height',
      targetWidth: '1280',
    });

    assert.match(solved.text, /Height\s+720/);
  });

  it('tabulates specificity and fails only when every selector is invalid', async () => {
    const output = await result('css-specificity-calculator', '#nav .item > a:hover\ndiv[\n.a, #b');

    assert.equal(
      output.text,
      [
        'a,b,c  Selector',
        '1,2,1  #nav .item > a:hover',
        'error  div[ — Missing "]" to close the attribute selector.',
        '0,1,0  .a',
        '1,0,0  #b',
        '',
      ].join('\n'),
    );

    assert.match(
      output.summary ?? '',
      /^4 selectors, 1 invalid\. Highest: #nav \.item > a:hover \(1,2,1\)\./,
    );

    const long = await result('css-specificity-calculator', `.ok\n:is(${'a'.repeat(3000)}`);

    assert.match(
      long.text,
      /^error {2}:is\(a{116}… — Selectors are limited to 2,000 characters\.$/m,
    );

    // 109 code points but 213 UTF-16 units: short enough to show in full.
    const emoji = await result('css-specificity-calculator', `.ok\n:is(.${'😀'.repeat(104)}`);

    assert.match(emoji.text, new RegExp(`^error {2}:is\\(\\.${'😀'.repeat(104)} — `, 'mu'));

    const tie = await result('css-specificity-calculator', '.first, .second');

    assert.match(tie.summary ?? '', /Highest: \.first \(0,1,0\)/);

    await assert.rejects(result('css-specificity-calculator', 'div[\n.a &'), /No valid selector/);
  });

  it('keeps the alias map and the catalog totals', () => {
    const tools = listBrowserWorkerTools();
    const aliases = Object.fromEntries(
      tools.filter((tool) => tool.aliasOf).map((tool) => [tool.id, tool.aliasOf]),
    );

    for (const [id, target] of Object.entries({
      'css-backdrop-filter-generator': 'css-filter-generator',
      'conic-gradient-generator': 'css-gradient-generator',
      'radial-gradient-generator': 'css-gradient-generator',
    }))
      assert.equal(aliases[id], target, id);
  });
});

describe('rangedNumber decimals', () => {
  const field = (step: number) =>
    rangeField({ defaultValue: '1', id: 'v', label: 'Value', max: 10, min: 0, step });

  it('enforces the decimals implied by the step', () => {
    assert.equal(rangedNumber(field(0.01), { v: '1.25' }), 1.25);
    assert.throws(() => rangedNumber(field(0.01), { v: '1.255' }), /up to 2 decimals/);
    assert.throws(() => rangedNumber(field(0.1), { v: '0.25' }), /up to 1 decimals/);
    assert.throws(() => rangedNumber(field(1), { v: '1.5' }), /whole number/);
  });
});
