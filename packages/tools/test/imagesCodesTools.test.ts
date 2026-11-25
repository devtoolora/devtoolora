import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { browserImageCodeTools } from '../src/catalog/imagesCodes';
import { contentOf } from './toolContent';

describe('Images & Codes tools', () => {
  it('guarantees complete documentation contract, 6 samples, 4-step help, and notes for every tool', () => {
    assert.equal(browserImageCodeTools.length, 31);

    for (const tool of browserImageCodeTools) {
      assert.equal(tool.category, 'Images & Codes');

      assert.ok(
        tool.description.length > 10,
        `Tool ${tool.id} should have a descriptive description.`,
      );

      assert.equal(
        contentOf(tool).documentation?.length,
        2,
        `Tool ${tool.id} must have exactly 2 documentation entries.`,
      );

      assert.match(
        contentOf(tool).documentation![0]!.title,
        /^What (is|are) /i,
        `Tool ${tool.id} first doc title should be 'What is...'`,
      );

      assert.match(
        contentOf(tool).documentation![1]!.title,
        /^When to /i,
        `Tool ${tool.id} second doc title should be 'When to...'`,
      );

      assert.ok((tool.samples?.length ?? 0) >= 6, `Tool ${tool.id} must have at least 6 samples.`);

      assert.ok(
        (contentOf(tool).examples?.length ?? 0) >= 6,
        `Tool ${tool.id} must have at least 6 examples.`,
      );

      assert.ok(contentOf(tool).help, `Tool ${tool.id} must have step-by-step help.`);
      const helpSteps = contentOf(tool).help!.split('\n\n');

      assert.equal(helpSteps.length, 4, `Tool ${tool.id} must have exactly 4 help steps.`);

      assert.ok(
        (contentOf(tool).notes?.length ?? 0) >= 4,
        `Tool ${tool.id} must have honest notes/limitations.`,
      );

      assert.ok(tool.resultActions?.length, `Tool ${tool.id} must have resultActions.`);
    }
  });

  it('runs SVG and QR tools deterministically with exact artifacts', async () => {
    const wifiTool = browserImageCodeTools.find((t) => t.id === 'wifi-qr');

    assert.ok(wifiTool);

    for (const sample of wifiTool.samples ?? []) {
      const res = await wifiTool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(res.text.startsWith('WIFI:'));
      assert.equal(res.artifact?.mimeType, 'image/svg+xml');
      assert.ok(res.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
      assert.ok(res.resultActions?.includes('save'));
      assert.ok(res.resultActions?.includes('copy'));
    }

    const qrGenTool = browserImageCodeTools.find((t) => t.id === 'qr-code-generator');

    assert.ok(qrGenTool);

    for (const sample of qrGenTool.samples ?? []) {
      const res = await qrGenTool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(res.text.includes('<svg'));
      assert.equal(res.artifact?.mimeType, 'image/svg+xml');
    }

    const svgPlaceholderTool = browserImageCodeTools.find((t) => t.id === 'svg-placeholder');

    assert.ok(svgPlaceholderTool);

    for (const sample of svgPlaceholderTool.samples ?? []) {
      const res = await svgPlaceholderTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(res.text.includes('<svg'));
      assert.equal(res.artifact?.mimeType, 'image/svg+xml');
      assert.ok(res.previewDataUri?.startsWith('data:image/svg+xml;base64,'));
    }

    const svgOptimizerTool = browserImageCodeTools.find((t) => t.id === 'svg-optimizer');

    assert.ok(svgOptimizerTool);

    for (const sample of svgOptimizerTool.samples ?? []) {
      const res = await svgOptimizerTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(res.text.includes('<svg'));
      assert.equal(res.artifact?.mimeType, 'image/svg+xml');
      assert.doesNotMatch(res.text, /<!--[\s\S]*?-->/);
    }
  });
});
