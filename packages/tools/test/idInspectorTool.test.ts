import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { idInspectorTool, uuidDecoderTool } from '../src/catalog/devUtilities/id-inspector/tool';
import { contentOf } from './toolContent';

const decoded = (base64: string | undefined) =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('id inspector tool', () => {
  it('declares its fields and conditions', () => {
    assert.equal(idInspectorTool.id, 'id-inspector');
    assert.equal(idInspectorTool.name, 'ID Inspector & Generator');
    assert.equal(idInspectorTool.category, 'Dev Utilities');
    assert.equal(idInspectorTool.inputKind, 'optionalText');
    assert.equal(idInspectorTool.freshResults, true);
    assert.deepEqual(idInspectorTool.inputVisibleWhen, { field: 'mode', is: ['inspect'] });

    assert.deepEqual(idInspectorTool.runRequires, [
      { anyOf: ['$text'], when: { field: 'mode', is: ['inspect'] } },
    ]);

    assert.deepEqual(idInspectorTool.relatedToolIds, ['uuid', 'ulid', 'timestamp-convert']);

    assert.deepEqual(
      idInspectorTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['mode', 'Mode', 'inspect'],
        ['epoch', 'Snowflake epoch', 'discord'],
        ['customEpoch', 'Custom epoch (ms)', undefined],
        ['kind', 'Kind', 'nanoid'],
        ['count', 'Count', '5'],
        ['size', 'Size', '21'],
        [
          'alphabet',
          'Alphabet',
          'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict',
        ],
      ],
    );

    assert.equal(contentOf(idInspectorTool).faq?.length, 5);
    assert.ok((idInspectorTool.samples?.length ?? 0) >= 6);
  });

  it('inspects IDs and summarizes the lines', async () => {
    const result = await idInspectorTool.run({
      fields: {},
      text: '175928847299117063\nV1StGXR8_Z5jdHi6B-myT\n01ARZ3NDEKTSV4RRFFQ69G5FAV',
    });
    const parsed = JSON.parse(result.text);

    assert.equal(result.summary, '3 lines · 2 recognized · 1 unrecognized.');
    assert.equal(result.language, 'json');
    assert.equal(result.artifact?.fileName, 'ids.json');
    assert.equal(decoded(result.artifact?.base64), result.text);
    assert.equal(parsed[0].timestamp, '2016-04-30T11:18:25.796Z');
    assert.equal(parsed[1].kind, 'unknown');
    assert.equal(parsed[2].kind, 'ulid');

    const single = await idInspectorTool.run({ fields: {}, text: '1' });

    assert.equal(single.summary, '1 line · 1 recognized · 0 unrecognized.');
  });

  it('chooses the Snowflake epoch', async () => {
    const twitter = await idInspectorTool.run({
      fields: { epoch: 'twitter' },
      text: '1212161226626838528',
    });
    const custom = await idInspectorTool.run({
      fields: { customEpoch: '1000', epoch: 'custom' },
      text: '4194304',
    });

    assert.equal(JSON.parse(twitter.text)[0].timestamp, '2019-12-31T23:58:51.951Z');
    assert.equal(JSON.parse(custom.text)[0].timestamp, '1970-01-01T00:00:01.001Z');

    for (const customEpoch of ['', '-1', '1.5', '9007199254740992', 'abc'])
      assert.throws(
        () => idInspectorTool.run({ fields: { customEpoch, epoch: 'custom' }, text: '1' }),
        { message: 'Custom epoch must be a whole number of milliseconds, 0 or more.' },
      );
  });

  it('generates IDs one per line', async () => {
    const nano = await idInspectorTool.run({ fields: { mode: 'generate' }, text: '' });

    assert.match(nano.text, /^(?:[A-Za-z0-9_-]{21}\n){4}[A-Za-z0-9_-]{21}$/);
    assert.equal(nano.summary, '5 Nano IDs of 21 characters.');
    assert.equal(nano.language, 'plaintext');
    assert.equal(nano.artifact?.fileName, 'ids.txt');
    assert.equal(decoded(nano.artifact?.base64), nano.text);

    const emoji = await idInspectorTool.run({
      fields: { alphabet: '😀😁😂🤣', count: '3', mode: 'generate', size: '5' },
      text: '',
    });

    assert.deepEqual(
      emoji.text.split('\n').map((id) => Array.from(id).length),
      [5, 5, 5],
    );

    assert.equal(emoji.summary, '3 Nano IDs of 5 characters.');

    const uuid = await idInspectorTool.run({
      fields: { count: '1', kind: 'uuid-v7', mode: 'generate' },
      text: '',
    });
    const ksuid = await idInspectorTool.run({
      fields: { count: '2', kind: 'ksuid', mode: 'generate' },
      text: '',
    });

    assert.match(
      uuid.text,
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    assert.equal(uuid.summary, '1 UUID v7.');
    assert.match(ksuid.text, /^[0-9A-Za-z]{27}\n[0-9A-Za-z]{27}$/);
    assert.equal(ksuid.summary, '2 KSUIDs.');
  });

  it('rejects unknown choices and limits', () => {
    for (const fields of [
      { mode: '__proto__' },
      { epoch: '__proto__', mode: 'inspect' },
      { kind: '__proto__', mode: 'generate' },
    ] as Array<Record<string, string>>)
      assert.throws(() => idInspectorTool.run({ fields, text: 'a' }), { name: 'ToolError' });

    assert.throws(
      () => idInspectorTool.run({ fields: { mode: 'generate', size: 'x' }, text: '' }),
      {
        message: 'Nano ID size must be 2-256.',
      },
    );

    assert.throws(() => idInspectorTool.run({ fields: {}, text: 'a\n'.repeat(1_001) }), {
      message: 'ID Inspector reads up to 1,000 lines.',
      name: 'ToolError',
    });
  });

  it('exposes the UUID Decoder alias', () => {
    assert.equal(uuidDecoderTool.id, 'uuid-decoder');
    assert.equal(uuidDecoderTool.name, 'UUID Decoder');
    assert.equal(uuidDecoderTool.aliasOf, 'id-inspector');
    assert.equal(contentOf(uuidDecoderTool).faq?.length, 5);
  });
});
