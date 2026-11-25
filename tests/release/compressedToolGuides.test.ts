import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { compressedToolGuidesPlugin } from '../../scripts/vite/compressed-tool-guides';

describe('compressed tool guide build data', () => {
  it('preserves complete Unicode JSON data and rejects runtime imports', () => {
    const plugin = compressedToolGuidesPlugin();
    const hook = plugin.transform;

    assert.equal(typeof hook, 'function');
    if (typeof hook !== 'function') throw new Error('Missing transform hook.');

    const result = hook.call(
      {} as never,
      'export const exampleContent = { title: "Příklady 😀", notes: ["whole text", "\\n"] };',
      '/packages/tools/src/catalog/text/example/content.ts',
    );

    if (!result || typeof result === 'string' || result instanceof Promise)
      throw new Error('Expected synchronous content data.');

    const base64 = String(result.code ?? '').match(/atob\('([^']+)'\)/)?.[1];

    assert.ok(base64);

    assert.deepEqual(JSON.parse(inflateSync(Buffer.from(base64, 'base64')).toString('utf8')), {
      exampleContent: { title: 'Příklady 😀', notes: ['whole text', '\n'] },
    });

    assert.equal(
      hook.call(
        {} as never,
        'import data from "dependency"; export const exampleContent = data;',
        '/packages/tools/src/catalog/text/example/content.ts',
      ),
      undefined,
    );

    assert.equal(
      hook.call({} as never, 'export const value = 1;', '/packages/tools/src/unrelated.ts'),
      undefined,
    );

    const content = hook.call(
      {} as never,
      "import type { ToolContent } from '@devtoolora/core'; export const content: ToolContent = { help: 'Paste text.' };",
      '/packages/tools/src/catalog/text/slugify/content.ts',
    );

    if (!content || typeof content === 'string' || content instanceof Promise)
      throw new Error('Expected synchronous tool content.');

    const contentBase64 = String(content.code ?? '').match(/atob\('([^']+)'\)/)?.[1];

    assert.ok(contentBase64);
    assert.match(String(content.code ?? ''), /export const content=guideData\.content;/);

    assert.deepEqual(
      JSON.parse(inflateSync(Buffer.from(contentBase64, 'base64')).toString('utf8')),
      { content: { help: 'Paste text.' } },
    );
  });
});
