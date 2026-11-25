import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { estimateTokens } from '@devtoolora/functions/ai';
import { functionSchemaBuilderTool } from '../src/catalog/aiPrompts';
import { contentOf } from './toolContent';

const run = (text: string, fields: Record<string, string> = {}) =>
  functionSchemaBuilderTool.run({
    fields: { description: 'Get the weather.', ...fields },
    text,
  });
const decode = (base64 = '') => Buffer.from(base64, 'base64').toString();
const rejects = (action: () => unknown, message: string) =>
  assert.rejects(
    async () => action(),
    (error) => error instanceof ToolError && error.message.includes(message),
  );

describe('function-calling schema builder tool', () => {
  it('declares itself with fresh automatic results', () => {
    assert.equal(functionSchemaBuilderTool.id, 'function-schema-builder');
    assert.equal(functionSchemaBuilderTool.name, 'Function-Calling Schema Builder');
    assert.equal(functionSchemaBuilderTool.category, 'AI & Prompts');
    assert.equal(functionSchemaBuilderTool.autoRun, true);
    assert.equal(functionSchemaBuilderTool.freshResults, true);
    assert.deepEqual(functionSchemaBuilderTool.resultActions, ['copy', 'scratch', 'save']);

    assert.deepEqual(
      functionSchemaBuilderTool.fields?.map(({ defaultValue, id, required }) => [
        id,
        defaultValue,
        required ?? false,
      ]),
      [
        ['name', 'get_weather', false],
        ['description', 'Get the current weather for a city.', true],
        ['provider', 'all', false],
        ['strict', 'true', false],
      ],
    );
  });

  it('documents itself and runs each of its six samples', async () => {
    const content = contentOf(functionSchemaBuilderTool);

    assert.equal(content.documentation?.length, 2);
    assert.equal(content.examples?.length, 6);
    assert.equal(content.help?.split('\n\n').length, 4);
    assert.ok((content.notes?.length ?? 0) >= 6);
    assert.ok((content.faq?.length ?? 0) >= 4 && (content.faq?.length ?? 0) <= 6);
    assert.ok(content.notes?.some((note) => note.includes('Responses API')));
    assert.equal(functionSchemaBuilderTool.samples?.length, 6);

    for (const sample of functionSchemaBuilderTool.samples ?? []) {
      const output = await run(sample.text ?? '', sample.fields);

      assert.ok(JSON.parse(output.text), sample.label);
    }
  });

  it('returns the JSON as text and as <name>.tools.json', async () => {
    const result = await run('{"city":"Prague"}', { name: 'lookup_city' });
    const output = JSON.parse(result.text);

    assert.deepEqual(Object.keys(output), ['anthropic', 'gemini', 'openai']);
    assert.equal(output.openai.function.name, 'lookup_city');
    assert.equal(output.openai.function.strict, true);
    assert.equal(result.text, JSON.stringify(output, null, 2));
    assert.equal(result.artifact?.fileName, 'lookup_city.tools.json');
    assert.equal(result.artifact?.mimeType, 'application/json;charset=utf-8');
    assert.equal(decode(result.artifact?.base64), result.text);

    assert.equal(
      result.summary,
      `OpenAI (strict), Anthropic and Gemini tool definitions for lookup_city · ≈ ${estimateTokens(JSON.stringify(output))} tokens.`,
    );
  });

  it('builds one provider and honours the strict checkbox', async () => {
    const result = await run('{"city":"Prague"}', { provider: 'openai', strict: 'false' });

    assert.equal(JSON.parse(result.text).function.strict, false);
    assert.match(result.summary ?? '', /^OpenAI tool definition for get_weather · /);

    const gemini = await run('{"city":"Prague"}', { provider: 'gemini' });

    assert.ok(JSON.parse(gemini.text).functionDeclarations);
    assert.match(gemini.summary ?? '', /^Gemini tool definition for get_weather · /);
  });

  it('lists keywords dropped in strict mode', async () => {
    const result = await run('{"__proto__":{"a":1},"city":"Prague"}', { provider: 'openai' });

    assert.match(result.summary ?? '', / Dropped in OpenAI strict mode: patternProperties\.$/);
  });

  it('adds schema warnings to the summary', async () => {
    const result = await run('{"tags":[]}', { provider: 'anthropic' });

    assert.match(
      result.summary ?? '',
      / tokens\. tags is an empty array in every example, so its items have no type\. Add an item so its type can be inferred\.$/,
    );
  });

  it('reports input and option errors', async () => {
    await rejects(() => run('{"a":1}', { provider: 'xai' }), 'Choose');

    await rejects(
      () => run('{"a":1}', { strict: 'yes' }),
      'Checkbox values must be true or false.',
    );

    await rejects(() => run('{"a":1}', { name: 'get weather' }), 'Name must be 1-64 characters');
    await rejects(() => run('{"a":1}', { description: ' ' }), 'Description must be 1-1,024');
    await rejects(() => run('[1]'), 'Example 1 must be a JSON object.');
    await rejects(() => run('{"a":'), 'Example arguments: ');
  });
});
