import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { editorconfigGeneratorTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

describe('editorconfig generator tool', () => {
  // The form submits the field defaults; a blank indent size means not set.
  const defaults = { indentSize: '2' };

  it('declares its fields', () => {
    assert.equal(editorconfigGeneratorTool.id, 'editorconfig-generator');
    assert.equal(editorconfigGeneratorTool.name, '.editorconfig Generator');
    assert.equal(editorconfigGeneratorTool.category, 'Dev Utilities');
    assert.equal(editorconfigGeneratorTool.inputKind, 'none');
    assert.equal(editorconfigGeneratorTool.outputKind, 'text');
    assert.equal(editorconfigGeneratorTool.autoRun, true);

    assert.deepEqual(
      editorconfigGeneratorTool.fields?.map(({ defaultValue, id, type }) => [
        id,
        type,
        defaultValue,
      ]),
      [
        ['root', 'checkbox', 'true'],
        ['indentStyle', 'select', 'space'],
        ['indentSize', 'number', '2'],
        ['endOfLine', 'select', 'lf'],
        ['charset', 'select', 'utf-8'],
        ['trimTrailingWhitespace', 'select', 'true'],
        ['insertFinalNewline', 'select', 'true'],
        ['sections', 'checkboxGroup', undefined],
      ],
    );

    assert.deepEqual(
      fieldsOf(editorconfigGeneratorTool)?.[7]?.options?.map((option) => option.label),
      ['Markdown', 'Makefile', 'Go', 'Python', 'YAML', 'Windows scripts'],
    );

    assert.deepEqual(editorconfigGeneratorTool.relatedToolIds, [
      'gitignore-generator',
      'license-generator',
      'whitespace-cleaner',
    ]);

    assert.equal(contentOf(editorconfigGeneratorTool).faq?.length, 5);
    assert.ok((editorconfigGeneratorTool.samples?.length ?? 0) >= 6);
  });

  it('builds the defaults and exports them', async () => {
    const result = await editorconfigGeneratorTool.run({ fields: defaults, text: '' });

    assert.equal(result.summary, '1 section · 6 properties.');
    assert.match(result.text ?? '', /^root = true\n\n\[\*\]\nindent_style = space\n/);
    assert.equal(result.language, 'plaintext');
    assert.equal(result.artifact?.fileName, '.editorconfig');
    assert.equal(result.artifact?.mimeType, 'text/plain;charset=utf-8');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('adds every language section', async () => {
    const result = await editorconfigGeneratorTool.run({
      fields: { ...defaults, sections: 'markdown,makefile,go,python,yaml,windows' },
      text: '',
    });

    assert.equal(result.summary, '7 sections · 14 properties.');
  });

  it('leaves a blank indent size and unset values out', async () => {
    const result = await editorconfigGeneratorTool.run({
      fields: { charset: 'omit', endOfLine: 'omit', indentSize: '', root: 'false' },
      text: '',
    });

    assert.equal(
      result.text,
      '[*]\nindent_style = space\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n',
    );

    assert.equal(result.summary, '1 section · 3 properties.');
  });

  it('runs every sample', async () => {
    for (const sample of editorconfigGeneratorTool.samples ?? []) {
      const result = await editorconfigGeneratorTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.match(result.summary ?? '', /^[^\n]+\.$/);
    }
  });

  it('reports errors and rejects unknown values', async () => {
    const run = async (fields: Record<string, string>) =>
      editorconfigGeneratorTool.run({ fields, text: '' });

    await assert.rejects(async () => run({ indentSize: '17' }), {
      message: 'Indent size must be 1-16.',
    });

    await assert.rejects(async () => run({ indentSize: '1.5' }), {
      message: 'Indent size must be 1-16.',
    });

    await assert.rejects(async () => run({ endOfLine: '__proto__' }), {
      message: 'Choose a listed line ending.',
    });

    await assert.rejects(async () => run({ charset: '__proto__' }), {
      message: 'Choose a listed charset.',
    });

    await assert.rejects(async () => run({ indentStyle: '__proto__' }), {
      message: 'Choose a listed indent style.',
    });

    await assert.rejects(async () => run({ trimTrailingWhitespace: '__proto__' }), {
      message: 'Choose Yes, No or Not set.',
    });

    await assert.rejects(async () => run({ insertFinalNewline: '__proto__' }), {
      message: 'Choose Yes, No or Not set.',
    });

    await assert.rejects(async () => run({ sections: 'markdown,__proto__' }), {
      message: 'Choose listed language sections.',
    });

    await assert.rejects(
      async () =>
        run({
          charset: 'omit',
          endOfLine: 'omit',
          indentSize: '',
          indentStyle: 'omit',
          insertFinalNewline: 'omit',
          trimTrailingWhitespace: 'omit',
        }),
      { message: 'Choose at least one setting.' },
    );
  });
});
