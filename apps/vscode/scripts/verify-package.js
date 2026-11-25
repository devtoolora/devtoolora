#!/usr/bin/env node

const path = require('node:path');

const extensionRoot = path.resolve(__dirname, '..');
const { requireTs } = require('../../../scripts/lib/requireTs.cjs');

const { verifyFreshPackage, verifyPackagedVsix } = requireTs(
  path.join(extensionRoot, 'release', 'packageVerification.ts'),
);

(async () => {
  try {
    const vsixIndex = process.argv.indexOf('--vsix');
    const summary =
      vsixIndex >= 0
        ? verifyPackagedVsix(path.resolve(process.cwd(), process.argv[vsixIndex + 1]))
        : await verifyFreshPackage(extensionRoot);
    const sizeInMegabytes = (summary.byteSize / (1024 * 1024)).toFixed(2);

    console.log(`VSIX verified: ${summary.entryCount} files, ${sizeInMegabytes} MB.`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    console.error(`Package verification failed: ${detail}`);
    process.exitCode = 1;
  }
})();
