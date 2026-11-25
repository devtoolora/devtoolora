import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsonPatchTool } from '../src/catalog/formatters/json-patch/tool';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

const decoded = (base64: string | undefined) =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('json patch tool', () => {
  it('declares its fields and run requirements', () => {
    assert.equal(jsonPatchTool.name, 'JSON Patch Generator & Applier');
    assert.equal(jsonPatchTool.category, 'Formatters');
    assert.equal(jsonPatchTool.inputKind, 'text');
    assert.equal(jsonPatchTool.outputKind, 'json');
    assert.equal(jsonPatchTool.autoRun, false);

    assert.deepEqual(
      jsonPatchTool.fields?.map(({ defaultValue, id, label, type, visibleWhen }) => ({
        defaultValue,
        id,
        label,
        type,
        visibleWhen,
      })),
      [
        {
          defaultValue: 'generate',
          id: 'mode',
          label: 'Mode',
          type: 'select',
          visibleWhen: undefined,
        },
        {
          defaultValue: undefined,
          id: 'target',
          label: 'Target JSON',
          type: 'textarea',
          visibleWhen: { field: 'mode', is: ['generate'] },
        },
        {
          defaultValue: undefined,
          id: 'patch',
          label: 'JSON Patch',
          type: 'textarea',
          visibleWhen: { field: 'mode', is: ['apply'] },
        },
      ],
    );

    assert.deepEqual(fieldsOf(jsonPatchTool)?.[0]?.options, [
      { label: 'Generate patch', value: 'generate' },
      { label: 'Apply patch', value: 'apply' },
    ]);

    assert.deepEqual(jsonPatchTool.runRequires, [
      { anyOf: ['$text'] },
      { anyOf: ['target'], when: { field: 'mode', is: ['generate'] } },
      { anyOf: ['patch'], when: { field: 'mode', is: ['apply'] } },
    ]);

    assert.deepEqual(jsonPatchTool.relatedToolIds, ['json-diff', 'json-format', 'json-query']);
    assert.equal(contentOf(jsonPatchTool).faq?.length, 5);
  });

  it('generates a patch', async () => {
    const result = await jsonPatchTool.run({
      fields: { target: '{"a":2,"b":[1],"c":"x"}' },
      text: '{"a":1,"b":[1,2,3]}',
    });
    const patch =
      '[\n  {"op":"replace","path":"/a","value":2},\n  {"op":"remove","path":"/b/2"},\n  {"op":"remove","path":"/b/1"},\n  {"op":"add","path":"/c","value":"x"}\n]';

    assert.equal(result.text, patch);
    assert.equal(result.summary, '4 operations (1 add, 2 remove, 1 replace).');
    assert.equal(result.language, 'json');
    assert.equal(result.artifact?.fileName, 'patch.json');
    assert.equal(decoded(result.artifact?.base64), patch);

    const equal = await jsonPatchTool.run({
      fields: { mode: 'generate', target: '{"n":1e0}' },
      text: '{"n":1.0}',
    });

    assert.equal(equal.text, '[]');
    assert.equal(equal.summary, 'No differences; the patch is empty.');
  });

  it('applies a patch', async () => {
    const result = await jsonPatchTool.run({
      fields: { mode: 'apply', patch: '[{"op":"add","path":"/m","value":2.0}]' },
      text: '{"n":1.50}',
    });

    assert.equal(result.text, '{\n  "n": 1.50,\n  "m": 2.0\n}');
    assert.equal(result.summary, 'Applied 1 operation.');
    assert.equal(result.language, 'json');
    assert.equal(result.artifact?.fileName, 'patched.json');
    assert.equal(decoded(result.artifact?.base64), result.text);
  });

  it('reports errors and has enough samples', () => {
    assert.throws(() => jsonPatchTool.run({ fields: { mode: '__proto__' }, text: '{}' }), {
      message: 'Choose Generate patch or Apply patch.',
    });

    assert.throws(
      () =>
        jsonPatchTool.run({
          fields: { mode: 'apply', patch: '[{"op":"remove","path":"/x"}]' },
          text: '{}',
        }),
      { message: 'Operation 1 (remove /x): path does not exist.' },
    );

    assert.ok((jsonPatchTool.samples?.length ?? 0) >= 6);
  });
});
