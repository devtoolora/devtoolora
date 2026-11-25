import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { emailHeaderAnalyzerTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const tool = emailHeaderAnalyzerTool;

describe('email header analyzer tool', () => {
  it('declares its fields', () => {
    assert.equal(tool.id, 'email-header-analyzer');
    assert.equal(tool.name, 'Email Header Analyzer');
    assert.equal(tool.category, 'Web/API');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.sensitiveInput, true);
    assert.equal(tool.fields, undefined);

    assert.deepEqual(tool.relatedToolIds, [
      'email-normalizer',
      'http-headers-parser',
      'secret-redactor',
    ]);

    assert.ok((contentOf(tool).faq?.length ?? 0) >= 4);
    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of tool.samples ?? []) {
      const output = await result('email-header-analyzer', sample.text ?? '', {});

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(
      summaries[0],
      '2 hops · 10 s transit · SPF pass · DKIM pass · DMARC pass · 1 medium · 1 info',
    );

    assert.match(summaries[4] ?? '', /^0 hops · SPF pass · DKIM unknown/);
  });

  it('exports the artifact', async () => {
    const output = await result('email-header-analyzer', tool.samples?.[0]?.text ?? '', {});

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(result('email-header-analyzer', 'not a header', {}), /"Name: value"/);
  });
});
