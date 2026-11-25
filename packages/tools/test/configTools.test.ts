import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { configSecretTools } from '../src/catalog/configSecrets';
import { formatDotenv, inspectDotenv, parseDotenv, redactDotenv } from '../../functions/src/config';
import { contentOf } from './toolContent';

describe('config tools', () => {
  it('warns when the formatter reads a hash that touches a value as a comment', async () => {
    const formatter = configSecretTools.find((tool) => tool.id === 'dotenv-formatter');
    const attached = await formatter?.run({ fields: {}, text: 'DB_PASSWORD=abc#def\n' });
    const spaced = await formatter?.run({ fields: {}, text: 'DB_PASSWORD=abc # def\n' });

    assert.equal(attached?.text, 'DB_PASSWORD=abc # def\n');
    assert.match(attached?.summary ?? '', /1 # without a space/);
    assert.doesNotMatch(spaced?.summary ?? '', /without a space/);
  });

  it('parses comment boundaries, line endings and empty comments without losing quoted values', () => {
    assert.equal(
      formatDotenv(parseDotenv('\uFEFFA=1#note\rB="x#y"\rC=#\r')),
      'A=1 # note\nB="x#y"\nC= #\n',
    );

    assert.equal(
      redactDotenv(parseDotenv('# demo\nTOKEN=demo # private note\nPORT=3000 # note\n'), '', true),
      'TOKEN=<redacted>\nPORT=3000\n',
    );

    assert.throws(() => redactDotenv(parseDotenv('A=1'), 'BAD-NAME'), /exact variable names/);
    assert.equal(inspectDotenv('A=1\nA=2').diagnostics.length, 1);
    assert.throws(() => inspectDotenv('x'.repeat(1048577)), /exceeds/);
  });

  it('removes comments by default when run without the Remove comments field', async () => {
    const redactor = configSecretTools.find((tool) => tool.id === 'secret-redactor');
    const source = '# demo credential\nTOKEN=demo # demo token\nPORT=3000\n';
    const fieldDefault = redactor?.fields?.find(
      (field) => field.id === 'removeComments',
    )?.defaultValue;

    assert.equal(fieldDefault, 'true');
    const withDefault = await redactor?.run({
      fields: { removeComments: fieldDefault ?? '' },
      text: source,
    });
    const withoutField = await redactor?.run({ fields: {}, text: source });

    assert.equal(withoutField?.text, 'TOKEN=<redacted>\nPORT=3000\n');
    assert.equal(withoutField?.text, withDefault?.text);

    assert.equal(
      (await redactor?.run({ fields: { removeComments: 'false' }, text: source }))?.text,
      '# demo credential\nTOKEN=<redacted> # demo token\nPORT=3000\n',
    );
  });

  it('counts distinct variable names and assignment lines in a valid report', async () => {
    const validator = configSecretTools.find((tool) => tool.id === 'dotenv-validator');

    assert.equal(
      (await validator?.run({ fields: {}, text: '# note\nexport A=1\nB=\n\nC="x"\n' }))?.text,
      'Valid .env\nVariables: 3\nAssignments: 3',
    );

    const duplicate = await validator?.run({ fields: {}, text: 'A=1\nexport A=2\n' });

    assert.equal(
      duplicate?.text,
      'Invalid .env\n\n- Line 2: Duplicate variable "A" (first declared on line 1).',
    );
  });

  it('provides guides, six runnable samples and exact exported bytes', async () => {
    for (const tool of configSecretTools) {
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.ok((tool.samples?.length ?? 0) >= 6);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6);

      for (const sample of tool.samples ?? []) {
        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );

        if (tool.id === 'dotenv-validator') assert.ok(!result.text.includes('https://example.com'));
      }
    }
  });
});
