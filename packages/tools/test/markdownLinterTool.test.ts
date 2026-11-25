import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { markdownLintRules } from '@devtoolora/functions/text';
import { markdownLinterTool } from '../src/catalog/text';
import { fieldsOf, result } from './tools.helpers';

const decode = (base64: string | undefined): string =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');
const vector = '# Title\n\n### Skipped\ntext   \n\n\nend';
const allRules = markdownLintRules.join(',');

describe('markdown linter tool', () => {
  it('declares its fields', () => {
    const tool = markdownLinterTool;

    assert.equal(tool.id, 'markdown-linter');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.supportsSelection, true);
    assert.equal(tool.autoRun, true);
    assert.equal(tool.freshResults, true);
    assert.deepEqual(tool.resultActions, ['copy', 'scratch', 'save']);

    assert.deepEqual(tool.relatedToolIds, [
      'markdown-helper',
      'markdown-toc',
      'whitespace-cleaner',
    ]);

    assert.equal(tool.fields?.[0]?.id, 'rules');
    assert.equal(tool.fields?.[0]?.label, 'Rules');
    assert.equal(tool.fields?.[0]?.type, 'checkboxGroup');
    assert.equal(tool.fields?.[0]?.defaultValue, allRules);

    assert.deepEqual(
      tool.fields?.[0]?.options?.map((option) => option.value),
      [...markdownLintRules],
    );

    assert.equal(tool.fields?.[0]?.options?.[0]?.label, 'MD001 heading increment');

    assert.deepEqual(
      fieldsOf(tool)?.[1]?.options?.map((option) => option.value),
      ['report', 'json'],
    );
  });

  it('returns the report and the JSON artifact', async () => {
    const output = await result('markdown-linter', vector, { output: 'report', rules: allRules });

    assert.equal(output.summary, '5 issues from 5 rules in 7 lines.');
    assert.match(output.text, /^3:1 MD001\/heading-increment /);
    assert.equal(output.artifact?.fileName, 'markdown-lint.txt');
    assert.equal(decode(output.artifact?.base64), output.text);

    assert.deepEqual(
      output.artifacts?.map((artifact) => artifact.fileName),
      ['markdown-lint.json'],
    );

    assert.equal(JSON.parse(decode(output.artifacts?.[0]?.base64)).total, 5);
  });

  it('returns JSON as the text', async () => {
    const output = await result('markdown-linter', vector, { output: 'json', rules: allRules });
    const json = JSON.parse(output.text);

    assert.equal(json.total, 5);
    assert.equal(json.issues[0].rule, 'MD001/heading-increment');
    assert.equal(output.artifact?.fileName, 'markdown-lint.json');

    assert.deepEqual(
      output.artifacts?.map((artifact) => artifact.fileName),
      ['markdown-lint.txt'],
    );
  });

  it('caps the JSON issues and keeps the total', async () => {
    const output = await result('markdown-linter', 'x\t\n'.repeat(1_001), {
      output: 'json',
      rules: 'MD010/no-hard-tabs',
    });
    const json = JSON.parse(output.text);

    assert.equal(json.total, 1001);
    assert.equal(json.issues.length, 1000);
  });

  it('rejects empty and unknown rules', async () => {
    await assert.rejects(
      result('markdown-linter', vector, { rules: '' }),
      (error: Error) => error.message === 'Choose at least one rule.',
    );

    await assert.rejects(
      result('markdown-linter', vector, { rules: 'MD001/heading-increment,MD999' }),
      (error: Error) => error.message === 'Choose listed rules.',
    );
  });

  it('runs every sample', async () => {
    for (const sample of markdownLinterTool.samples ?? [])
      assert.ok(
        (await result('markdown-linter', sample.text ?? '', { rules: allRules, ...sample.fields }))
          .summary!.length > 0,
        sample.label,
      );
  });
});
