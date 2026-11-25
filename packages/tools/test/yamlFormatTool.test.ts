import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { yamlFormatTool } from '../src/catalog/formatters/yaml-format/tool';
import { contentOf } from './toolContent';

describe('yaml format tool', () => {
  it('validates without changing the text', async () => {
    const text = 'a:   1\n---\nb: 2\n';
    const result = await yamlFormatTool.run({ fields: { mode: 'validate' }, text });

    assert.equal(result.summary, 'Valid YAML · 2 documents.');
    assert.equal(result.text, text);
  });

  it('formats and rejects tab indentation', async () => {
    const result = await yamlFormatTool.run({ fields: { indentation: '2' }, text: 'a:   1\n' });

    assert.equal(result.text, 'a: 1\n');
    assert.equal(result.summary, 'YAML formatted · 1 document.');

    await assert.rejects(
      async () => yamlFormatTool.run({ fields: { indentation: 'tab' }, text: 'a: 1' }),
      {
        message: /tabs/,
      },
    );

    assert.ok(contentOf(yamlFormatTool).faq?.length);
  });
});
