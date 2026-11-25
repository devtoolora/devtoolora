import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('built webview', () => {
  const distRoot = join(process.cwd(), 'apps/vscode/dist/webview');

  it('loads both React apps through dynamic imports from a single module script', () => {
    const builtEntry = readFileSync(join(distRoot, 'assets/main.js'), 'utf8');
    const builtHtml = readFileSync(join(distRoot, 'index.html'), 'utf8');

    assert.doesNotMatch(builtEntry, /(?:from|import)"\.\//);
    assert.match(builtEntry, /import\(["`]\.\/app\.js["`]\)/);
    assert.match(builtEntry, /import\(["`]\.\/sidebarApp\.js["`]\)/);
    assert.equal(builtHtml.match(/<script type="module"/g)?.length, 1);

    for (const placeholder of ['{{CSP}}', '{{APP_CONFIG}}', '{{TOOL_DATA}}'])
      assert.ok(builtHtml.includes(placeholder), placeholder);
  });

  it('ships CSS without remote URLs or fonts, which the CSP blocks', () => {
    const cssAssets = readdirSync(join(distRoot, 'assets')).filter((file) => file.endsWith('.css'));

    assert.ok(cssAssets.length > 1, 'the React chunks ship their own CSS assets');

    for (const file of cssAssets) {
      assert.doesNotMatch(
        readFileSync(join(distRoot, 'assets', file), 'utf8'),
        /https?:\/\/|@font-face/,
        file,
      );
    }
  });
});
