import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { estimateTokens } from '@devtoolora/functions/ai';
import { promptTemplateRendererTool } from '../src/catalog/aiPrompts';
import { contentOf } from './toolContent';

const run = (text: string, fields: Record<string, string> = {}) =>
  promptTemplateRendererTool.run({ fields, text });
const decode = (base64 = '') => Buffer.from(base64, 'base64').toString();
const rejects = (action: () => unknown, message: string) =>
  assert.rejects(
    async () => action(),
    (error) => error instanceof ToolError && error.message.includes(message),
  );

describe('prompt template renderer tool', () => {
  it('declares itself with fresh automatic results', () => {
    assert.equal(promptTemplateRendererTool.id, 'prompt-template-renderer');
    assert.equal(promptTemplateRendererTool.category, 'AI & Prompts');
    assert.equal(promptTemplateRendererTool.autoRun, true);
    assert.equal(promptTemplateRendererTool.freshResults, true);

    assert.deepEqual(
      promptTemplateRendererTool.fields?.map(({ defaultValue, id }) => [id, defaultValue]),
      [
        ['variables', '{}'],
        ['missing', 'error'],
        ['escape', 'none'],
      ],
    );
  });

  it('documents itself and runs each of its six samples', async () => {
    const content = contentOf(promptTemplateRendererTool);

    assert.equal(content.documentation?.length, 2);
    assert.equal(content.examples?.length, 6);
    assert.equal(content.help?.split('\n\n').length, 4);
    assert.ok((content.notes?.length ?? 0) >= 6);
    assert.ok((content.faq?.length ?? 0) >= 4 && (content.faq?.length ?? 0) <= 6);
    assert.equal(promptTemplateRendererTool.samples?.length, 6);

    for (const sample of promptTemplateRendererTool.samples ?? []) {
      const output = await run(sample.text ?? '', { variables: '{}', ...sample.fields });

      assert.ok(output.text.length > 0, sample.label);

      if (sample.fields?.missing !== 'keep') assert.doesNotMatch(output.text, /\{\{/, sample.label);
    }
  });

  it('renders the template with a summary and a prompt.txt artifact', async () => {
    const result = await run('{{#items}}- {{name}}\n{{/items}}Total: {{total}}', {
      variables: JSON.stringify({ items: [{ name: 'a' }, { name: 'b' }], total: 2 }),
    });

    assert.equal(result.text, '- a\n- b\nTotal: 2');
    assert.equal(result.artifact?.fileName, 'prompt.txt');
    assert.equal(decode(result.artifact?.base64), result.text);
    assert.equal(result.artifacts, undefined);

    assert.equal(
      result.summary,
      `Rendered 16 characters · 2 variables · 1 section · 2 iterations · ≈ ${estimateTokens(result.text)} tokens.`,
    );
  });

  it('estimates tokens for output above the estimator input limit', async () => {
    const result = await run('{{a}}{{a}}{{a}}', {
      variables: JSON.stringify({ a: 'a'.repeat(500_000) }),
    });

    assert.equal(result.text.length, 1_500_000);
    assert.match(result.summary ?? '', /^Rendered 1,500,000 characters .* ≈ [\d,]+ tokens\.$/);
  });

  it('lists kept names and escapes HTML on request', async () => {
    const kept = await run('{{a.b}} {{c}} {{a.b}}', { missing: 'keep' });

    assert.equal(kept.text, '{{a.b}} {{c}} {{a.b}}');
    assert.match(kept.summary ?? '', /tokens\. Kept: a\.b, c\.$/);

    const escaped = await run('{{x}}', { escape: 'html', variables: '{"x":"<b>"}' });

    assert.equal(escaped.text, '&lt;b&gt;');
  });

  it('treats empty variables as an empty object', async () => {
    assert.equal((await run('Hi', { variables: '  ' })).text, 'Hi');
  });

  it('reports template, variable and option errors', async () => {
    await rejects(() => run('Hi {{name}}'), 'Variable "name" is missing (line 1).');
    await rejects(() => run('x', { variables: '{"a":}' }), 'Variables: Invalid JSON at line 1');
    await rejects(() => run('x', { variables: '[' }), 'Variables: Invalid JSON at line 1');
    await rejects(() => run('x', { missing: 'skip' }), 'Choose');
    await rejects(() => run('x', { escape: 'xml' }), 'Choose');

    await rejects(
      () => run('x', { variables: `${'['.repeat(65)}${']'.repeat(65)}` }),
      'Variables is nested deeper than 64 levels.',
    );

    await rejects(
      () => run('x', { variables: `"${'a'.repeat(1_000_000)}"` }),
      '1,000,000 characters',
    );
  });
});
