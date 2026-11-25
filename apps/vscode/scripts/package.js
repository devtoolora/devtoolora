#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

// The extension ships no native code, so one VSIX without a target platform covers every platform.
(async () => {
  const extensionRoot = resolve(__dirname, '..');
  const repositoryRoot = resolve(extensionRoot, '..', '..');
  const vscePackage = join(repositoryRoot, 'node_modules', '@vscode', 'vsce');

  if (!existsSync(vscePackage)) {
    console.error('VSIX packaging requires @vscode/vsce. Run npm install first.');
    process.exitCode = 1;

    return;
  }

  await require('@vscode/vsce/out/package').pack({
    cwd: extensionRoot,
    dependencies: false,
    prepublish: false,
    useYarn: false,
    packagePath: join(repositoryRoot, 'devtoolora.vsix'),
  });
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
