import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsonStringEscapeTool, stringEscaperTool } from '../src/catalog/encoders';
import { contentOf } from './toolContent';

describe('String escaper tool', () => {
  it('presets JSON on the alias', async () => {
    const field = jsonStringEscapeTool.fields?.find((candidate) => candidate.id === 'language');
    const result = await jsonStringEscapeTool.run({ fields: {}, text: '"x"' });

    assert.equal(jsonStringEscapeTool.aliasOf, 'string-escaper');
    assert.equal(field?.type === 'select' && field.defaultValue, 'json');
    assert.equal(result.text, '\\"x\\"');
    assert.equal(result.summary, 'escape \u00b7 json \u00b7 3 characters');
  });

  it('unescapes and wraps in quotes', async () => {
    const decoded = await stringEscaperTool.run({
      fields: { language: 'sql', mode: 'decode' },
      text: "'O''Reilly'",
    });
    const wrapped = await stringEscaperTool.run({
      fields: { language: 'sql', quotes: 'true' },
      text: "O'Reilly",
    });

    assert.equal(decoded.text, "O'Reilly");
    assert.equal(wrapped.text, "'O''Reilly'");
  });

  it('rejects an unknown language and has FAQ content', async () => {
    await assert.rejects(
      async () => stringEscaperTool.run({ fields: { language: 'perl' }, text: 'x' }),
      /Choose/,
    );

    assert.ok(contentOf(stringEscaperTool).faq?.length);
  });

  it('uses the singular for one character', async () => {
    const result = await stringEscaperTool.run({ fields: {}, text: 'x' });

    assert.equal(result.summary, 'escape \u00b7 json \u00b7 1 character');
  });
});
