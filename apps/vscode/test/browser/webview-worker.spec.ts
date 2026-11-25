import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { WASM_SIMD_MESSAGE } from '../../../../packages/functions/src/runtime/wasmSupport';
import { vscodeToolMetadata } from '../../src/extension/toolMetadata.generated';
import { extname, join, normalize, sep } from 'node:path';

const assetRoot = join(process.cwd(), 'apps', 'vscode', 'dist', 'webview', 'assets');
// The production webview policy, with 'self' for the webview resource origin.
const webviewCsp =
  "default-src 'none'; script-src 'nonce-smoke' 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src blob:";

test.beforeEach(async ({ page }) => {
  await page.route('**/webview-assets/**', async (route) => {
    const assetName = decodeURIComponent(
      new URL(route.request().url()).pathname.replace('/webview-assets/', ''),
    );
    const assetPath = normalize(join(assetRoot, assetName));

    if (!assetPath.startsWith(`${assetRoot}${sep}`) || !existsSync(assetPath)) {
      await route.fulfill({ status: 404, body: 'Not found' });

      return;
    }

    await route.fulfill({
      status: 200,
      contentType: contentType(assetPath),
      body: readFileSync(assetPath),
    });
  });
});

async function runSmoke(page: Page, csp: string, script: string): Promise<unknown> {
  await page.route('**/webview-smoke.html', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html>
<meta http-equiv="Content-Security-Policy" content="${csp}">
<script nonce="smoke" type="module">
window.__webviewSmoke = (async () => {
${script}
})();
</script>`,
    });
  });

  await page.goto('/webview-smoke.html');

  return page.evaluate(
    () => (window as unknown as { __webviewSmoke: Promise<unknown> }).__webviewSmoke,
  );
}

// Mirrors loadWorkerHost: the unmodified glue followed by worker.js in one blob.
const runtimeWorkerScript = `
  const asset = (name) => fetch('/webview-assets/' + name);
  const [script, manifest] = await Promise.all([
    asset('worker.js').then((response) => response.blob()),
    asset('runtime/runtime-manifest.json').then((response) => response.json()),
  ]);
  async function runRuntime(runtime, toolId, fields) {
    const records = manifest[runtime];
    const glue = records.find((record) => record.kind === 'script').name;
    const worker = new Worker(
      URL.createObjectURL(new Blob([await asset('runtime/' + glue).then((r) => r.blob()), '\\n', script])),
    );
    const files = {};
    for (const record of records)
      if (record.kind === 'data' && (!record.language || record.language === 'eng'))
        files[record.name] = await asset('runtime/' + record.name).then((r) => r.arrayBuffer());
    const request = (message) =>
      new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        worker.addEventListener('error', (event) => reject(new Error(event.message || 'Worker error')));
        worker.addEventListener('message', (event) => {
          if (event.data.id === id) resolve(event.data);
        });
        worker.postMessage({ id, ...message }, Object.values(message.files ?? {}));
      });
    try {
      const loaded = await request({ files, records, runtime, type: 'loadRuntime' });
      return loaded.ok ? await request({ fields, text: '', toolId, type: 'runTool' }) : loaded;
    } finally {
      worker.terminate();
    }
  }
`;

const sampleFields = (toolId: string) =>
  JSON.stringify(vscodeToolMetadata.find((tool) => tool.id === toolId)?.samples?.[0]?.fields);

test('runs OCR and HEIC in runtime workers built like the VS Code host', async ({ page }) => {
  await expect(
    runSmoke(
      page,
      webviewCsp,
      `${runtimeWorkerScript}
  const ocr = await runRuntime('ocr', 'image-ocr', ${sampleFields('image-ocr')});
  const heic = await runRuntime('heic', 'heic-converter', ${sampleFields('heic-converter')});
  return {
    heic: heic.ok ? heic.result.artifact.mimeType + ' ' + heic.result.artifact.base64.slice(0, 4) : heic.error,
    ocr: ocr.ok ? ocr.result.text.includes('Dev Toolora 2026') : ocr.error,
  };`,
    ),
  ).resolves.toEqual({ heic: 'image/jpeg /9j/', ocr: true });
});

test('names the SIMD reason when the page blocks wasm compilation', async ({ page }) => {
  await expect(
    runSmoke(
      page,
      webviewCsp.replace(" 'wasm-unsafe-eval'", ''),
      `${runtimeWorkerScript}
  const ocr = await runRuntime('ocr', 'image-ocr', {});
  return ocr.ok ? 'loaded' : ocr.error;`,
    ),
  ).resolves.toBe(WASM_SIMD_MESSAGE);
});

test('runs the VS Code webview workers from blob URLs under CSP', async ({ page }) => {
  const pdfFields = vscodeToolMetadata.find((tool) => tool.id === 'pdf-text-extractor')
    ?.samples?.[0]?.fields;
  const wireguardFields = vscodeToolMetadata.find((tool) => tool.id === 'wireguard-key-generator')
    ?.samples?.[0]?.fields;
  const compareFields = vscodeToolMetadata.find((tool) => tool.id === 'pdf-compare')?.samples?.[0]
    ?.fields;
  const bcryptFields = vscodeToolMetadata.find((tool) => tool.id === 'bcrypt-hash')?.samples?.[1]
    ?.fields;
  const gifFields = vscodeToolMetadata.find((tool) => tool.id === 'gif-frame-extractor')
    ?.samples?.[0]?.fields;
  const argonFields = vscodeToolMetadata.find((tool) => tool.id === 'argon2-hash')?.samples?.[3]
    ?.fields;
  const gifMakerFields = vscodeToolMetadata.find((tool) => tool.id === 'gif-maker')?.samples?.[0]
    ?.fields;

  await expect(
    runSmoke(
      page,
      webviewCsp,
      `  // Mirrors loadWorkerHost: the shared worker gets pdfjs.js prepended, isolated workers do not.
  const [script, pdfjs] = await Promise.all(
    ['worker.js', 'pdfjs.js'].map(async (name) => (await fetch('/webview-assets/' + name)).blob()),
  );
  const worker = new Worker(URL.createObjectURL(new Blob([pdfjs, '\\n', script])));
  const isolated = new Worker(URL.createObjectURL(script));
  const pending = new Map();
  let nextId = 0;
  for (const target of [worker, isolated]) {
    target.addEventListener('message', (event) => {
      pending.get(event.data.id)?.resolve(event.data);
      pending.delete(event.data.id);
    });
    target.addEventListener('error', (event) => {
      for (const request of pending.values()) request.reject(new Error(event.message || 'Worker error'));
      pending.clear();
    });
  }
  function request(message, target = worker) {
    const id = 'webview-smoke-' + (++nextId);
    target.postMessage({ id, ...message });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Worker did not respond to ' + id));
      }, 60000);
      pending.set(id, {
        reject,
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
      });
    });
  }
  const tools = await request({ type: 'listTools' });
  const ascii = await request({ type: 'runTool', toolId: 'ascii-text-generator', text: 'Hi', fields: { font: 'Standard' } });
  const list = await request({ type: 'runTool', toolId: 'list-converter', text: 'a\\nb', fields: { output: 'sql' } });
  const duration = await request({ type: 'runTool', toolId: 'duration-converter', text: '90', fields: { unit: 'm' } });
  const pdfRun = { type: 'runTool', toolId: 'pdf-text-extractor', text: '', fields: ${JSON.stringify(pdfFields)} };
  const pdf = await request(pdfRun);
  const pdfCompare = await request({ type: 'runTool', toolId: 'pdf-compare', text: '', fields: ${JSON.stringify(compareFields)} });
  const wireguard = await request({ type: 'runTool', toolId: 'wireguard-key-generator', text: '', fields: ${JSON.stringify(wireguardFields)} });
  const bcrypt = await request({ type: 'runTool', toolId: 'bcrypt-hash', text: '', fields: ${JSON.stringify(bcryptFields)} });
  const gif = await request({ type: 'runTool', toolId: 'gif-frame-extractor', text: '', fields: ${JSON.stringify(gifFields)} });
  const argon = await request({ type: 'runTool', toolId: 'argon2-hash', text: '', fields: ${JSON.stringify(argonFields)} });
  const gifMaker = await request({ type: 'runTool', toolId: 'gif-maker', text: '', fields: ${JSON.stringify(gifMakerFields)} });
  const regex = await request({ type: 'runTool', toolId: 'regex-test', text: 'abc', fields: { pattern: 'b' } }, isolated);
  const isolatedPdf = await request(pdfRun, isolated);
  worker.terminate();
  isolated.terminate();
  return {
    argonOk: argon.ok && /^\\$argon2id\\$v=19\\$/.test(argon.result.text),
    asciiOk: ascii.ok && /_   _/.test(ascii.result.text),
    bcryptOk: bcrypt.ok && /^\\$2b\\$04\\$/.test(bcrypt.result.text),
    durationOk: duration.ok && JSON.parse(duration.result.text).iso === 'PT1H30M',
    gifMakerOk: gifMaker.ok && /^3 frames/.test(gifMaker.result.summary),
    gifOk: gif.ok && /3 frames/.test(gif.result.summary),
    isolatedPdfError: isolatedPdf.ok ? '' : isolatedPdf.error,
    isolatedRegexOk: regex.ok,
    listOk: list.ok && list.result.text === "('a', 'b')",
    pdfCompareOk: pdfCompare.ok && /Revenue 120/.test(pdfCompare.result.text),
    pdfOk: pdf.ok && /Quarterly report/.test(pdf.result.text),
    toolCount: tools.ok ? tools.tools.length : 0,
    wireguardOk: wireguard.ok && /PublicKey = [A-Za-z0-9+/]{43}=/.test(wireguard.result.text),
  };`,
    ),
  ).resolves.toEqual({
    argonOk: true,
    asciiOk: true,
    bcryptOk: true,
    durationOk: true,
    gifMakerOk: true,
    gifOk: true,
    isolatedPdfError: 'The PDF reader could not be loaded. Check your connection and try again.',
    isolatedRegexOk: true,
    listOk: true,
    pdfCompareOk: true,
    pdfOk: true,
    toolCount: vscodeToolMetadata.length,
    wireguardOk: true,
  });
});

function contentType(path: string): string {
  if (extname(path) === '.css') return 'text/css';
  if (extname(path) === '.js') return 'text/javascript';

  return 'application/octet-stream';
}
