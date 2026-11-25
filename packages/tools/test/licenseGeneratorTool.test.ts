import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { licenseGeneratorTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

describe('license generator tool', () => {
  const fields = { holder: 'Ada Lovelace', license: 'mit', year: '2026' };

  it('declares its fields and conditions', () => {
    assert.equal(licenseGeneratorTool.id, 'license-generator');
    assert.equal(licenseGeneratorTool.name, 'License Generator');
    assert.equal(licenseGeneratorTool.category, 'Dev Utilities');
    assert.equal(licenseGeneratorTool.inputKind, 'none');
    assert.equal(licenseGeneratorTool.outputKind, 'text');
    assert.equal(licenseGeneratorTool.autoRun, true);

    assert.deepEqual(
      licenseGeneratorTool.fields?.map(({ defaultValue, id, label, type }) => [
        id,
        label,
        type,
        defaultValue,
      ]),
      [
        ['license', 'License', 'select', 'mit'],
        ['holder', 'Copyright holder', 'text', undefined],
        ['year', 'Year', 'text', undefined],
      ],
    );

    const options = fieldsOf(licenseGeneratorTool)?.[0]?.options ?? [];

    assert.equal(options.length, 8);
    assert.deepEqual(options[0], { label: 'MIT License', value: 'mit' });
    assert.deepEqual(options[6], { label: 'GNU General Public License v3.0', value: 'gpl-3.0' });

    assert.deepEqual(licenseGeneratorTool.fields?.[1]?.visibleWhen, {
      field: 'license',
      is: ['mit', 'bsd-2-clause', 'bsd-3-clause', 'isc'],
    });

    assert.equal(licenseGeneratorTool.fields?.[2]?.help, 'Blank uses the current year.');

    assert.deepEqual(licenseGeneratorTool.relatedToolIds, [
      'gitignore-generator',
      'conventional-commit',
    ]);

    assert.equal(contentOf(licenseGeneratorTool).faq?.length, 5);
    assert.ok((licenseGeneratorTool.samples?.length ?? 0) >= 6);
  });

  it('builds the license and exports it', async () => {
    const result = await licenseGeneratorTool.run({ fields, text: '' });

    assert.equal(result.summary, 'MIT License · 2026 · Ada Lovelace.');
    assert.match(result.text ?? '', /^MIT License\n\nCopyright \(c\) 2026 Ada Lovelace\n/);
    assert.equal(result.language, 'plaintext');
    assert.equal(result.artifact?.fileName, 'LICENSE');
    assert.equal(result.artifact?.mimeType, 'text/plain;charset=utf-8');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('ignores the holder for licenses that do not use it', async () => {
    const result = await licenseGeneratorTool.run({
      fields: { holder: '', license: 'gpl-3.0', year: 'bad' },
      text: '',
    });

    assert.equal(result.summary, 'GNU General Public License v3.0.');
    assert.match(result.text ?? '', /Version 3, 29 June 2007/);
  });

  it('runs every sample', async () => {
    for (const sample of licenseGeneratorTool.samples ?? []) {
      const result = await licenseGeneratorTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.match(result.summary ?? '', /^[^\n]+\.$/);
    }
  });

  it('reports errors and rejects unknown licenses', async () => {
    await assert.rejects(
      async () => licenseGeneratorTool.run({ fields: { ...fields, holder: '' }, text: '' }),
      { message: 'Enter the copyright holder.' },
    );

    await assert.rejects(
      async () =>
        licenseGeneratorTool.run({ fields: { ...fields, license: '__proto__' }, text: '' }),
      { message: 'Choose a license.' },
    );
  });
});
