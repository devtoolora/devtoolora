import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { createHash, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import { runtimeManifest } from '@devtoolora/functions/runtime';
import { domainTools } from '@devtoolora/tools';
import { vscodeToolMetadata } from '../../apps/vscode/src/extension/toolMetadata.generated';
import { webToolAliases, webToolMetadata } from '../../apps/web/src/toolMetadata.generated';
import {
  extensionsForAccept,
  mimeTypeForFile,
} from '../../apps/web/src/features/desktop/utils/desktopFileTypes';
import {
  WORKER_ENTRY_BUDGET,
  WORKER_CHUNK_BUDGET,
  WORKER_TOTAL_BUDGET,
  readBuiltWebWorker,
  builtWebWorkerPath,
  readPreloadedScripts,
  listFiles,
  hasToolId,
  staticChunkImports,
  createWorkerHarness,
  SAMPLE_CERTIFICATE,
} from './packageVerification.helpers';

describe('package verification', () => {
  it('maps dialog accept filters to extensions and file names to MIME types', () => {
    assert.deepEqual(extensionsForAccept('image/*'), [
      'png',
      'jpg',
      'jpeg',
      'webp',
      'avif',
      'gif',
      'tif',
      'tiff',
      'svg',
    ]);

    assert.deepEqual(extensionsForAccept('.pem,application/pdf'), ['pem', 'pdf']);
    assert.equal(mimeTypeForFile('photo.JPG'), 'image/jpeg');
    assert.equal(mimeTypeForFile('document.pdf'), 'application/pdf');
    assert.equal(mimeTypeForFile('certificate.pem'), 'text/plain');
    assert.equal(mimeTypeForFile('unknown.bin', 'application/x-custom'), 'application/x-custom');
  });

  it('builds the browser worker without Node-only runtime imports', () => {
    const workerSource = readBuiltWebWorker();

    assert.doesNotMatch(
      workerSource,
      /(?:from|require\()\s*["']node:|require\(["'](?:fs|path|sharp|pdfkit)["']\)/,
    );

    assert.match(workerSource, /browserWorker/);
  });

  it('keeps FIGlet fonts lazy-loaded out of the browser worker entry', () => {
    const workerFile = basename(builtWebWorkerPath());
    const workerSource = readBuiltWebWorker();
    const serviceWorker = readFileSync(join(process.cwd(), 'out', 'web', 'sw.js'), 'utf8');

    assert.ok(
      Buffer.byteLength(workerSource, 'utf8') <= WORKER_ENTRY_BUDGET,
      `worker entry grew past its recorded budget: ${Buffer.byteLength(workerSource, 'utf8')} bytes`,
    );

    const figletFontFiles = new Set(
      (
        JSON.parse(
          readFileSync(join(process.cwd(), 'packages/tools/src/figletFontNames.json'), 'utf8'),
        ) as string[]
      ).map((font) => `${font}.js`),
    );
    const domainChunks = [...workerSource.matchAll(/import\(["`]\.\/([^"`]+\.js)["`]\)/g)]
      .map((match) => match[1]!)
      .filter((file) => !figletFontFiles.has(file));

    assert.ok(
      domainChunks.length >= Object.keys(domainTools).length,
      `expected one chunk per tool domain, found ${domainChunks.length}`,
    );

    const workerGraph = new Set<string>([workerFile, ...domainChunks]);

    for (const file of workerGraph) {
      const source = readFileSync(join(process.cwd(), 'out', 'web', 'assets', file), 'utf8');

      for (const chunk of staticChunkImports(source)) workerGraph.add(chunk);
    }

    const totalBytes = [...workerGraph]
      .filter((file) => !figletFontFiles.has(file))
      .reduce(
        (sum, file) => sum + statSync(join(process.cwd(), 'out', 'web', 'assets', file)).size,
        0,
      );

    assert.ok(
      totalBytes <= WORKER_TOTAL_BUDGET,
      `worker entry plus chunks grew past the total budget: ${totalBytes} bytes`,
    );

    assert.match(workerFile, /^worker-[\w-]+\.js$/, 'the worker entry must carry a content hash');

    for (const file of domainChunks) {
      assert.match(
        file,
        /-[\w-]+\.js$/,
        `${file} must carry a content hash so deploys never mix chunks`,
      );

      const bytes = statSync(join(process.cwd(), 'out', 'web', 'assets', file)).size;

      assert.ok(
        bytes <= WORKER_CHUNK_BUDGET,
        `${file} grew past the per-chunk budget: ${bytes} bytes`,
      );

      assert.ok(
        serviceWorker.includes(`/assets/${file}`),
        `${file} must be precached for offline use`,
      );
    }

    assert.doesNotMatch(
      workerSource,
      /Pacific\/Honolulu/,
      'tool definitions must not sit in the worker entry',
    );

    assert.ok(
      domainChunks.some((file) =>
        readFileSync(join(process.cwd(), 'out', 'web', 'assets', file), 'utf8').includes(
          'Standard',
        ),
      ),
      'the default FIGlet font name must be referenced from a domain chunk',
    );

    assert.equal(existsSync(join(process.cwd(), 'out', 'web', 'assets', 'Banner.js')), true);
    assert.equal(existsSync(join(process.cwd(), 'out', 'web', 'assets', 'Standard.js')), true);
    assert.doesNotMatch(serviceWorker, /\/assets\/Banner\.js/);
    assert.doesNotMatch(serviceWorker, /\/assets\/Standard\.js/);
    const fontLoaderChunk = readdirSync(join(process.cwd(), 'out', 'web', 'assets')).find(
      (name) => name.includes('figlet-font-loaders') && name.endsWith('.js'),
    );

    assert.ok(fontLoaderChunk, 'FIGlet loader map must remain outside the worker entry');

    assert.ok(
      serviceWorker.includes(`/assets/${fontLoaderChunk}`),
      'The loader map must be available from the offline shell',
    );

    assert.equal(
      existsSync(join(process.cwd(), 'out', 'web', 'assets', 'tool-guides.js')),
      false,
      'Compressed documentation must not require a cold worker import',
    );
  });

  it('keeps schema validators out of the aiPrompts chunk', () => {
    const assetsRoot = join(process.cwd(), 'out', 'web', 'assets');
    const read = (file: string) => readFileSync(join(assetsRoot, file), 'utf8');
    const domainChunks = [
      ...readBuiltWebWorker().matchAll(/import\(["`]\.\/([^"`]+\.js)["`]\)/g),
    ].map((match) => match[1]!);
    const chunkDefining = (id: string) => domainChunks.find((file) => hasToolId(read(file), id));

    const staticGraph = (entry: string) => {
      const graph = new Set<string>([entry]);

      for (const file of graph)
        for (const chunk of staticChunkImports(read(file))) graph.add(chunk);

      return [...graph];
    };

    // A JSON pointer of the bundled draft meta-schemas; schema/generate.ts never contains it.
    const marker = '#/$defs/nonNegativeInteger';
    const schemaChunk = chunkDefining('json-schema-validator');
    const aiChunk = chunkDefining('function-schema-builder');

    assert.ok(schemaChunk, 'json-schema-validator must have a domain chunk');

    assert.ok(
      staticGraph(schemaChunk).some((file) => read(file).includes(marker)),
      'the marker must sit in the schemaTypes chunk graph',
    );

    assert.ok(aiChunk, 'function-schema-builder must have a domain chunk');

    for (const file of staticGraph(aiChunk))
      assert.ok(!read(file).includes(marker), `${file} pulls the schema meta-validators in`);
  });

  it.each([
    // Error messages that survive minification.
    ['bcryptjs', 'Illegal number of rounds'],
    ['@noble/hashes argon2', '"maxmem" limit was hit'],
  ])('loads %s only on demand, outside every static chunk graph', (name, marker) => {
    const assetsRoot = join(process.cwd(), 'out', 'web', 'assets');
    const read = (file: string) => readFileSync(join(assetsRoot, file), 'utf8');
    const workerFile = basename(builtWebWorkerPath());
    const entries = [
      workerFile,
      ...[...read(workerFile).matchAll(/import\(["`]\.\/([^"`]+\.js)["`]\)/g)].map(
        (match) => match[1]!,
      ),
    ];

    assert.ok(
      readdirSync(assetsRoot).some((file) => file.endsWith('.js') && read(file).includes(marker)),
      `${name} must still be bundled`,
    );

    for (const entry of entries) {
      const graph = new Set<string>([entry]);

      for (const file of graph) {
        assert.ok(!read(file).includes(marker), `${entry} statically loads ${name} via ${file}`);

        for (const chunk of staticChunkImports(read(file))) graph.add(chunk);
      }
    }
  });

  it('keeps node crypto out of worker chunks', () => {
    for (const assetsRoot of [
      join(process.cwd(), 'out', 'web', 'assets'),
      join(process.cwd(), 'apps', 'vscode', 'dist', 'webview', 'assets'),
    ])
      for (const file of readdirSync(assetsRoot).filter((name) => name.endsWith('.js')))
        assert.ok(
          !/require\(["']crypto["']\)/.test(readFileSync(join(assetsRoot, file), 'utf8')),
          `${file} requires node crypto`,
        );
  });

  it('lets only the standalone pdfjs worker attach to its own worker channel', () => {
    const assetsRoot = join(process.cwd(), 'out', 'web', 'assets');
    const attaching = readdirSync(assetsRoot).filter(
      (name) =>
        /\.m?js$/.test(name) &&
        readFileSync(join(assetsRoot, name), 'utf8').includes('initializeFromPort(self)'),
    );

    assert.deepEqual(
      attaching.map((name) => name.replace(/-[\w-]+(?=\.m?js$)/, '')),
      ['pdf.worker.min.mjs'],
    );

    // Positive control: the class is still bundled elsewhere, so the check above is not vacuous.
    assert.ok(
      readdirSync(assetsRoot).some(
        (name) =>
          /^pdf\.worker-/.test(name) &&
          readFileSync(join(assetsRoot, name), 'utf8').includes('static initializeFromPort('),
      ),
    );
  });

  it('runs tools through the built browser worker', async () => {
    const worker = createWorkerHarness();

    try {
      const listResponse = await worker.post({ id: 'list', type: 'listTools' });

      assert.equal(listResponse.ok, true);
      assert.equal(listResponse.type, 'listTools');
      assert.equal(listResponse.tools.length, vscodeToolMetadata.length);
      assert.equal('run' in listResponse.tools[0]!, false);
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'morse-code'));

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'percentage-calculator'),
      );

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'temperature-converter'),
      );

      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'iban-validator'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'dotenv-validator'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'raw-log-redactor'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'ipv4-converter'));

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'gitignore-generator'),
      );

      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'color-palette'));

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'ascii-text-generator'),
      );

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'zero-width-detector'),
      );

      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'json-query'));

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'fake-data-generator'),
      );

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'json-schema-validator'),
      );

      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'jwt-sign-verify'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'hmac'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'password-strength'));

      assert.ok(
        listResponse.tools.some((tool: { id: string }) => tool.id === 'certificate-inspector'),
      );

      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'qr-code-generator'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'svg-placeholder'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'svg-optimizer'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'pdf-toolkit'));
      assert.ok(listResponse.tools.some((tool: { id: string }) => tool.id === 'image-tools'));
      const single = await worker.post({ id: 'one', toolId: 'morse-code', type: 'getTool' });

      assert.equal(single.ok, true);
      assert.equal(single.type, 'getTool');
      assert.equal(single.tool.id, 'morse-code');
      assert.equal('run' in single.tool, false);
      const alias = await worker.post({ id: 'alias', toolId: 'json-minify', type: 'getTool' });

      assert.equal(alias.tool.aliasOf, 'json-format');
      const unknown = await worker.post({ id: 'unknown', toolId: 'nope', type: 'getTool' });

      assert.equal(unknown.ok, false);
      assert.equal(unknown.error, 'Unknown tool: nope');
      const unknownRun = await worker.post({
        fields: {},
        id: 'unknown-run',
        text: '',
        toolId: 'nope',
        type: 'runTool',
      });

      assert.equal(unknownRun.ok, false);
      assert.equal(unknownRun.error, 'Unknown tool: nope');

      assert.match(new X509Certificate(SAMPLE_CERTIFICATE).subject, /api\.local\.test/);
      const certificateResponse = await worker.post({
        id: 'cert',
        type: 'runTool',
        toolId: 'certificate-inspector',
        text: SAMPLE_CERTIFICATE,
        fields: {},
      });

      assert.equal(certificateResponse.ok, true, certificateResponse.error);
      assert.match(certificateResponse.result.text, /api\.local\.test/);

      const runResponse = await worker.post({
        id: 'run',
        type: 'runTool',
        toolId: 'slugify',
        text: 'Crème brûlée #42!!!',
        fields: {},
      });

      assert.equal(runResponse.ok, true);
      assert.equal(runResponse.result.text, 'creme-brulee-42');
    } finally {
      await worker.dispose();
    }
  });

  it('builds the minimal web app shell and PWA manifest', () => {
    const webRoot = join(process.cwd(), 'out/web');
    const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
    const manifest = JSON.parse(readFileSync(join(webRoot, 'manifest.webmanifest'), 'utf8')) as {
      display?: string;
      icons?: unknown[];
      name?: string;
      scope?: string;
    };

    assert.match(html, /Dev Toolora/);
    assert.match(html, /manifest\.webmanifest/);
    assert.equal(manifest.name, 'Dev Toolora');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.scope, '/');
    assert.ok(manifest.icons?.length);
  });

  it('ships a content security policy that keeps requests on this origin', () => {
    const webRoot = join(process.cwd(), 'out/web');

    for (const path of listFiles(webRoot).filter((file) => file.endsWith('.html'))) {
      const html = readFileSync(path, 'utf8');
      const name = relative(webRoot, path);

      // Tauri serves the desktop page with its own CSP, which must allow IPC.
      if (name === 'desktop/index.html') {
        assert.doesNotMatch(html, /http-equiv="Content-Security-Policy"/, name);

        continue;
      }

      const policy = /<meta [^>]*http-equiv="Content-Security-Policy"[^>]*>/
        .exec(html)?.[0]
        .replaceAll('&#x27;', "'");

      assert.ok(
        policy?.includes("connect-src 'self' data: blob: https://cloudflareinsights.com;"),
        name,
      );
    }
  });

  it('prerenders every public route with route-specific metadata', () => {
    const webRoot = join(process.cwd(), 'out/web');
    const htmlFiles = listFiles(webRoot).filter((path) => path.endsWith('.html'));
    const staticRoutes = ['/', '/tools', '/apps', '/extension', '/about', '/desktop'];
    const prerenderedCount = staticRoutes.length + webToolMetadata.length + webToolAliases.length;

    assert.equal(
      htmlFiles.length,
      prerenderedCount + 1,
      `${prerenderedCount} prerendered documents plus the SPA fallback should be built`,
    );

    for (const [path, title] of [
      ['apps/index.html', 'Desktop App — Dev Toolora'],
      ['extension/index.html', 'VS Code Extension — Dev Toolora'],
      ['about/index.html', 'About — Dev Toolora'],
      ['desktop/index.html', 'Dev Toolora Desktop'],
      ['tools/json-format/index.html', 'JSON Format — Dev Toolora'],
      ['tools/base64-decode/index.html', 'Base64 Decode — Dev Toolora'],
      ['tools/url-decode/index.html', 'URL Decode — Dev Toolora'],
    ] as const) {
      assert.match(
        readFileSync(join(webRoot, path), 'utf8'),
        new RegExp(`<title>${title}</title>`),
      );
    }

    if (process.env.SITE_URL) {
      assert.equal(
        existsSync(join(webRoot, 'sitemap.xml')),
        true,
        'SITE_URL builds should emit the sitemap',
      );

      assert.match(readFileSync(join(webRoot, 'index.html'), 'utf8'), /rel="canonical"/);
    } else {
      assert.equal(
        existsSync(join(webRoot, 'sitemap.xml')),
        false,
        'local builds should omit the sitemap without SITE_URL',
      );

      assert.doesNotMatch(readFileSync(join(webRoot, 'index.html'), 'utf8'), /rel="canonical"/);
    }
  });

  it('keeps the homepage initial route within its recorded asset budget', () => {
    const webRoot = join(process.cwd(), 'out/web');
    const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
    const preloadedScripts = [
      ...html.matchAll(/rel="modulepreload" href="\/assets\/([^"]+\.js)"/g),
    ].map((match) => match[1]!);
    const initialBytes = preloadedScripts.reduce(
      (total, file) => total + statSync(join(webRoot, 'assets', file)).size,
      0,
    );

    assert.ok(
      initialBytes <= 432_000,
      `homepage initial scripts grew past the 10% budget: ${initialBytes} bytes`,
    );

    const workerChunk = new RegExp(`^(?:worker|${Object.keys(domainTools).join('|')})-`);

    assert.equal(
      preloadedScripts.some((file) => workerChunk.test(file)),
      false,
    );

    // The search loads the full metadata on demand; a static import (e.g. through a barrel) would
    // preload it again and grow the homepage with every tool.
    const lastTool = webToolMetadata.at(-1)!;

    assert.equal(
      preloadedScripts.some((file) => file.startsWith('toolMetadata.generated-')),
      false,
      'the homepage preloads the tool metadata chunk',
    );

    assert.doesNotMatch(
      readPreloadedScripts(join(webRoot, 'index.html')),
      new RegExp(`slug:"${lastTool.slug}"`),
      'a homepage script inlines the tool metadata',
    );
  });

  it('preloads the app scripts of prerendered pages at low priority', () => {
    const webRoot = join(process.cwd(), 'out/web');

    for (const page of ['index.html', 'tools/json-format/index.html', 'about/index.html']) {
      const preloads = readFileSync(join(webRoot, page), 'utf8').match(
        /<link rel="modulepreload"[^>]*>/g,
      );

      assert.ok(preloads && preloads.length > 0, `${page} preloads no scripts`);

      assert.deepEqual(
        preloads.filter((link) => !link.endsWith(' fetchpriority="low"/>')),
        [],
        `${page} preloads scripts that compete with the first paint`,
      );
    }
  });

  it('keeps web metadata generated, complete, and separate from executable tools', () => {
    const metadataSource = readFileSync(
      join(process.cwd(), 'apps', 'web', 'src', 'toolMetadata.generated.ts'),
      'utf8',
    );
    const appBundle = readPreloadedScripts(join(process.cwd(), 'out', 'web', 'index.html'));
    const webSources = listFiles(join(process.cwd(), 'apps', 'web', 'src'))
      // .server.ts modules run only while pages are prerendered; React Router refuses to bundle
      // them for the client.
      .filter(
        (path) => /\.(?:ts|tsx)$/.test(path) && !/(?:worker|runtime|\.server)\.ts$/.test(path),
      )
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    assert.equal((metadataSource.match(/\"id\":/g) ?? []).length, vscodeToolMetadata.length);
    assert.equal((metadataSource.match(/\"slug\":/g) ?? []).length, vscodeToolMetadata.length);
    assert.doesNotMatch(metadataSource, /\brun\s*:/);
    const catalogPackage = JSON.parse(
      readFileSync(join(process.cwd(), 'packages/browser-catalog/package.json'), 'utf8'),
    ) as { exports: Record<string, string> };

    assert.equal(catalogPackage.exports['./worker'], './src/isolatedWorker.ts');

    const isolatedWorkerSource = readFileSync(
      join(process.cwd(), 'packages/browser-catalog/src/isolatedWorker.ts'),
      'utf8',
    );

    assert.doesNotMatch(
      isolatedWorkerSource,
      /@devtoolora\/(?:tools|functions)|runBrowserWorkerTool|listBrowserWorkerTools/,
    );

    assert.doesNotMatch(
      webSources.replaceAll('@devtoolora/browser-catalog/worker', ''),
      /@devtoolora\/(?:browser-catalog|tools)/,
    );

    assert.doesNotMatch(
      appBundle,
      /runBrowserWorkerTool|runToolWithCapability|listBrowserWorkerTools|browserWorkerTools|PDFDocument|zipSync|jsQR/,
    );

    assert.match(appBundle, /Search developer tools/);
    const toolPage = readFileSync(
      join(process.cwd(), 'out', 'web', 'tools', 'base64-encode', 'index.html'),
      'utf8',
    );

    assert.match(toolPage, /<summary>Is Base64 encryption\?<\/summary>/);
    assert.match(toolPage, /"@type":"FAQPage"/);
    const clientScripts = readdirSync(join(process.cwd(), 'out', 'web', 'assets')).filter((file) =>
      file.endsWith('.js'),
    );

    for (const file of clientScripts)
      assert.doesNotMatch(
        readFileSync(join(process.cwd(), 'out', 'web', 'assets', file), 'utf8'),
        /Is Base64 encryption\?/,
        `${file} ships prerendered guide text`,
      );
  });

  it('builds a PWA service worker that precaches the web shell, worker, and lazy chunks', () => {
    const webRoot = join(process.cwd(), 'out/web');
    const appScript = readPreloadedScripts(join(webRoot, 'index.html'));
    const serviceWorker = readFileSync(join(webRoot, 'sw.js'), 'utf8');

    for (const path of ['index.html', 'manifest.webmanifest', 'sw.js']) {
      assert.equal(existsSync(join(webRoot, path)), true, `${path} should be built`);
    }

    const workerFile = basename(builtWebWorkerPath());
    const cssAssets = readdirSync(join(webRoot, 'assets')).filter((file) => file.endsWith('.css'));

    assert.ok(cssAssets.length >= 2);

    for (const file of cssAssets.filter((name) => !name.startsWith('desktop-'))) {
      assert.match(
        serviceWorker,
        new RegExp(`/assets/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      );
    }

    assert.doesNotMatch(serviceWorker, /\/desktop|\/assets\/desktop-/);
    assert.match(appScript, /serviceWorker/);
    assert.match(appScript, /sw\.js/);
    assert.match(serviceWorker, /devtoolora-[a-f0-9]{12}/);

    assert.ok(
      serviceWorker.includes(`/assets/${workerFile}`),
      'the worker entry must be precached',
    );

    assert.match(serviceWorker, /"\/apps"/);

    assert.match(
      serviceWorker,
      /"\/__spa-fallback\.html"/,
      'unvisited pages need the SPA shell offline',
    );

    assert.match(serviceWorker, /caches\.open/);
  });

  it('ships every runtime file unchanged in assets/runtime with its notices', () => {
    const runtimeRoot = join(process.cwd(), 'out', 'web', 'assets', 'runtime');
    const resolveSource = createRequire(
      join(process.cwd(), 'packages', 'functions', 'package.json'),
    );

    for (const entry of Object.values(runtimeManifest).flat()) {
      const bytes = readFileSync(join(runtimeRoot, entry.name));

      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.name);
      assert.ok(bytes.equals(readFileSync(resolveSource.resolve(entry.source))), entry.name);
    }

    assert.deepEqual(
      JSON.parse(readFileSync(join(runtimeRoot, 'runtime-manifest.json'), 'utf8')),
      Object.fromEntries(
        Object.entries(runtimeManifest).map(([runtime, entries]) => [
          runtime,
          entries.map(({ source, ...entry }) => entry),
        ]),
      ),
    );

    const notices = readFileSync(join(runtimeRoot, 'THIRD_PARTY_NOTICES.txt'), 'utf8');

    for (const text of [
      'Apache License',
      'GNU LESSER GENERAL PUBLIC LICENSE',
      'GNU GENERAL PUBLIC LICENSE',
      'To use a modified libheif build, replace libheif.js and libheif.wasm in this folder with an interface-compatible build of libheif-js 1.23.5 and update their "bytes" and "sha256" in runtime-manifest.json.',
    ])
      assert.ok(notices.includes(text), `notices miss ${text}`);
  });

  it('keeps runtime glue out of every bundle', () => {
    const assetsRoot = join(process.cwd(), 'out', 'web', 'assets');

    for (const path of listFiles(assetsRoot).filter(
      (file) => !relative(assetsRoot, file).startsWith('runtime'),
    )) {
      const bytes = readFileSync(path);

      for (const marker of ['getWordFontAttributes', 'heif_context_get_primary_image_handle'])
        assert.ok(!bytes.includes(marker), `${path} bundles runtime glue (${marker})`);
    }
  });

  it('keeps the imagesCodes chunk under the per-chunk budget', () => {
    const assetsRoot = join(process.cwd(), 'out', 'web', 'assets');
    const chunks = [...readBuiltWebWorker().matchAll(/import\(["`]\.\/([^"`]+\.js)["`]\)/g)]
      .map((match) => match[1] ?? '')
      .filter((file) => {
        const source = readFileSync(join(assetsRoot, file), 'utf8');

        return hasToolId(source, 'heic-converter') || hasToolId(source, 'image-ocr');
      });

    assert.ok(chunks.length > 0, 'the imagesCodes chunk was not found');

    for (const file of chunks) {
      const bytes = statSync(join(assetsRoot, file)).size;

      assert.ok(bytes <= WORKER_CHUNK_BUDGET, `${file} grew past the per-chunk budget: ${bytes}`);
    }
  });
});
