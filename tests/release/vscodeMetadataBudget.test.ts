import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';

// Inlined into extension.js and every webview; raise it only with a reason.
const BUDGET_BYTES = 19 * 100 * 1024;

const metadata = readFileSync(
  join(process.cwd(), 'apps', 'vscode', 'src', 'extension', 'toolMetadata.generated.ts'),
  'utf8',
);

describe('VS Code tool metadata budget', () => {
  it('stays within the size budget inlined into extension.js and every webview', () => {
    const bytes = Buffer.byteLength(metadata, 'utf8');

    assert.ok(bytes <= BUDGET_BYTES, `toolMetadata.generated.ts is ${bytes} B > ${BUDGET_BYTES} B`);
  });

  it('keeps the tool texts out; they load from content.ts on demand', () => {
    for (const key of ['"documentation"', '"faq"', '"notes"', '"examples"'])
      assert.equal(
        metadata.includes(`${key}:`),
        false,
        `toolMetadata.generated.ts contains ${key}`,
      );
  });
});
