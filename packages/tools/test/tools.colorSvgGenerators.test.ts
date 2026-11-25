import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const toolIds = [
  'color-scale-generator',
  'color-mixer',
  'color-name-lookup',
  'color-blindness-palette-simulator',
  'mesh-gradient-generator',
  'svg-blob-generator',
  'svg-wave-generator',
  'svg-pattern-generator',
  'svg-to-data-uri',
  'barcode-generator',
];

describe('color and SVG generators', () => {
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

  it('keeps the alias map', () => {
    const aliases = Object.fromEntries(
      listBrowserWorkerTools()
        .filter((tool) => tool.aliasOf)
        .map((tool) => [tool.id, tool.aliasOf]),
    );

    for (const [id, target] of Object.entries({
      'ean-13-barcode-generator': 'barcode-generator',
      'svg-to-css-background': 'svg-to-data-uri',
      'svg-to-jsx': 'svg-to-data-uri',
    }))
      assert.equal(aliases[id], target, id);
  });

  it('adds APCA Lc to the color palette report', async () => {
    const report = JSON.parse((await result('color-palette', '#2563eb')).text);

    assert.equal(report.apcaOnWhite, 74.9);
    assert.ok(report.apcaOnBlack < 0);
  });

  it('generates color scales in every format', async () => {
    const tailwind = await result('color-scale-generator', '#2563eb', {
      format: 'tailwind-v4',
      name: 'brand',
    });

    assert.ok(tailwind.text.startsWith('@theme {'));
    assert.ok(tailwind.text.includes('--color-brand-700: #2563eb;'));
    assert.ok(tailwind.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
    assert.equal(tailwind.artifact?.fileName, 'tailwind-theme.css');

    assert.ok(
      (await result('color-scale-generator', '#2563eb', { format: 'tailwind-v3' })).text.includes(
        "700: '#2563eb',",
      ),
    );

    assert.equal(
      JSON.parse((await result('color-scale-generator', '#2563eb', { format: 'json' })).text)[
        '700'
      ],
      '#2563eb',
    );

    assert.match(
      (await result('color-scale-generator', '#2563eb', { colorFormat: 'oklch' })).text,
      /--brand-50: oklch\(/,
    );
  });

  it('names the json report apart from json output and prints hue 0 for grays', async () => {
    const json = await result('color-scale-generator', 'white', {
      colorFormat: 'oklch',
      format: 'json',
    });

    assert.deepEqual(
      [json.artifact?.fileName, json.artifacts?.[0]?.fileName],
      ['color-scale.json', 'color-scale-report.json'],
    );

    assert.equal(JSON.parse(json.text)['50'], 'oklch(100% 0 0)');
    assert.doesNotMatch(json.text, /none/);
    assert.doesNotMatch(json.summary ?? '', /blue-500/);
  });

  it('prints a valid tailwind v3 object for hyphenated and plain names', async () => {
    const config = async (name: string) => {
      const { text } = await result('color-scale-generator', '#2563eb', {
        format: 'tailwind-v3',
        name,
      });

      return new Function(`return ({\n${text}\n});`)() as {
        colors: Record<string, Record<string, string>>;
      };
    };

    assert.equal((await config('brand-blue')).colors['brand-blue']?.['700'], '#2563eb');
    assert.equal((await config('brand')).colors.brand?.['700'], '#2563eb');
  });

  it('rejects bad names and alpha', async () => {
    await assert.rejects(result('color-scale-generator', '#2563eb', { name: 'Brand!' }));
    await assert.rejects(result('color-scale-generator', 'rgb(0 0 0 / 0.5)'));
  });
});

describe('color mixer', () => {
  it('writes the rule with a resolved fallback', async () => {
    const out = await result('color-mixer', '', {
      colorA: '#ff0000',
      colorB: '#0000ff',
      space: 'srgb',
      weight: '50',
    });

    assert.equal(
      out.text,
      '.mix {\n  color: #800080;\n  color: color-mix(in srgb, #ff0000 50%, #0000ff);\n}',
    );

    assert.ok(out.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
    assert.equal(out.artifacts?.[0]?.fileName, 'color-mix.json');
  });

  it('rejects an out-of-range weight', async () => {
    await assert.rejects(result('color-mixer', '', { weight: '101' }));
    await assert.rejects(result('color-mixer', '', { space: 'hsl' }), /Color space must be one of/);
  });
});

describe('color name lookup', () => {
  it('returns a jsonTable of exact names', async () => {
    const out = await result('color-name-lookup', '#00ffff');

    assert.deepEqual(out.jsonTable?.columns, ['Name', 'Hex', 'ΔE']);

    assert.deepEqual(
      out.jsonTable?.rows.slice(0, 2).map((row) => row[0]),
      ['aqua', 'cyan'],
    );

    assert.ok(out.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
  });

  it('shows no distance for a name fragment and counts one match in the singular', async () => {
    const slate = await result('color-name-lookup', 'slate');

    assert.deepEqual(new Set(slate.jsonTable?.rows.map((row) => row[2])), new Set(['—']));

    assert.equal(
      (await result('color-name-lookup', 'light-gray')).summary,
      '1 CSS named color matches.',
    );
  });

  it('rejects unknown fragments', async () => {
    await assert.rejects(result('color-name-lookup', 'xyz'));
  });
});

describe('color blindness palette simulator', () => {
  it('flags the green and red pair for deutan', async () => {
    const out = await result('color-blindness-palette-simulator', '#2ca02c, #d62728', {
      severity: '100',
      types: 'protan,deutan',
    });

    assert.ok(out.text.includes('#1 / #2\tdeutan'));
    assert.ok(out.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
    assert.equal(out.summary, '1 hard-to-tell pair at 100% severity: #1/#2 (deutan).');
    assert.deepEqual(out.jsonTable?.columns, ['Color', 'normal', 'protan', 'deutan']);
    assert.deepEqual(out.jsonTable?.rows[0]?.slice(0, 2), ['#1', '#2ca02c']);
  });

  it('lists five pairs in the summary and points to the rest', async () => {
    const out = await result(
      'color-blindness-palette-simulator',
      '#101010, #111111, #121212, #131313',
      { severity: '0', types: 'protan' },
    );

    assert.match(
      out.summary ?? '',
      /^6 hard-to-tell pairs at 0% severity: #1\/#2 \(close for everyone/,
    );

    assert.match(out.summary ?? '', /; 1 more in Copy or Save\.$/);
  });

  it('saves a json report with every simulated color and pair distance', async () => {
    const out = await result('color-blindness-palette-simulator', '#2ca02c, #d62728, #1f77b4', {
      severity: '100',
      types: 'deutan',
    });
    const artifact = out.artifacts?.[0];

    assert.equal(artifact?.fileName, 'color-vision-report.json');

    const report = JSON.parse(Buffer.from(artifact?.base64 ?? '', 'base64').toString('utf8'));

    assert.equal(report.severity, 100);
    assert.deepEqual(report.types, ['deutan']);

    assert.deepEqual(report.rows[0], {
      colors: ['#2ca02c', '#d62728', '#1f77b4'],
      type: 'normal',
    });

    assert.equal(report.rows[1].type, 'deutan');
    assert.equal(report.rows[1].colors.length, 3);

    assert.deepEqual(
      report.pairs.map((pair: { a: number; b: number; flags: string[] }) => [
        pair.a,
        pair.b,
        pair.flags,
      ]),
      [
        [1, 2, ['deutan']],
        [1, 3, []],
        [2, 3, []],
      ],
    );

    assert.equal(report.pairs[0].deltaE.deutan, 0.0406);
  });

  it('rejects a single color', async () => {
    await assert.rejects(result('color-blindness-palette-simulator', '#fff'));
  });

  it('rejects an off-step severity', async () => {
    await assert.rejects(
      result('color-blindness-palette-simulator', '#000, #fff', { severity: '55' }),
      /steps of 10/,
    );
  });
});

describe('mesh gradient generator', () => {
  it('returns css and an svg artifact for the chosen colors', async () => {
    const out = await result('mesh-gradient-generator', '', { count: '3', seed: '7' });

    assert.equal(out.text.match(/radial-gradient\(at /g)?.length, 3);
    assert.ok(out.artifacts?.some((artifact) => artifact.fileName === 'mesh-gradient.svg'));
  });

  it('rejects an out-of-range seed and bad colors', async () => {
    await assert.rejects(result('mesh-gradient-generator', '', { seed: '0' }));
    await assert.rejects(result('mesh-gradient-generator', '', { color1: 'nope' }));
  });
});

describe('svg blob and wave', () => {
  it('generates a seeded blob with a preview', async () => {
    const out = await result('svg-blob-generator');

    assert.ok(out.text.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"'));
    assert.ok(out.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
    assert.equal(out.artifact?.fileName, 'blob.svg');
    assert.match(out.summary ?? '', /seed 42/);
    assert.notEqual(out.text, (await result('svg-blob-generator', '', { seed: '43' })).text);
  });

  it('generates a wave and rejects bad input', async () => {
    const out = await result('svg-wave-generator', '', { layers: '2', style: 'sine' });

    assert.equal(out.artifact?.fileName, 'wave.svg');
    assert.match(out.text, /fill-opacity="0.5"/);
    await assert.rejects(result('svg-wave-generator', '', { layers: '5' }));
    await assert.rejects(result('svg-wave-generator', '', { position: 'left' }));
    await assert.rejects(result('svg-blob-generator', '', { fill: 'rgb(0 0 0 / 0.5)' }));
    await assert.rejects(result('svg-blob-generator', '', { fill: 'not a color' }));
  });

  it('ignores the hidden seed of a sine wave but checks it for a smooth one', async () => {
    const sine = await result('svg-wave-generator', '', { seed: '0', style: 'sine' });

    assert.equal(sine.text, (await result('svg-wave-generator', '', { style: 'sine' })).text);
    await assert.rejects(result('svg-wave-generator', '', { seed: '0', style: 'smooth' }), /Seed/);
  });
});

describe('svg pattern', () => {
  it('generates a css rule and rejects bad input', async () => {
    const out = await result('svg-pattern-generator', '', { transparent: 'true' });

    assert.ok(out.text.startsWith('.pattern {'));
    assert.ok(!out.text.includes('background-color'));
    assert.equal(out.artifact?.fileName, 'pattern-tile.svg');

    await assert.rejects(
      result('svg-pattern-generator', '', { strokeSize: '20', type: 'grid', tileSize: '24' }),
    );

    await assert.rejects(result('svg-pattern-generator', '', { type: 'stars' }));
  });
});

describe('svg to data uri', () => {
  const inkscape = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!-- Created with Inkscape (http://www.inkscape.org/) -->',
    '<svg width="24" height="24" viewBox="0 0 24 24" version="1.1" id="svg1" inkscape:version="1.3 (0e150ed6c4, 2023-07-21)" sodipodi:docname="icon.svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">',
    '  <sodipodi:namedview id="namedview1" pagecolor="#ffffff" inkscape:zoom="32">',
    '    <inkscape:page x="0" y="0" width="24" height="24" id="page2" />',
    '  </sodipodi:namedview>',
    '  <defs id="defs1" />',
    '  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1">',
    '    <rect style="fill:#6366f1;stroke-width:2" id="rect1" width="20" height="20" x="2" y="2" />',
    '  </g>',
    '</svg>',
  ].join('\n');

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n  <path d="M2 2h20v20H2z"/>\n</svg>';

  it('prints a data uri, a css rule and jsx', async () => {
    const uri = await result('svg-to-data-uri', svg);

    assert.ok(uri.text.startsWith("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'"));
    assert.match(uri.summary ?? '', /saved \d+ bytes/);
    assert.ok(uri.previewDataUri?.startsWith('data:image/svg+xml;base64,'));

    const css = await result('svg-to-data-uri', svg, { encoding: 'base64', output: 'css' });

    assert.ok(css.text.startsWith('.icon {\n  background-image: url("data:image/svg+xml;base64,'));

    assert.ok(
      css.text.endsWith('");\n  background-repeat: no-repeat;\n  background-size: contain;\n}'),
    );

    const jsx = await result('svg-to-data-uri', svg, { output: 'jsx', typescript: 'true' });

    assert.ok(jsx.text.includes('export function Icon(props: SVGProps<SVGSVGElement>) {'));
  });

  it('converts a default Inkscape save to jsx when optimize is on', async () => {
    const out = await result('svg-to-jsx', inkscape);

    assert.ok(!/inkscape|sodipodi/i.test(out.text));

    assert.ok(
      out.text.includes("<rect style={{ fill: '#6366f1', strokeWidth: '2' }} id=\"rect1\""),
    );

    const plain = await result('svg-to-jsx', inkscape, { optimize: 'false' });

    assert.ok(!/inkscape|sodipodi/i.test(plain.text));

    const optimized = await result('svg-optimizer', inkscape);

    assert.ok(!/inkscape|sodipodi/i.test(optimized.text));
  });

  it('gives a viewBox-only preview its viewBox size but leaves the output alone', async () => {
    const out = await result('svg-to-data-uri', svg);
    const preview = atob(out.previewDataUri?.split(',')[1] ?? '');

    assert.match(preview, /^<svg width="24" height="24" xmlns=/);
    assert.doesNotMatch(out.text, /width/);
  });

  it('keeps the svg-optimizer preview at its intrinsic size', async () => {
    const out = await result(
      'svg-optimizer',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>',
    );
    const preview = atob(out.previewDataUri?.split(',')[1] ?? '');

    assert.match(preview, /<svg[^>]* width="24"/);
    assert.doesNotMatch(out.text, /<svg[^>]* width=/);
  });

  it('defaults the pattern stroke to 4', () => {
    const field = listBrowserWorkerTools()
      .find((tool) => tool.id === 'svg-pattern-generator')
      ?.fields?.find((candidate) => candidate.id === 'strokeSize');

    assert.equal(field?.defaultValue, '4');
  });

  it('mentions the optimize saving only when there is one', async () => {
    assert.doesNotMatch((await result('svg-to-data-uri', '<svg/>')).summary ?? '', /saved/);

    assert.match(
      (await result('svg-to-data-uri', svg)).summary ?? '',
      /Optimize saved \d+ bytes\./,
    );
  });

  it('defaults the aliases to jsx and css', async () => {
    assert.ok((await result('svg-to-jsx', svg)).text.startsWith('export function Icon(props) {'));
    assert.ok((await result('svg-to-css-background', svg)).text.startsWith('.icon {'));
  });

  it('rejects bad input', async () => {
    await assert.rejects(result('svg-to-data-uri', svg, { componentName: 'icon', output: 'jsx' }));
    await assert.rejects(result('svg-to-data-uri', '<svg onload="x"/>'), /onload/);

    await assert.rejects(
      result('svg-to-data-uri', `<svg>${String.fromCharCode(0xd800)}</svg>`, { optimize: 'false' }),
      /Invalid XML/,
    );

    await assert.rejects(result('svg-to-data-uri', `<svg>${' '.repeat(500_000)}</svg>`), /500,000/);
  });
});

describe('barcode generator', () => {
  it('draws an svg and reports the check digit', async () => {
    const out = await result('barcode-generator', '400638133393', { format: 'ean13' });

    assert.match(out.summary ?? '', /EAN-13, 95 modules, check digit 1/);
    assert.equal(out.artifact?.fileName, 'barcode-ean13.svg');
    assert.ok(out.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
    assert.ok(out.text.startsWith('<svg '));
  });

  it('rejects unfaithful input and defaults the alias to EAN-13', async () => {
    await assert.rejects(result('barcode-generator', '4006381333932', { format: 'ean13' }));
    await assert.rejects(result('barcode-generator', 'café'));
    await assert.rejects(result('barcode-generator', 'a*b', { format: 'code39' }));
    await assert.rejects(result('barcode-generator', 'A', { height: '10' }));

    const alias = await result('ean-13-barcode-generator', '400-638 133393');

    assert.equal(alias.artifact?.fileName, 'barcode-ean13.svg');
  });

  it('drops one pasted trailing line break in Code 128 and says so', async () => {
    const plain = await result('barcode-generator', 'Wikipedia');
    const pasted = await result('barcode-generator', 'Wikipedia\r\n');

    assert.equal(pasted.text, plain.text);
    assert.equal(pasted.summary, `${plain.summary} The trailing line break was removed.`);

    const twice = await result('barcode-generator', 'Wikipedia\n\n');

    assert.notEqual(twice.text, plain.text);
    assert.notEqual((await result('barcode-generator', 'Wiki\tpedia')).text, plain.text);
  });

  it('drops one pasted trailing line break in every format', async () => {
    for (const [format, text] of [
      ['code39', 'WIKI'],
      ['ean13', '400638133393'],
      ['upca', '03600029145'],
    ] as const) {
      const plain = await result('barcode-generator', text, { format });
      const pasted = await result('barcode-generator', `${text}\n`, { format });

      assert.equal(pasted.text, plain.text, format);
      assert.equal(pasted.summary, `${plain.summary} The trailing line break was removed.`);
    }

    await assert.rejects(
      result('barcode-generator', 'WIKI\n\n', { format: 'code39' }),
      /"\\n" is not allowed/,
    );
  });

  it('names the Code 39 check character and keeps notes as sentences', async () => {
    const out = await result('barcode-generator', 'code 39', {
      code39Check: 'true',
      format: 'code39',
    });

    assert.match(
      out.summary ?? '',
      /^Code 39, \d+ modules, check character \S\. Lowercase input was uppercased\.$/,
    );
  });
});
