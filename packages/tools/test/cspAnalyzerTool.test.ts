import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cspAnalyzerTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (cspAnalyzerTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('csp analyzer tool', () => {
  it('declares its fields', () => {
    assert.equal(cspAnalyzerTool.id, 'csp-analyzer');
    assert.equal(cspAnalyzerTool.name, 'CSP Builder & Analyzer');
    assert.equal(cspAnalyzerTool.category, 'Web/API');
    assert.equal(cspAnalyzerTool.inputKind, 'text');
    assert.equal(cspAnalyzerTool.outputKind, 'text');

    assert.deepEqual(
      cspAnalyzerTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['format', 'Output', 'report']],
    );

    assert.deepEqual(cspAnalyzerTool.relatedToolIds, [
      'http-headers-parser',
      'meta-tag-generator',
      'cookie-parser',
    ]);

    assert.ok((contentOf(cspAnalyzerTool).faq?.length ?? 0) >= 4);
    assert.equal(cspAnalyzerTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of cspAnalyzerTool.samples ?? []) {
      const output = await result('csp-analyzer', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], '6 directives · no findings');
  });

  it('writes header and meta formats', async () => {
    const text = cspAnalyzerTool.samples?.[0]?.text ?? '';
    const header = await result('csp-analyzer', text, { format: 'header' });
    const meta = await result('csp-analyzer', text, { format: 'meta' });

    assert.equal(header.artifact?.fileName, 'csp-header.txt');
    assert.equal(meta.artifact?.fileName, 'csp-meta.html');
    assert.equal(meta.language, 'html');
  });

  it('exports the artifact', async () => {
    const sample = cspAnalyzerTool.samples?.[0];
    const output = await result('csp-analyzer', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('csp-analyzer', 'x'.repeat(65_537), fieldDefaults),
      /exceeds 65,536 characters/,
    );
  });
});
