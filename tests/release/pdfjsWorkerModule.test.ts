import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { pdfjsWorkerModulePlugin } from '../../scripts/vite/pdfjs-worker-module';

// pdfjs-dist is a dependency of the functions package, not of the repo root.
const functionsRequire = createRequire(
  join(process.cwd(), 'packages', 'functions', 'package.json'),
);
const workerModulePath = functionsRequire
  .resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  .replaceAll('\\', '/');

function transform(code: string, id: string): unknown {
  const hook = pdfjsWorkerModulePlugin().transform;

  if (typeof hook !== 'function') throw new Error('Missing transform hook.');

  return hook.call({} as never, code, id);
}

describe('pdfjs worker module build plugin', () => {
  it('stops the installed pdfjs worker module from attaching to the tool worker', () => {
    const source = readFileSync(workerModulePath, 'utf8');

    assert.match(source, /"onmessage" in self\) \{\s*this\.initializeFromPort\(self\);/);

    const result = transform(source, workerModulePath) as { code: string };

    assert.doesNotMatch(result.code, /"onmessage" in self/);
    assert.match(result.code, /export \{ WorkerMessageHandler \};/);
  });

  it('fails the build when a pdfjs upgrade changes the auto-attach guard', () => {
    assert.throws(
      () => transform('class WorkerMessageHandler {}', workerModulePath),
      /pdfjs worker auto-attach guard not found/,
    );
  });

  it('leaves other modules, including the standalone pdfjs worker, untouched', () => {
    const minWorkerPath = workerModulePath.replace(/pdf\.worker\.mjs$/, 'pdf.worker.min.mjs');

    assert.equal(transform('export {};', minWorkerPath), undefined);
    assert.equal(transform('export {};', '/src/pdf/text.ts'), undefined);
  });
});
