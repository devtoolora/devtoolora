import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { redirectRulesTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (redirectRulesTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('redirect rules tool', () => {
  it('declares its fields', () => {
    assert.equal(redirectRulesTool.id, 'redirect-rules');
    assert.equal(redirectRulesTool.name, 'Redirect Rule Generator');
    assert.equal(redirectRulesTool.category, 'Web/API');
    assert.equal(redirectRulesTool.inputKind, 'text');
    assert.equal(redirectRulesTool.outputKind, 'text');

    assert.deepEqual(
      redirectRulesTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['target', 'Target', 'netlify'],
        ['status', 'Default status', '301'],
      ],
    );

    assert.deepEqual(redirectRulesTool.relatedToolIds, ['url-parse', 'http-status', 'robots-txt']);
    assert.ok((contentOf(redirectRulesTool).faq?.length ?? 0) >= 4);
    assert.equal(redirectRulesTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of redirectRulesTool.samples ?? []) {
      const output = await result('redirect-rules', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], '3 rules · Netlify / Cloudflare Pages · no findings');
  });

  it('exports the artifact', async () => {
    const sample = redirectRulesTool.samples?.[0];
    const output = await result('redirect-rules', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );

    assert.equal(output.artifact?.fileName, '_redirects');
  });

  it('rejects invalid input', async () => {
    await assert.rejects(result('redirect-rules', 'old new', fieldDefaults), /must start with/);
  });
});
