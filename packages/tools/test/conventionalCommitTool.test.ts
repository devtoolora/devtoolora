import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { conventionalCommitTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

describe('conventional commit tool', () => {
  const fields = {
    body: '',
    breaking: 'false',
    breakingText: '',
    description: 'add arrays',
    footers: '',
    scope: 'parser',
    type: 'feat',
  };

  it('declares its fields and conditions', () => {
    assert.equal(conventionalCommitTool.id, 'conventional-commit');
    assert.equal(conventionalCommitTool.name, 'Conventional Commit Builder');
    assert.equal(conventionalCommitTool.category, 'Dev Utilities');
    assert.equal(conventionalCommitTool.inputKind, 'none');
    assert.equal(conventionalCommitTool.outputKind, 'text');
    assert.equal(conventionalCommitTool.autoRun, true);

    assert.deepEqual(
      conventionalCommitTool.fields?.map(({ defaultValue, id, label, type }) => [
        id,
        label,
        type,
        defaultValue,
      ]),
      [
        ['type', 'Type', 'select', 'feat'],
        ['scope', 'Scope', 'text', undefined],
        ['description', 'Description', 'text', undefined],
        ['breaking', 'Breaking change', 'checkbox', 'false'],
        ['breakingText', 'Breaking change description', 'text', undefined],
        ['body', 'Body', 'textarea', undefined],
        ['footers', 'Footers', 'textarea', undefined],
      ],
    );

    assert.equal(conventionalCommitTool.fields?.[2]?.required, true);
    assert.equal(fieldsOf(conventionalCommitTool)?.[6]?.placeholder, 'Refs: #123');

    assert.deepEqual(conventionalCommitTool.fields?.[4]?.visibleWhen, {
      field: 'breaking',
      is: ['true'],
    });

    assert.deepEqual(conventionalCommitTool.relatedToolIds, [
      'gitignore-generator',
      'semver-compare',
      'text-diff',
    ]);

    assert.equal(contentOf(conventionalCommitTool).faq?.length, 5);
    assert.ok((conventionalCommitTool.samples?.length ?? 0) >= 6);
  });

  it('builds the message and exports it', async () => {
    const result = await conventionalCommitTool.run({ fields, text: '' });

    assert.equal(result.summary, 'Header is 24 characters.');
    assert.equal(result.text, 'feat(parser): add arrays\n');
    assert.equal(result.language, 'plaintext');
    assert.equal(result.artifact?.fileName, 'COMMIT_EDITMSG');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('puts the header warning in the summary', async () => {
    const result = await conventionalCommitTool.run({
      fields: { ...fields, description: 'x'.repeat(70) },
      text: '',
    });

    assert.equal(result.summary, 'Header is 84 characters; many projects limit it to 72.');
  });

  it('runs every sample', async () => {
    for (const sample of conventionalCommitTool.samples ?? []) {
      const result = await conventionalCommitTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.match(result.summary ?? '', /^Header is \d+ characters/);
    }
  });

  it('reports errors and rejects unknown types', async () => {
    await assert.rejects(
      async () => conventionalCommitTool.run({ fields: { ...fields, scope: 'a b' }, text: '' }),
      { message: 'Scope may contain letters, digits and . _ / , - only.' },
    );

    await assert.rejects(
      async () =>
        conventionalCommitTool.run({ fields: { ...fields, type: '__proto__' }, text: '' }),
      { message: 'Choose a commit type.' },
    );
  });
});
