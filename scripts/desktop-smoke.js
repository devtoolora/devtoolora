#!/usr/bin/env node

const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { requireTs } = require('./lib/requireTs.cjs');

const projectRoot = resolve(__dirname, '..');
const tauriRoot = join(projectRoot, 'apps', 'desktop', 'src-tauri');

function requireFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required desktop smoke file: ${path}`);
  }
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);

    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function requireIncludes(source, values, label) {
  for (const value of values) {
    if (!source.includes(value)) throw new Error(`${label} is missing ${value}.`);
  }
}

try {
  requireFile(join(projectRoot, 'out', 'web', 'index.html'));
  requireFile(join(projectRoot, 'out', 'web', 'desktop', 'index.html'));

  const builtAssets = readdirSync(join(projectRoot, 'out', 'web', 'assets'));

  for (const entry of [/^worker-[\w-]+\.js$/, /^desktop-[\w-]+\.js$/]) {
    if (!builtAssets.some((file) => entry.test(file)))
      throw new Error(`Missing required desktop smoke asset matching ${entry}.`);
  }

  requireFile(join(tauriRoot, 'Cargo.toml'));
  requireFile(join(tauriRoot, 'src', 'lib.rs'));

  const config = JSON.parse(readFileSync(join(tauriRoot, 'tauri.conf.json'), 'utf8'));

  for (const icon of config.bundle?.icon ?? []) requireFile(join(tauriRoot, icon));

  const runtimeRoot = join(projectRoot, 'out', 'web', 'assets', 'runtime');

  requireFile(join(runtimeRoot, 'THIRD_PARTY_NOTICES.txt'));
  requireFile(join(runtimeRoot, 'runtime-manifest.json'));

  const runtimeManifest = JSON.parse(
    readFileSync(join(runtimeRoot, 'runtime-manifest.json'), 'utf8'),
  );

  for (const entry of Object.values(runtimeManifest).flat()) {
    requireFile(join(runtimeRoot, entry.name));

    if (statSync(join(runtimeRoot, entry.name)).size !== entry.bytes)
      throw new Error(`Runtime file ${entry.name} does not match its manifest size.`);
  }

  const htmlDocuments = listFiles(join(projectRoot, 'out', 'web')).filter((path) =>
    path.endsWith('.html'),
  );

  const { webToolAliases, webToolMetadata } = requireTs(
    join(projectRoot, 'apps', 'web', 'src', 'toolMetadata.generated.ts'),
  );
  // 5 shell pages, /desktop and the SPA fallback.
  const expectedDocuments = 7 + webToolMetadata.length + webToolAliases.length;

  if (htmlDocuments.length !== expectedDocuments) {
    throw new Error(`Expected ${expectedDocuments} HTML documents, found ${htmlDocuments.length}.`);
  }

  const assetsRoot = join(projectRoot, 'out', 'web', 'assets');
  const desktopScripts = readdirSync(assetsRoot).filter((file) => /^desktop-.*\.js$/.test(file));

  if (desktopScripts.length !== 1)
    throw new Error(`Expected one desktop route chunk, found ${desktopScripts.length}.`);

  const desktopSource = readFileSync(join(assetsRoot, desktopScripts[0]), 'utf8');

  requireIncludes(
    desktopSource,
    ['plugin:dialog', 'plugin:fs', 'plugin:clipboard-manager'],
    'Desktop route chunk',
  );

  for (const file of readdirSync(assetsRoot).filter(
    (name) => name.endsWith('.js') && !desktopScripts.includes(name),
  )) {
    if (readFileSync(join(assetsRoot, file), 'utf8').includes('plugin:dialog')) {
      throw new Error(`Tauri dialog code leaked into non-desktop chunk ${file}.`);
    }
  }

  const serviceWorker = readFileSync(join(projectRoot, 'out', 'web', 'sw.js'), 'utf8');

  if (serviceWorker.includes('/desktop') || serviceWorker.includes('/assets/desktop-')) {
    throw new Error('Desktop route assets must not be precached by the public PWA.');
  }

  const cargoVersion = spawnSync('cargo', ['--version'], { encoding: 'utf8' });

  if (cargoVersion.error && cargoVersion.error.code === 'ENOENT') {
    console.log(
      'Desktop smoke verified web/Tauri shell files; cargo not found, skipping Rust cargo check.',
    );

    process.exit(0);
  }

  if (cargoVersion.status !== 0) {
    throw new Error(cargoVersion.stderr || 'cargo --version failed.');
  }

  const cargoCheck = spawnSync(
    'cargo',
    ['check', '--manifest-path', join(tauriRoot, 'Cargo.toml')],
    {
      cwd: projectRoot,
      stdio: 'inherit',
    },
  );

  if (cargoCheck.error) {
    throw cargoCheck.error;
  }

  if (cargoCheck.status !== 0) {
    process.exit(cargoCheck.status ?? 1);
  }
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);

  console.error(`Desktop smoke failed: ${detail}`);
  process.exitCode = 1;
}
