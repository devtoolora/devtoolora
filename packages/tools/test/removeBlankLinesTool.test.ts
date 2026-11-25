import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  removeBlankLinesTool,
  removeLineNumbersTool,
} from '../src/catalog/text/remove-blank-lines/tool';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

const decoded = (base64: string | undefined) =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('remove blank lines tool', () => {
  it('declares its fields', () => {
    assert.equal(removeBlankLinesTool.id, 'remove-blank-lines');
    assert.equal(removeBlankLinesTool.name, 'Remove Blank Lines & Line Numbers');
    assert.equal(removeBlankLinesTool.category, 'Text');
    assert.equal(removeBlankLinesTool.inputKind, 'text');
    assert.equal(removeBlankLinesTool.outputKind, 'text');
    assert.equal(removeBlankLinesTool.supportsSelection, true);

    assert.deepEqual(removeBlankLinesTool.resultActions, [
      'replace',
      'insert',
      'copy',
      'scratch',
      'save',
    ]);

    assert.deepEqual(
      fieldsOf(removeBlankLinesTool)?.map(
        ({ defaultValue, id, label, options, presentation, type }) => ({
          defaultValue,
          id,
          label,
          options,
          presentation,
          type,
        }),
      ),
      [
        {
          defaultValue: 'remove',
          id: 'blankLines',
          label: 'Blank lines',
          options: [
            { label: 'Remove', value: 'remove' },
            { label: 'Collapse to one', value: 'collapse' },
            { label: 'Keep', value: 'keep' },
          ],
          presentation: 'segmented',
          type: 'select',
        },
        {
          defaultValue: 'true',
          id: 'whitespaceIsBlank',
          label: 'Whitespace-only lines are blank',
          options: undefined,
          presentation: undefined,
          type: 'checkbox',
        },
        {
          defaultValue: 'remove',
          id: 'lineNumbers',
          label: 'Line numbers',
          options: [
            { label: 'Remove', value: 'remove' },
            { label: 'Keep', value: 'keep' },
          ],
          presentation: 'segmented',
          type: 'select',
        },
      ],
    );

    assert.deepEqual(removeBlankLinesTool.relatedToolIds, [
      'whitespace-cleaner',
      'number-lines',
      'deduplicate-lines',
    ]);

    assert.equal(contentOf(removeBlankLinesTool).faq?.length, 4);
    assert.ok((removeBlankLinesTool.samples?.length ?? 0) >= 6);
  });

  it('cleans text and summarizes the removals', async () => {
    const result = await removeBlankLinesTool.run({
      fields: {},
      text: '1. a\r\n\r\n2. b\r\n   \r\n3. c',
    });

    assert.equal(result.text, 'a\r\nb\r\nc');
    assert.equal(result.summary, 'Removed 2 blank lines and 3 line numbers.');
    assert.equal(result.language, 'plaintext');
    assert.equal(result.artifact?.fileName, 'cleaned.txt');
    assert.equal(decoded(result.artifact?.base64), result.text);

    const single = await removeBlankLinesTool.run({ fields: {}, text: 'a\n\n1) b' });

    assert.equal(single.summary, 'Removed 1 blank line and 1 line number.');

    const blankOnly = await removeBlankLinesTool.run({ fields: {}, text: 'a\n\nb' });

    assert.equal(blankOnly.summary, 'Removed 1 blank line.');

    const nothing = await removeBlankLinesTool.run({ fields: {}, text: 'a\nb\n' });

    assert.equal(nothing.text, 'a\nb\n');
    assert.equal(nothing.summary, 'No blank lines or line numbers to remove.');
  });

  it('honors the options', async () => {
    const collapsed = await removeBlankLinesTool.run({
      fields: { blankLines: 'collapse', lineNumbers: 'keep' },
      text: '1. a\n\n\n2. b',
    });

    assert.equal(collapsed.text, '1. a\n\n2. b');

    const kept = await removeBlankLinesTool.run({
      fields: { blankLines: 'keep', whitespaceIsBlank: 'false' },
      text: '1. a\n \n2. b',
    });

    assert.equal(kept.text, 'a\n \nb');
  });

  it('keeps decimals and times at the default settings', async () => {
    const text = '3.14 is pi\n10:30 standup\n1.2.3 x\n1|2|3';
    const result = await removeBlankLinesTool.run({ fields: {}, text });

    assert.equal(result.text, text);
    assert.equal(result.summary, 'No blank lines or line numbers to remove.');
  });

  it('keeps a number that starts a sentence in both tools', async () => {
    for (const tool of [removeBlankLinesTool, removeLineNumbersTool]) {
      const result = await tool.run({ fields: {}, text: '2024 was good' });

      assert.equal(result.text, '2024 was good');
      assert.equal(result.summary, 'No blank lines or line numbers to remove.');
    }
  });

  it('rejects unknown options and oversized input', () => {
    assert.throws(
      () => removeBlankLinesTool.run({ fields: { blankLines: '__proto__' }, text: 'a' }),
      { message: 'Choose Remove, Collapse to one or Keep for blank lines.', name: 'ToolError' },
    );

    assert.throws(
      () => removeBlankLinesTool.run({ fields: { lineNumbers: '__proto__' }, text: 'a' }),
      { message: 'Choose Remove or Keep for line numbers.', name: 'ToolError' },
    );

    assert.throws(() => removeBlankLinesTool.run({ fields: {}, text: 'a'.repeat(1_000_001) }), {
      message: 'Input is limited to 1,000,000 characters.',
    });
  });

  it('registers the Remove Line Numbers alias', () => {
    assert.equal(removeLineNumbersTool.id, 'remove-line-numbers');
    assert.equal(removeLineNumbersTool.name, 'Remove Line Numbers');
    assert.equal(removeLineNumbersTool.aliasOf, 'remove-blank-lines');
  });

  it('keeps blank lines by default in the Remove Line Numbers alias', async () => {
    assert.deepEqual(
      removeLineNumbersTool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['blankLines', 'keep'],
        ['whitespaceIsBlank', 'true'],
        ['lineNumbers', 'remove'],
      ],
    );

    const result = await removeLineNumbersTool.run({
      fields: {},
      text: '1 import os\n2 \n3 print(os.name)\n',
    });

    assert.equal(result.text, 'import os\n\nprint(os.name)\n');
    assert.equal(result.summary, 'Removed 3 line numbers.');

    const removed = await removeLineNumbersTool.run({
      fields: { blankLines: 'remove' },
      text: '1 import os\n2 \n3 print(os.name)\n',
    });

    assert.equal(removed.text, 'import os\nprint(os.name)\n');
  });
});
