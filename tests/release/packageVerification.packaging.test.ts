import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { runtimeManifest } from '@devtoolora/functions/runtime';
import {
  MAX_PACKAGE_BYTES,
  MAX_PACKAGE_FILES,
  REQUIRED_PACKAGE_FILES,
  assertPackageContents,
  assertRequiredPackageFiles,
  smokeTestPackagedBundle,
} from '../../apps/vscode/release/packageVerification';
import { archiveEntries, listFiles } from './packageVerification.helpers';

// worker.js without the wasm glue; it may grow by 30,000 B.
const VSCODE_WORKER_BASELINE = 5_137_342;
const webviewAssets = join(process.cwd(), 'apps', 'vscode', 'dist', 'webview', 'assets');

describe('package verification', () => {
  it('keeps the web app on workspace package boundaries', () => {
    const rootPackage = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    const webPackage = JSON.parse(
      readFileSync(join(process.cwd(), 'apps', 'web', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string>; private?: boolean };
    const vscodePackage = JSON.parse(
      readFileSync(join(process.cwd(), 'apps', 'vscode', 'package.json'), 'utf8'),
    ) as { contributes?: unknown; dependencies?: Record<string, string>; main?: string };

    assert.match(
      readFileSync(join(process.cwd(), 'apps', 'web', 'src', 'worker.ts'), 'utf8'),
      /@devtoolora\/browser-catalog\/lazy/,
    );

    assert.equal(rootPackage.name, 'devtoolora-monorepo');
    assert.equal(rootPackage.private, true);
    assert.deepEqual(rootPackage.engines, { node: '>=22.22' });
    assert.equal(webPackage.private, true);
    for (const dependency of [
      'react',
      'react-router',
      '@devtoolora/core',
      '@tauri-apps/plugin-dialog',
    ])
      assert.ok(webPackage.dependencies?.[dependency]);
    assert.equal(vscodePackage.main, './dist/extension.js');
    assert.ok(vscodePackage.contributes);
    for (const dependency of [
      '@devtoolora/core',
      '@devtoolora/tools',
      '@devtoolora/browser-catalog',
    ])
      assert.ok(vscodePackage.dependencies?.[dependency]);
  });

  it('offers Base64 Encode File on files only', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'apps', 'vscode', 'package.json'), 'utf8'),
    ) as { contributes: { menus: Record<string, Array<{ command: string; when?: string }>> } };
    const entry = manifest.contributes.menus['explorer/context']?.find(
      (item) => item.command === 'devToolora.base64EncodeFile',
    );

    assert.match(entry?.when ?? '', /!explorerResourceIsFolder/);
  });

  it('lists every font embedded in shipped PDF tools', () => {
    const licenses = readFileSync(join(process.cwd(), 'THIRD_PARTY_LICENSES.md'), 'utf8');

    assert.match(licenses, /@fontsource\/noto-sans/);
    assert.match(licenses, /OFL-1\.1/);
  });

  it('omits the run button for autorun tools in the shared web and desktop input panel', () => {
    const inputPanelSource = readFileSync(
      join(
        process.cwd(),
        'packages',
        'tool-ui',
        'src',
        'tool-runner',
        'components',
        'tool-input-panel',
        'ToolInputPanel.tsx',
      ),
      'utf8',
    );

    assert.match(inputPanelSource, /!props\.tool\.autoRun/);
  });

  it('keeps shared packages consumed from source through root public exports', () => {
    for (const packageDirectory of ['core', 'tools', 'browser-catalog']) {
      const packageJson = JSON.parse(
        readFileSync(join(process.cwd(), 'packages', packageDirectory, 'package.json'), 'utf8'),
      ) as {
        exports?: Record<string, unknown>;
        scripts?: Record<string, string>;
      };

      assert.equal(packageJson.exports?.['.'], './src/index.ts');
      assert.equal(packageJson.scripts?.build, undefined);
    }
  });

  it('keeps reusable functions private and available through explicit domain exports', () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'packages', 'functions', 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
      private?: boolean;
    };

    assert.equal(packageJson.private, true);
    assert.equal(packageJson.exports?.['.'], undefined);
    assert.ok(packageJson.exports?.['./errors']);
    assert.ok(packageJson.exports?.['./validation']);

    for (const domain of [
      'ai',
      'binary',
      'color',
      'crypto',
      'encoding',
      'format',
      'web',
      'network',
      'text',
      'data',
      'schema',
      'css',
      'image',
      'qr',
      'svg',
      'pdf',
    ]) {
      assert.ok(packageJson.exports?.[`./${domain}`], `missing functions export: ${domain}`);
    }

    assert.equal(packageJson.dependencies?.['@devtoolora/core'], undefined);
    assert.equal(packageJson.dependencies?.['@devtoolora/tools'], undefined);

    for (const path of listFiles(join(process.cwd(), 'packages', 'functions', 'src')).filter(
      (candidate) => candidate.endsWith('.ts'),
    )) {
      const source = readFileSync(path, 'utf8');

      assert.doesNotMatch(
        source,
        /@devtoolora\/(?:core|tools)|(?:^|\/)apps\//,
        `${path} crosses the function boundary`,
      );

      assert.doesNotMatch(
        source,
        /\b(?:ToolDefinition|ToolResult|ToolInput)\b/,
        `${path} uses a tool presentation contract`,
      );
    }

    const toolsPackage = JSON.parse(
      readFileSync(join(process.cwd(), 'packages', 'tools', 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    assert.deepEqual(Object.keys(toolsPackage.dependencies ?? {}).sort(), [
      '@devtoolora/core',
      '@devtoolora/functions',
    ]);
  });

  it('keeps app source on shared package public entrypoints', () => {
    const appSourceFiles = [
      ...listFiles(join(process.cwd(), 'apps', 'web', 'src')),
      ...listFiles(join(process.cwd(), 'apps', 'vscode', 'src')),
    ].filter((path) => /\.(?:ts|tsx|js|mjs)$/.test(path));

    for (const path of appSourceFiles) {
      const source = readFileSync(path, 'utf8');
      const sourceWithoutPublicSubpaths = source
        .replaceAll('@devtoolora/browser-catalog/content', '')
        .replaceAll('@devtoolora/browser-catalog/lazy', '')
        .replaceAll('@devtoolora/browser-catalog/worker', '')
        .replaceAll('@devtoolora/core/context', '')
        .replace(/@devtoolora\/functions\/[a-z-]+/g, '');

      assert.doesNotMatch(
        sourceWithoutPublicSubpaths,
        /@devtoolora\/(?:core|functions|tools|browser-catalog)\//,
        `${path} should import shared packages from public entrypoints`,
      );

      assert.doesNotMatch(
        source,
        /(?:\.\.?\/)+packages\/(?:core|functions|tools|browser-catalog)\//,
        `${path} should not import shared package internals by relative path`,
      );
    }
  });

  it('keeps a Tauri desktop app shell around the shared web app', () => {
    const desktopRoot = join(process.cwd(), 'apps', 'desktop');
    const desktopPackage = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8')) as {
      devDependencies?: Record<string, string>;
    };
    const tauriConfig = JSON.parse(
      readFileSync(join(desktopRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'),
    ) as {
      app?: {
        security?: { csp?: string | null };
        windows?: Array<{ minHeight?: number; minWidth?: number; url?: string }>;
      };
      build?: { beforeBuildCommand?: string; devUrl?: string; frontendDist?: string };
      bundle?: { icon?: string[] };
      identifier?: string;
      productName?: string;
    };
    const capability = readFileSync(
      join(desktopRoot, 'src-tauri', 'capabilities', 'default.json'),
      'utf8',
    );
    const cargoManifest = readFileSync(join(desktopRoot, 'src-tauri', 'Cargo.toml'), 'utf8');

    assert.ok(desktopPackage.devDependencies?.['@tauri-apps/cli']?.startsWith('^2.'));
    assert.match(cargoManifest, /tauri = \{ version = "2"/);
    assert.match(cargoManifest, /^name = "devtoolora-desktop"$/m);
    assert.match(cargoManifest, /^license = "MIT"$/m);
    for (const plugin of ['dialog', 'fs', 'clipboard-manager', 'window-state'])
      assert.match(cargoManifest, new RegExp(`tauri-plugin-${plugin}`));

    for (const permission of [
      'dialog:allow-open',
      'dialog:allow-save',
      'fs:allow-read-file',
      'fs:allow-stat',
      'fs:allow-write-file',
      'clipboard-manager:allow-write-text',
      'window-state:default',
    ]) {
      assert.match(capability, new RegExp(permission));
    }

    assert.equal(tauriConfig.productName, 'Dev Toolora');
    assert.equal(tauriConfig.identifier, 'dev.devtoolora.app');
    assert.ok(tauriConfig.bundle?.icon?.includes('icons/icon.icns'));
    assert.ok(tauriConfig.bundle?.icon?.includes('icons/icon.ico'));
    assert.equal(tauriConfig.app?.windows?.[0]?.url, 'desktop/index.html');
    assert.equal(tauriConfig.app?.windows?.[0]?.minWidth, 900);
    assert.equal(tauriConfig.app?.windows?.[0]?.minHeight, 640);
    assert.match(tauriConfig.app?.security?.csp ?? '', /default-src 'self'/);
    assert.equal(tauriConfig.build?.beforeBuildCommand, 'npm run build:web --prefix ../..');
    assert.equal(tauriConfig.build?.devUrl, 'http://localhost:5173');
    assert.equal(tauriConfig.build?.frontendDist, '../../../out/web');
  });

  it('lets the desktop CSP compile wasm and fetch runtime files without loosening scripts', () => {
    const tauriConfig = JSON.parse(
      readFileSync(join(process.cwd(), 'apps', 'desktop', 'src-tauri', 'tauri.conf.json'), 'utf8'),
    ) as { app?: { security?: { csp?: string } } };
    // Whole tokens: 'wasm-unsafe-eval' contains unsafe-eval as a substring.
    const directives = new Map(
      (tauriConfig.app?.security?.csp ?? '')
        .split(';')
        .map((directive) => directive.trim().split(/\s+/))
        .filter(([name]) => name)
        .map(([name = '', ...tokens]) => [name, tokens]),
    );
    const scriptSrc = directives.get('script-src') ?? [];

    assert.deepEqual(scriptSrc, ["'self'", "'wasm-unsafe-eval'"]);

    for (const token of ['blob:', "'unsafe-eval'", 'data:'])
      assert.ok(!scriptSrc.includes(token), `script-src must not allow ${token}`);

    assert.ok(directives.get('connect-src')?.includes("'self'"), "connect-src needs 'self'");
  });

  it('builds CI artifacts and only drafts a release for a version tag', () => {
    const workflowRoot = join(process.cwd(), '.github', 'workflows');
    const workflow = readFileSync(join(workflowRoot, 'ci.yml'), 'utf8');

    for (const trigger of ['pull_request:', 'push:', 'workflow_dispatch:']) {
      assert.match(workflow, new RegExp(trigger));
    }

    for (const command of [
      'npm run test:coverage',
      'playwright test --config playwright.browser.config.ts',
      'npm run package:verify',
      'npm run desktop:build',
    ]) {
      assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const artifact of ['web-pwa', 'name: vsix', 'desktop-${{ matrix.name }}']) {
      assert.match(workflow, new RegExp(artifact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const target of ['macos-latest', 'windows-latest', 'ubuntu-22.04']) {
      assert.match(workflow, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    assert.match(workflow, /permissions:\s+contents: read/);
    // A tag may create a draft for review; publishing and signing stay manual.
    assert.match(workflow, /gh release create "\$GITHUB_REF_NAME" --draft/);
    assert.equal(workflow.match(/contents: write/g)?.length, 1);
    assert.doesNotMatch(workflow, /VSCE_PAT|secrets\.|vsce publish|ovsx publish|--draft=false/);
  });

  it('accepts a VSIX containing the required extension and webview assets', () => {
    assert.doesNotThrow(() => assertRequiredPackageFiles(archiveEntries(REQUIRED_PACKAGE_FILES)));
  });

  it('names every missing required archive file', () => {
    assert.throws(
      () => assertRequiredPackageFiles(archiveEntries(['extension/package.json'])),
      /extension\/dist\/extension\.js.*extension\/dist\/webview\/index\.html/s,
    );
  });

  it('excludes source files', () => {
    assert.doesNotThrow(() => assertPackageContents(archiveEntries(REQUIRED_PACKAGE_FILES)));

    assert.throws(
      () =>
        assertPackageContents(
          archiveEntries([...REQUIRED_PACKAGE_FILES, 'extension/src/extension.ts']),
        ),
      /excluded build files/,
    );
  });

  it('allows the lazy FIGlet webview chunks without removing the package file budget', () => {
    assert.ok(MAX_PACKAGE_FILES >= 323);

    assert.throws(
      () =>
        assertPackageContents(
          archiveEntries([
            ...REQUIRED_PACKAGE_FILES,
            ...Array.from(
              { length: MAX_PACKAGE_FILES },
              (_, index) => `extension/dist/webview/assets/extra-${index}.js`,
            ),
          ]),
        ),
      /maximum/,
    );
  });

  it('packages VSIX files without rerunning the prepublish build', () => {
    const releaseVerifier = readFileSync(
      join(process.cwd(), 'apps', 'vscode', 'release', 'packageVerification.ts'),
      'utf8',
    );
    const packageTarget = readFileSync(
      join(process.cwd(), 'apps', 'vscode', 'scripts', 'package.js'),
      'utf8',
    );

    assert.match(releaseVerifier, /pack\(\{[\s\S]*prepublish: false/);
    assert.match(packageTarget, /pack\(\{[\s\S]*prepublish: false/);
    assert.doesNotMatch(releaseVerifier, /vsce['"], 'package/);
    assert.doesNotMatch(packageTarget, /vsce['"], 'package/);
  });

  it('loads the bundled extension host and its tool metadata', () => {
    assert.doesNotThrow(() => smokeTestPackagedBundle(join(process.cwd(), 'apps', 'vscode')));
  });

  it('keeps tool code out of the extension host bundle', () => {
    const bundle = readFileSync(
      join(process.cwd(), 'apps', 'vscode', 'dist', 'extension.js'),
      'utf8',
    );

    assert.doesNotMatch(bundle, /node_modules\/(pdf-lib|qrcode|exifr|jsqr)\//);
    assert.doesNotMatch(bundle, /pdfjsWorker|getDocument/);

    assert.doesNotMatch(
      bundle,
      /runToolWithCapability|browserWorkerTools|@devtoolora\/browser-catalog/,
    );

    for (const dependency of ['pdf-lib', 'qrcode', 'exifr', 'jsqr']) {
      assert.doesNotMatch(
        bundle,
        new RegExp(`require\\(["']${dependency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\)`),
      );
    }
  });

  it('ships pdfjs as its own script, off the VS Code tool worker channel', () => {
    const assets = join(process.cwd(), 'apps', 'vscode', 'dist', 'webview', 'assets');
    const worker = readFileSync(join(assets, 'worker.js'), 'utf8');
    const pdfjs = readFileSync(join(assets, 'pdfjs.js'), 'utf8');

    const publishesPdfjsLib = /globalThis\.pdfjsLib\s*=/;

    // assert.ok keeps the multi-MB bundles out of the failure message.
    assert.ok(!publishesPdfjsLib.test(worker), 'pdf.mjs is bundled into worker.js');

    assert.ok(
      !worker.includes('static initializeFromPort('),
      'the pdfjs worker module is bundled into worker.js',
    );

    assert.ok(publishesPdfjsLib.test(pdfjs), 'pdfjs.js does not publish pdfjsLib');
    assert.ok(pdfjs.includes('static initializeFromPort('), 'pdfjs worker module is not bundled');

    assert.ok(
      !pdfjs.includes('initializeFromPort(self)'),
      'pdfjs worker module would attach to the shared tool worker channel at startup',
    );
  });

  it('ships the wasm runtimes beside the VS Code worker, never inside it', () => {
    const worker = readFileSync(join(webviewAssets, 'worker.js'));
    const resolveSource = createRequire(
      join(process.cwd(), 'packages', 'functions', 'package.json'),
    );

    assert.ok(
      worker.byteLength <= VSCODE_WORKER_BASELINE + 30_000,
      `worker.js is ${worker.byteLength} B; budget is ${VSCODE_WORKER_BASELINE + 30_000} B`,
    );

    for (const marker of ['getWordFontAttributes', 'heif_context_get_primary_image_handle'])
      assert.ok(!worker.includes(marker), `worker.js bundles runtime glue (${marker})`);

    for (const entry of Object.values(runtimeManifest).flat()) {
      const bytes = readFileSync(join(webviewAssets, 'runtime', entry.name));
      const source = readFileSync(resolveSource.resolve(entry.source));

      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        createHash('sha256').update(source).digest('hex'),
        entry.name,
      );
    }

    for (const name of ['runtime-manifest.json', 'THIRD_PARTY_NOTICES.txt'])
      assert.ok(statSync(join(webviewAssets, 'runtime', name)).size > 0, name);
  });

  it('requires the runtime files in the VSIX and keeps it under 12 MiB', () => {
    const runtimeFiles = [
      ...Object.values(runtimeManifest)
        .flat()
        .map((entry) => entry.name),
      'runtime-manifest.json',
      'THIRD_PARTY_NOTICES.txt',
    ];

    for (const name of runtimeFiles) {
      assert.ok(
        REQUIRED_PACKAGE_FILES.some(
          (file) => file === `extension/dist/webview/assets/runtime/${name}`,
        ),
        `${name} is not a required VSIX file`,
      );
    }

    assert.equal(MAX_PACKAGE_BYTES, 12 * 1024 * 1024);
  });
});
