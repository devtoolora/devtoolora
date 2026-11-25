import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { vscodeToolMetadata } from '../src/extension/toolMetadata.generated';

interface HtmlTestOptions {
  appConfig: string;
  extensionUri: string;
  nonce: string;
  toolData: string;
  webview: {
    asWebviewUri(uri: { fsPath: string }): { toString(): string };
    cspSource: string;
  };
}

type RenderWebviewHtml = (options: HtmlTestOptions) => string;

const testWebview: HtmlTestOptions['webview'] = {
  asWebviewUri: (uri: { fsPath: string }): { toString(): string } => ({
    toString: (): string => `webview:${uri.fsPath}`,
  }),
  cspSource: 'webview-source',
};

function loadRenderer(template: string): RenderWebviewHtml {
  const exports: { renderWebviewHtml?: RenderWebviewHtml } = {};
  const module = { exports };
  const sourceCode = transformSync(
    readFileSync(join(__dirname, '../src/webview/webviewHtml.ts'), 'utf8'),
    { format: 'cjs', loader: 'ts' },
  ).code;

  runInNewContext(sourceCode, {
    exports,
    module,
    require: (moduleName: string): unknown => {
      if (moduleName === 'fs') return { readFileSync: (): string => template };
      if (moduleName === 'vscode')
        return {
          Uri: {
            joinPath: (...parts: string[]): { fsPath: string } => ({ fsPath: join(...parts) }),
          },
        };

      throw new Error(`Unexpected test import: ${moduleName}`);
    },
  });

  const renderWebviewHtml = exports.renderWebviewHtml ?? module.exports.renderWebviewHtml;

  assert.ok(renderWebviewHtml);

  return renderWebviewHtml;
}

describe('webview HTML serialization', () => {
  it('preserves dollar sequences and protects inline JSON from HTML script termination', () => {
    const template =
      '<meta content="{{CSP}}"><script id="app-config" type="application/json">{{APP_CONFIG}}</script><script id="tool-data" type="application/json">{{TOOL_DATA}}</script><script type="module" src="./assets/main.js"></script>';
    const renderWebviewHtml = loadRenderer(template);
    const protectedText =
      '$$from  users$$ $1 $& $` $\' <script>text</script> </ScRiPt><img id="injected" src=x><!--';
    const appConfig = JSON.stringify({ example: protectedText });
    const metadata = [
      ...vscodeToolMetadata,
      { id: 'serialization-test', samples: [{ text: protectedText }] },
    ];
    const toolData = JSON.stringify(metadata);
    const html = renderWebviewHtml({
      appConfig,
      extensionUri: '/extension',
      nonce: 'test-nonce',
      toolData,
      webview: testWebview,
    });
    const dom = new JSDOM(html);

    assert.equal(dom.window.document.querySelectorAll('script').length, 3);
    assert.equal(dom.window.document.getElementById('injected'), null);

    assert.deepEqual(
      JSON.parse(dom.window.document.getElementById('app-config')?.textContent ?? 'null'),
      { example: protectedText },
    );

    assert.deepEqual(
      JSON.parse(dom.window.document.getElementById('tool-data')?.textContent ?? 'null'),
      metadata,
    );

    dom.window.close();
    assert.ok(html.includes('nonce="test-nonce"'));
    assert.ok(html.includes('src="webview:/extension/dist/webview/assets/main.js"'));
  });

  it('lets the webview compile wasm without loosening scripts', () => {
    const html = loadRenderer('{{CSP}}')({
      appConfig: '{}',
      extensionUri: '/extension',
      nonce: 'test-nonce',
      toolData: '[]',
      webview: testWebview,
    });
    // Whole tokens: 'wasm-unsafe-eval' contains unsafe-eval as a substring.
    const scriptSrc =
      html
        .split('; ')
        .find((directive) => directive.startsWith('script-src '))
        ?.split(' ')
        .slice(1) ?? [];

    assert.equal(
      html,
      "default-src 'none'; img-src data: blob:; style-src webview-source; script-src 'nonce-test-nonce' webview-source 'wasm-unsafe-eval'; connect-src webview-source; worker-src blob:",
    );

    assert.ok(scriptSrc.includes("'wasm-unsafe-eval'"));

    for (const token of ["'unsafe-eval'", 'blob:', 'data:'])
      assert.ok(!scriptSrc.includes(token), `script-src must not allow ${token}`);
  });
});
