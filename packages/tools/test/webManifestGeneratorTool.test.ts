import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { webManifestGeneratorTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (webManifestGeneratorTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);
const icons =
  '/icons/icon-192.png 192x192 image/png any\n/icons/icon-512.png 512x512 image/png maskable';

describe('web manifest generator tool', () => {
  it('declares its fields', () => {
    assert.equal(webManifestGeneratorTool.id, 'web-manifest-generator');
    assert.equal(webManifestGeneratorTool.name, 'Web App Manifest Generator');
    assert.equal(webManifestGeneratorTool.category, 'Web/API');
    assert.equal(webManifestGeneratorTool.inputKind, 'none');
    assert.equal(webManifestGeneratorTool.outputKind, 'text');
    assert.equal(webManifestGeneratorTool.autoRun, true);

    assert.deepEqual(
      webManifestGeneratorTool.fields?.map(({ defaultValue, id, label }) => [
        id,
        label,
        defaultValue,
      ]),
      [
        ['name', 'Name', 'Dev Toolora'],
        ['shortName', 'Short name', 'Signal'],
        ['description', 'Description', ''],
        ['startUrl', 'Start URL', '/'],
        ['scope', 'Scope', '/'],
        ['id', 'ID', ''],
        ['display', 'Display', 'standalone'],
        ['orientation', 'Orientation', ''],
        ['themeColor', 'Theme color', '#0f172a'],
        ['backgroundColor', 'Background color', '#ffffff'],
        ['lang', 'Language', ''],
        ['dir', 'Text direction', 'auto'],
        ['categories', 'Categories', ''],
        ['icons', 'Icons', icons],
      ],
    );

    assert.deepEqual(webManifestGeneratorTool.relatedToolIds, [
      'web-pwa-icon-generator',
      'meta-tag-generator',
      'json-format',
    ]);

    assert.ok((contentOf(webManifestGeneratorTool).faq?.length ?? 0) >= 4);
    assert.equal(webManifestGeneratorTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of webManifestGeneratorTool.samples ?? []) {
      const output = await result('web-manifest-generator', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], 'Installable · 2 icons · no findings');
  });

  it('exports the artifact', async () => {
    const sample = webManifestGeneratorTool.samples?.[0];
    const output = await result('web-manifest-generator', '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(output.artifact?.fileName, 'manifest.webmanifest');

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('web-manifest-generator', '', { ...fieldDefaults, themeColor: 'blueish' }),
      /CSS color/,
    );
  });
});
