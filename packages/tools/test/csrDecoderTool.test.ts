import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { csrDecoderTool } from '../src/catalog/crypto';

const run = async (text: string, fields: Record<string, string> = {}): Promise<ToolResult> =>
  csrDecoderTool.run({ fields, text });

describe('csr-decoder tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of csrDecoderTool.samples ?? []) {
      const result = await run(sample.text ?? '', sample.fields ?? {});

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes the requests', async () => {
    const results = await Promise.all(
      (csrDecoderTool.samples ?? []).map((sample) => run(sample.text ?? '', sample.fields ?? {})),
    );

    assert.deepEqual(
      results.map((result) => result.summary),
      [
        'CSR · CN=api.example.com · RSA 2048-bit · 3 SANs · signature valid · no findings',
        'CSR · CN=dev.example.test · EC P-256 · 0 SANs · signature valid · 1 medium',
        'CSR · CN=utf8.example.test · RSA 2048-bit · 0 SANs · signature valid · 1 medium · 1 info',
        'CSR · CN=legacy.example.test · RSA 2048-bit · 0 SANs · signature valid · 1 high · 1 medium',
        'CSR · CN=api.example.com · RSA 2048-bit · 3 SANs · signature valid · no findings',
        'CSR · CN=api.example.com · RSA 2048-bit · 3 SANs · signature valid · no findings',
      ],
    );

    assert.ok(!results[2]?.text.includes('hunter2'));
  });

  it('rejects input without a certificate request', async () => {
    await assert.rejects(
      run('hello'),
      (error) => error instanceof ToolError && /CERTIFICATE REQUEST/.test(error.message),
    );
  });
});
