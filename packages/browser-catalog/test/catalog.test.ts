import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { domainTools } from '@devtoolora/tools';
import {
  browserWorkerTools,
  listBrowserWorkerTools,
  runBrowserWorkerTool,
} from '@devtoolora/browser-catalog';
import { tools } from '../../../apps/vscode/src/extension/toolRegistry';
import { webToolAliases, webToolMetadata } from '../../../apps/web/src/toolMetadata.generated';
import { toolDomains } from '../src/toolDomains.generated';
import {
  loadBrowserWorkerTool,
  loadBrowserWorkerTools,
  runBrowserWorkerToolLazily,
} from '../src/lazy';
import { vscodeToolMetadata } from '../../../apps/vscode/src/extension/toolMetadata.generated';
import { filterTools } from '../../../apps/vscode/src/webview/client/utils/filterTools';
import { toolSupportsCapability } from '@devtoolora/core';

async function run(id: string, text = '', fields: Record<string, string> = {}): Promise<string> {
  return (await runBrowserWorkerTool(id, { text, fields })).text;
}

async function result(id: string, text = '', fields: Record<string, string> = {}) {
  return runBrowserWorkerTool(id, { text, fields });
}

describe('tool registry', () => {
  const seedBrowserWorkerToolIds = [
    'base64-encode',
    'base64-decode',
    'url-encode',
    'url-decode',
    'html-entities',
    'slugify',
    'case-convert',
    'text-statistics',
    'json-format',
    'json-minify',
    'json-validate',
  ];
  const clientSideToolIds = [
    'markdown-to-pdf',
    'pdf-toolkit',
    'pdf-page-counter',
    'pdf-metadata-editor',
    'pdf-delete-pages',
    'pdf-extract-pages',
    'pdf-page-numbers',
    'pdf-header-footer',
    'pdf-watermark',
    'xlsx-to-csv',
    'csv-to-xlsx',
    'docx-to-text',
    'pdf-text-extractor',
  ];

  it('registers the shared browser-safe tool set with valid metadata', () => {
    assert.equal(tools.length, browserWorkerTools.length);
    assert.ok(tools.every((tool) => tool.id && tool.name && tool.category));
    assert.equal(new Set(tools.map((tool) => tool.id)).size, tools.length);
    const ids = new Set(tools.map((tool) => tool.id));

    assert.ok(tools.every((tool) => (tool.relatedToolIds ?? []).every((id) => ids.has(id))));
  });

  it('exposes the canonical tools and the conversion and JSON mode aliases', () => {
    const metadata = listBrowserWorkerTools();

    assert.equal(filterTools(metadata, '').length, webToolMetadata.length);
    assert.equal(metadata.filter((tool) => tool.aliasOf).length, webToolAliases.length);

    assert.deepEqual(
      metadata.filter((tool) => tool.aliasOf).map((tool) => [tool.id, tool.aliasOf]),
      [
        ['base64-decode', 'base64-encode'],
        ['url-decode', 'url-encode'],
        ['base32-encode', 'base-n-encoder'],
        ['base58-encode', 'base-n-encoder'],
        ['base45-encode', 'base-n-encoder'],
        ['ascii85-encode', 'base-n-encoder'],
        ['json-string-escape', 'string-escaper'],
        ['vigenere-cipher', 'classic-ciphers'],
        ['dice-roller', 'random-number'],
        ['seeded-fake-data', 'fake-data-generator'],
        ['dotenv-example', 'dotenv-converter'],
        ['ansi-to-html', 'ansi-stripper'],
        ['wireguard-key-generator', 'wireguard-config-generator'],
        ['cron-generator', 'cron-explain'],
        ['uuid-decoder', 'id-inspector'],
        ['programmer-calculator', 'bitwise-calculator'],
        ['radial-gradient-generator', 'css-gradient-generator'],
        ['conic-gradient-generator', 'css-gradient-generator'],
        ['css-backdrop-filter-generator', 'css-filter-generator'],
        ['remove-line-numbers', 'remove-blank-lines'],
        ['json-minify', 'json-format'],
        ['json-validate', 'json-format'],
        ['yaml-to-json', 'json-to-yaml'],
        ['xml-to-json', 'json-to-xml'],
        ['csv-to-json', 'json-to-csv'],
        ['toml-to-json', 'json-to-toml'],
        ['json5-to-json', 'jsonc-to-json'],
        ['csv-to-tsv', 'csv-delimiter-converter'],
        ['csv-to-sql-insert', 'csv-to-sql'],
        ['markdown-table-generator', 'table-generator'],
        ['json-to-go', 'json-to-code-types'],
        ['json-to-rust', 'json-to-code-types'],
        ['json-to-kotlin', 'json-to-code-types'],
        ['json-to-java', 'json-to-code-types'],
        ['json-to-csharp', 'json-to-code-types'],
        ['json-to-python', 'json-to-code-types'],
        ['json-to-swift', 'json-to-code-types'],
        ['jwt-sign-verify', 'jwt-parse'],
        ['fetch-to-curl', 'curl-to-fetch'],
        ['open-graph-preview', 'meta-tag-generator'],
        ['spf-record', 'email-auth-records'],
        ['dmarc-record', 'email-auth-records'],
        ['curl-to-python', 'curl-to-code'],
        ['curl-to-go', 'curl-to-code'],
        ['curl-to-php', 'curl-to-code'],
        ['curl-to-java', 'curl-to-code'],
        ['aes-decrypt', 'aes-encrypt'],
        ['pem-to-jwk', 'jwk-to-pem'],
        ['crc32', 'checksum'],
        ['social-media-image-resizer', 'batch-image-tools'],
        ['svg-to-jsx', 'svg-to-data-uri'],
        ['svg-to-css-background', 'svg-to-data-uri'],
        ['ean-13-barcode-generator', 'barcode-generator'],
        ['gif-splitter', 'gif-frame-extractor'],
        ['images-to-gif', 'gif-maker'],
        ['heic-to-jpg', 'heic-converter'],
        ['heic-to-png', 'heic-converter'],
        ['image-to-text', 'image-ocr'],
        ['pdf-page-counter', 'pdf-toolkit'],
        ['pdf-delete-pages', 'pdf-toolkit'],
        ['pdf-extract-pages', 'pdf-toolkit'],
        ['pdf-header-footer', 'pdf-page-numbers'],
        ['pdf-watermark', 'pdf-page-numbers'],
        ['xlsx-to-json', 'xlsx-to-csv'],
        ['json-to-xlsx', 'csv-to-xlsx'],
        ['docx-to-markdown', 'docx-to-text'],
        ['pdf-diff', 'pdf-compare'],
        ['token-counter', 'token-estimator'],
        ['text-splitter', 'text-chunker'],
      ],
    );

    assert.deepEqual(
      filterTools(metadata, 'seeded fake data').map((tool) => tool.id),
      ['fake-data-generator'],
    );

    assert.deepEqual(
      filterTools(metadata, 'jwt verify').map((tool) => tool.id),
      ['jwt-parse'],
    );

    assert.deepEqual(
      filterTools(metadata, 'open graph').map((tool) => tool.id),
      ['meta-tag-generator'],
    );

    assert.deepEqual(
      filterTools(metadata, 'epoch').map((tool) => tool.id),
      ['timestamp-convert'],
    );

    assert.deepEqual(
      filterTools(metadata, 'oklch').map((tool) => tool.id),
      ['color-converter'],
    );

    assert.deepEqual(
      filterTools(metadata, 'delete pdf pages').map((tool) => tool.id),
      ['pdf-toolkit'],
    );

    assert.deepEqual(
      filterTools(metadata, 'pdf watermark').map((tool) => tool.id),
      ['pdf-page-numbers'],
    );

    assert.deepEqual(
      filterTools(metadata, 'remove pdf metadata').map((tool) => tool.id),
      ['pdf-metadata-editor'],
    );

    assert.deepEqual(
      filterTools(metadata, 'base64').map((tool) => tool.id),
      ['base64-encode', 'basic-auth'],
    );

    assert.deepEqual(
      filterTools(metadata, 'base64 decode').map((tool) => tool.id),
      ['base64-encode'],
    );

    assert.deepEqual(
      filterTools(metadata, 'url-decode').map((tool) => tool.id),
      ['url-encode'],
    );

    assert.deepEqual(
      filterTools(metadata, 'yaml to json').map((tool) => tool.id),
      ['json-to-yaml'],
    );

    assert.deepEqual(
      filterTools(metadata, 'fetch to curl').map((tool) => tool.id),
      ['curl-to-fetch'],
    );

    assert.deepEqual(
      filterTools(metadata, 'cron generator').map((tool) => tool.id),
      ['cron-explain'],
    );
  });

  it('composes tools from the shared browser catalog', () => {
    const modules = Object.values(domainTools);
    const moduleTools = modules.flat();
    const browserMetadata = listBrowserWorkerTools();

    assert.deepEqual(
      tools.map((tool) => tool.id),
      browserWorkerTools.map((tool) => tool.id),
    );

    assert.deepEqual(vscodeToolMetadata, JSON.parse(JSON.stringify(browserMetadata)));

    assert.equal(
      vscodeToolMetadata.some((tool) => 'run' in tool),
      false,
    );

    assert.equal(moduleTools.length, tools.length);

    assert.deepEqual(
      moduleTools.map((tool) => tool.id),
      tools.map((tool) => tool.id),
    );

    assert.deepEqual(
      moduleTools.map((tool) => tool.id).sort(),
      tools.map((tool) => tool.id).sort(),
    );

    assert.ok(modules.every((moduleTools) => moduleTools.length > 0));
  });

  it('keeps tool health metadata searchable and internally linked', () => {
    const ids = new Set(tools.map((tool) => tool.id));
    const names = new Set<string>();

    for (const tool of tools) {
      assert.ok(tool.description.trim(), `${tool.id} should have a description`);
      assert.ok((tool.keywords ?? []).length > 0, `${tool.id} should have keywords`);

      if (tool.aliasOf) {
        assert.ok(ids.has(tool.aliasOf), `${tool.id} should reference its canonical tool`);
      } else {
        assert.equal(
          names.has(`${tool.category}:${tool.name}`),
          false,
          `${tool.name} should not be duplicated in ${tool.category}`,
        );

        names.add(`${tool.category}:${tool.name}`);
      }

      for (const relatedId of tool.relatedToolIds ?? []) {
        assert.ok(ids.has(relatedId), `${tool.id} references missing related tool ${relatedId}`);
      }
    }
  });

  it('marks the seed browser-worker tools with runtime capabilities', () => {
    for (const id of seedBrowserWorkerToolIds) {
      const tool = tools.find((candidate) => candidate.id === id);

      assert.ok(tool, `${id} should be registered`);

      assert.ok(
        toolSupportsCapability(tool, 'browserWorker'),
        `${id} should be browser-worker capable`,
      );
    }
  });

  it('assigns every tool of every domain to that domain in the generated index', () => {
    const domains = Object.entries(domainTools);

    assert.deepEqual(
      new Set(Object.keys(domainTools)),
      new Set(Object.values(toolDomains)),
      'toolDomains.generated.ts is stale. Run npm run generate.',
    );

    for (const [domain, list] of domains) {
      assert.ok(list.length > 0, `${domain} should not be empty`);
      assert.equal(new Set(list.map((tool) => tool.id)).size, list.length, `${domain} ids unique`);

      for (const tool of list) {
        assert.equal(
          toolDomains[tool.id as keyof typeof toolDomains],
          domain,
          `${tool.id} is missing or misplaced in toolDomains.generated.ts. Run npm run generate.`,
        );

        assert.ok(toolSupportsCapability(tool, 'browserWorker'), `${tool.id} browser-worker`);
      }
    }
  });

  it('keeps image and PDF tools client-side in the shared catalog', () => {
    const source = readFileSync(
      join(process.cwd(), 'apps/vscode/src/extension/toolRegistry.ts'),
      'utf8',
    );

    assert.match(source, /toolMetadata\.generated/);
    assert.doesNotMatch(source, /@devtoolora\/(?:browser-catalog|tools)/);
    assert.doesNotMatch(source, /createToolRegistry|browserWorkerTools|runToolWithCapability/);
    assert.doesNotMatch(source, /createImageCodeTools|createDocumentPdfTools|tools\/lib/);
    assert.doesNotMatch(source, /export const runTool/);

    for (const id of [...domainTools.imagesCodes.map((tool) => tool.id), ...clientSideToolIds]) {
      const tool = tools.find((candidate) => candidate.id === id);

      assert.ok(tool, `${id} should be registered`);

      assert.ok(
        toolSupportsCapability(tool, 'browserWorker'),
        `${id} should be browser-worker capable`,
      );
    }

    assert.equal(existsSync(join(process.cwd(), 'apps/vscode/src/tools')), false);
  });

  it('keeps the browser catalog an aggregator, not a tool definition owner', () => {
    const source = readFileSync(
      join(process.cwd(), 'packages/browser-catalog/src/index.ts'),
      'utf8',
    );

    assert.match(source, /@devtoolora\/tools/);
    assert.match(source, /browserWorkerTools/);
    assert.doesNotMatch(source, /export const [A-Za-z0-9_]+Tool: ToolDefinition/);
  });

  it('runs declared samples for non-file tools without throwing', async () => {
    for (const tool of tools) {
      if (tool.fields?.some((field) => field.type === 'file') || tool.id === 'svg-to-png') {
        continue;
      }

      for (const sample of tool.samples ?? []) {
        await assert.doesNotReject(
          () => result(tool.id, sample.text ?? '', sample.fields ?? {}),
          `${tool.id} sample "${sample.label}" should run`,
        );
      }
    }
  });

  it('runs the local parity tools without network access', async () => {
    const gridCss = await run('css-grid-generator', '', {
      columns: '4',
      rows: '3',
      columnGap: '12',
      rowGap: '20',
      minTrack: '160',
      autoFlow: 'column dense',
      justifyItems: 'center',
      alignItems: 'end',
      justifyContent: 'space-between',
      alignContent: 'space-around',
    });

    assert.match(gridCss, /repeat\(4, minmax\(160px, 1fr\)\)/);
    assert.match(gridCss, /grid-template-rows: repeat\(3/);
    assert.match(gridCss, /column-gap: 12px/);
    assert.match(gridCss, /grid-auto-flow: column dense/);
    const flexCss = await run('css-flexbox-generator', '', {
      direction: 'column',
      wrap: 'wrap',
      justify: 'space-between',
      align: 'flex-end',
      alignContent: 'space-around',
      gap: '24',
      grow: '2',
      shrink: '0',
      basis: '180',
      order: '-1',
    });

    assert.match(flexCss, /flex-wrap: wrap/);
    assert.match(flexCss, /flex: 2 0 180px/);
    assert.match(flexCss, /order: -1/);

    assert.match(
      await run('css-box-shadow-generator', '', {
        layers: '[{"x":0,"y":8,"blur":24,"spread":0,"color":"#112233","inset":false}]',
      }),
      /0px 8px 24px 0px #112233/,
    );

    assert.match(
      await run('css-border-radius-generator', '', {
        topLeft: '8',
        topRight: '16',
        bottomRight: '24',
        bottomLeft: '32',
      }),
      /border-radius: 8px 16px 24px 32px/,
    );

    assert.match(
      await run('css-triangle-generator', '', { size: '32', direction: 'right', color: '#112233' }),
      /border-left: 32px solid #112233/,
    );

    assert.match(
      await run('css-clip-path-generator', '', { points: '[[0,0],[100,0],[50,100]]' }),
      /polygon\(0% 0%, 100% 0%, 50% 100%\)/,
    );

    const keyframes = await run('css-keyframes-generator', '', {
      name: 'slide-up',
      preset: 'slide-left',
      distance: '24',
      scale: '90',
      opacity: '0',
      duration: '400',
      delay: '120',
      iterations: '3',
      direction: 'alternate',
      fillMode: 'forwards',
      easing: 'ease-in',
    });

    assert.match(keyframes, /from \{ opacity: 0; transform: translateX\(24px\); \}/);
    assert.match(keyframes, /animation: slide-up 400ms ease-in 120ms 3 alternate forwards/);

    assert.match(
      await run('css-keyframes-generator', '', {
        name: 'slide-back',
        preset: 'slide-left',
        distance: '-28',
        scale: '90',
        opacity: '0',
        duration: '400',
        delay: '0',
        iterations: '1',
        direction: 'normal',
        fillMode: 'both',
        easing: 'ease-out',
      }),
      /translateX\(-28px\)/,
    );

    const palette = JSON.parse(await run('color-palette', '#2563eb', { scheme: 'triadic' })) as {
      palette: Record<string, { base: string; shades: Record<string, string> }>;
    };

    assert.deepEqual(Object.keys(palette.palette), ['base', 'accent1', 'accent2']);
    assert.deepEqual(Object.keys(palette.palette.base!.shades), ['50', '200', '500', '700', '900']);

    await assert.rejects(
      () => result('css-box-shadow-generator', '', { layers: '[{}, {}, {}, {}, {}, {}]' }),
      /between one and five/,
    );

    assert.match(
      await run('json-table', '[{"name":"Ada","active":true}]'),
      /\| # \| "name" \| "active" \|/,
    );

    assert.equal(
      await run('json-query', '{"users":[{"name":"Ada"}]}', { path: '$.users.0.name' }),
      '"Ada"',
    );

    const seeded = await run('seeded-fake-data', '', { seed: '7', count: '2' });

    assert.equal(seeded, await run('seeded-fake-data', '', { seed: '7', count: '2' }));

    assert.match(
      await run('unit-converter', '', { from: 'km', to: 'mi', value: '1' }),
      /0\.621371 mi/,
    );

    assert.match(
      await run('financial-calculator', '', {
        mode: 'compound',
        principal: '1000',
        rate: '10',
        years: '2',
      }),
      /1210/,
    );
  });

  it('runs the lightweight text and encoding tool pack', async () => {
    assert.equal(await run('whitespace-cleaner', '  a    b  \n\n\n c  '), '  a    b\n\n c');

    assert.equal(
      await run('whitespace-cleaner', '  a    b  \n\n\n c  ', {
        collapseSpaces: 'true',
        trimLines: 'true',
        trimText: 'true',
      }),
      'a b\n\nc',
    );

    assert.equal(await run('text-reverser', 'abc'), 'cba');
    assert.equal(await run('sort-lines', 'b\n10\n2\na'), '2\n10\na\nb');
    assert.equal(await run('deduplicate-lines', 'Alpha\nbeta\nalpha'), 'Alpha\nbeta\n');
    assert.equal(await run('prefix-suffix-lines', 'one\ntwo', { prefix: '- ' }), '- one\n- two');

    assert.equal(
      await run('number-lines', 'one\ntwo', { start: '7', width: '2' }),
      '07. one\n08. two',
    );

    assert.equal(
      await run('find-replace', 'Hello tools', { find: 'tools', replacement: 'world' }),
      'Hello world',
    );

    assert.equal(
      await run('wrap-text', 'one two three four', { width: '10' }),
      'one two\nthree four',
    );

    assert.equal(await run('strip-diacritics', 'Crème brûlée'), 'Creme brulee');
    assert.equal(await run('indent-dedent', 'one\ntwo', { spaces: '2' }), '  one\n  two');
    assert.deepEqual(JSON.parse(await run('zero-width-detector', 'a\u200bb')).result.count, 1);
    assert.equal(await run('hex-text', 'Hi'), '48 69');
    assert.equal(await run('hex-text', '48 69', { mode: 'decode' }), 'Hi');
    assert.equal(await run('ascii-text', 'ABC'), '65 66 67');
    assert.equal(await run('caesar-cipher', 'Hello', { shift: '13' }), 'Uryyb');
    assert.equal(await run('morse-code', 'SOS'), '... --- ...');
  });
});

describe('generated tool domain index', () => {
  it('maps every browser worker tool, including aliases, to exactly one domain', () => {
    assert.deepEqual(
      Object.keys(toolDomains).sort(),
      browserWorkerTools.map((tool) => tool.id).sort(),
      'toolDomains.generated.ts is stale. Run npm run generate.',
    );
  });

  it('is sorted by tool id so regeneration is deterministic', () => {
    const ids = Object.keys(toolDomains);

    assert.deepEqual(
      ids,
      [...ids].sort(),
      'toolDomains.generated.ts is stale. Run npm run generate.',
    );
  });
});

describe('lazy browser catalog', () => {
  it('serves the same serialized definitions as the eager catalog', async () => {
    assert.deepEqual(await loadBrowserWorkerTools(), listBrowserWorkerTools());
  });

  it('resolves aliases by their own id', async () => {
    const alias = await loadBrowserWorkerTool('json-minify');

    assert.equal(alias.aliasOf, 'json-format');
    assert.equal('run' in alias, false);
  });

  it('runs a tool from a single domain and rejects unknown ids', async () => {
    const output = await runBrowserWorkerToolLazily('morse-code', { fields: {}, text: 'SOS' });

    assert.match(output.text, /\.\.\. --- \.\.\./);

    await assert.rejects(
      runBrowserWorkerToolLazily('nope', { fields: {}, text: '' }),
      /Unknown tool: nope/,
    );

    await assert.rejects(loadBrowserWorkerTool('nope'), /Unknown tool: nope/);
  });
});
