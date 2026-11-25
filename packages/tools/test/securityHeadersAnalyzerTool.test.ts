import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { securityHeadersAnalyzerTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const tool = securityHeadersAnalyzerTool;
const fieldDefaults = Object.fromEntries(
  (tool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('security headers analyzer tool', () => {
  it('declares its fields', () => {
    assert.equal(tool.id, 'security-headers-analyzer');
    assert.equal(tool.name, 'Security Headers Analyzer');
    assert.equal(tool.category, 'Web/API');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'text');
    assert.equal(tool.sensitiveInput, true);

    assert.deepEqual(
      tool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['format', 'Output', 'report']],
    );

    assert.deepEqual(tool.relatedToolIds, ['http-headers-parser', 'csp-analyzer', 'cookie-parser']);
    assert.ok((contentOf(tool).faq?.length ?? 0) >= 4);
    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of tool.samples ?? []) {
      const output = await result('security-headers-analyzer', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], 'Grade A+ · 6 of 6 graded headers · 0 warnings');
    assert.match(summaries[4] ?? '', /· 2 warnings$/);
  });

  it('exports the artifact', async () => {
    const sample = tool.samples?.[0];
    const output = await result('security-headers-analyzer', sample?.text ?? '', {
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
      result('security-headers-analyzer', 'GET / HTTP/1.1\nHost: x', fieldDefaults),
      /not a request/,
    );
  });
});
