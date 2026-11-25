import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateIds, inspectIds } from '../src/dev';

describe('id inspector', () => {
  const [v7, v1, v6, nil, braces] = inspectIds(
    '017F22E2-79B0-7CC3-98C4-DC0C0C07398F\nC232AB00-9414-11EC-B3C8-9F6BDECED846\n1EC9414C-232A-6B00-B3C8-9F6BDECED846\n00000000-0000-0000-0000-000000000000\n{017f22e279b07cc398c4dc0c0c07398f}',
    { epoch: 'discord' },
  );

  it('decodes UUID versions', () => {
    assert.deepEqual(v7, {
      input: '017F22E2-79B0-7CC3-98C4-DC0C0C07398F',
      kind: 'uuid',
      line: 1,
      timestamp: '2022-02-22T19:22:22.000Z',
      uuid: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f',
      variant: 'RFC 9562',
      version: 7,
    });

    assert.equal(v1?.kind === 'uuid' && v1.timestamp, '2022-02-22T19:22:22.000Z');
    assert.equal(v1?.kind === 'uuid' && v1.clockSequence, 13256);
    assert.equal(v1?.kind === 'uuid' && v1.node, '9f:6b:de:ce:d8:46');
    assert.equal(v6?.kind === 'uuid' && v6.timestamp, '2022-02-22T19:22:22.000Z');
    assert.equal(nil?.kind === 'uuid' && nil.special, 'nil');
    assert.equal(braces?.kind === 'uuid' && braces.uuid, '017f22e2-79b0-7cc3-98c4-dc0c0c07398f');

    const [max] = inspectIds('urn:uuid:FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF', { epoch: 'discord' });

    assert.equal(max?.kind === 'uuid' && max.special, 'max');
  });

  it('decodes ULID, KSUID and Snowflake', () => {
    const [ulid, ksuid, discord] = inspectIds(
      '01arz3ndektsv4rrffq69g5fav\n0ujtsYcgvSTl8PAuAdqWYSMnLOv\n\n175928847299117063',
      { epoch: 'discord' },
    );

    assert.deepEqual(ulid, {
      input: '01arz3ndektsv4rrffq69g5fav',
      kind: 'ulid',
      line: 1,
      randomness: 'd6764c61efb99302bd5b',
      timestamp: '2016-07-30T23:54:10.259Z',
    });

    assert.deepEqual(ksuid, {
      input: '0ujtsYcgvSTl8PAuAdqWYSMnLOv',
      kind: 'ksuid',
      line: 2,
      payload: 'b5a1cd34b5f99d1154fb6853345c9735',
      timestamp: '2017-10-10T04:00:47.000Z',
    });

    assert.deepEqual(discord, {
      input: '175928847299117063',
      kind: 'snowflake',
      line: 4,
      process: 0,
      sequence: 7,
      timestamp: '2016-04-30T11:18:25.796Z',
      worker: 1,
    });

    assert.deepEqual(inspectIds('1212161226626838528', { epoch: 'twitter' })[0], {
      input: '1212161226626838528',
      kind: 'snowflake',
      line: 1,
      process: 3,
      sequence: 0,
      timestamp: '2019-12-31T23:58:51.951Z',
      worker: 12,
    });
  });

  it('applies a custom epoch and leaves other UUID versions undated', () => {
    const [custom, v4] = inspectIds('4194304\n550e8400-e29b-41d4-a716-446655440000', {
      epoch: 1_000,
    });

    assert.equal(custom?.kind === 'snowflake' && custom.timestamp, '1970-01-01T00:00:01.001Z');
    assert.equal(v4?.kind === 'uuid' && v4.version, 4);
    assert.equal(v4?.kind === 'uuid' && 'timestamp' in v4, false);

    const variants = inspectIds(
      '550e8400-e29b-41d4-0716-446655440000\n550e8400-e29b-41d4-c716-446655440000\n550e8400-e29b-41d4-f716-446655440000',
      { epoch: 'discord' },
    );

    assert.deepEqual(
      variants.map((id) => id.kind === 'uuid' && id.variant),
      ['NCS', 'Microsoft', 'Future'],
    );
  });

  it('reports unrecognized lines without throwing', () => {
    const [nano, big, overflow] = inspectIds(
      'V1StGXR8_Z5jdHi6B-myT\n18446744073709551616\n81ARZ3NDEKTSV4RRFFQ69G5FAV',
      { epoch: 'discord' },
    );

    assert.equal(nano?.kind, 'unknown');

    assert.equal(
      big?.kind === 'unknown' && big.reason,
      'Snowflake IDs are at most 18446744073709551615.',
    );

    assert.equal(
      overflow?.kind === 'unknown' && overflow.reason,
      'ULID timestamp overflows 48 bits.',
    );

    assert.equal(inspectIds('x'.repeat(101), { epoch: 'discord' })[0]?.kind, 'unknown');

    assert.throws(() => inspectIds('a\n'.repeat(1_001), { epoch: 'discord' }), {
      message: 'ID Inspector reads up to 1,000 lines.',
    });
  });

  it('generates Nano ID, UUID v7 and KSUID', () => {
    const zeros = (length: number) => new Uint8Array(length);
    const scripted = (bytes: number[]) => (length: number) =>
      Uint8Array.from({ length }, () => bytes.shift() ?? 0);
    const options = {
      alphabet: 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict',
      count: 5,
      kind: 'nanoid',
      size: 21,
    } as const;

    assert.match(generateIds(options).join('\n'), /^(?:[A-Za-z0-9_-]{21}\n){4}[A-Za-z0-9_-]{21}$/);

    for (const size of [2, 5, 21])
      for (const id of generateIds({ ...options, alphabet: '😀😁😂🤣', count: 20, size }))
        assert.equal(Array.from(id).length, size);

    assert.deepEqual(
      generateIds({ ...options, alphabet: 'abc', count: 1, size: 3 }, scripted([3, 7, 0, 1, 2])),
      ['abc'],
    );

    assert.deepEqual(
      generateIds({ ...options, count: 1, kind: 'uuid-v7' }, zeros, () => 0x017f22e279b0),
      ['017f22e2-79b0-7000-8000-000000000000'],
    );

    assert.deepEqual(
      generateIds(
        { ...options, count: 1, kind: 'ksuid' },
        () => Uint8Array.from(Buffer.from('b5a1cd34b5f99d1154fb6853345c9735', 'hex')),
        () => 1_507_608_047_000,
      ),
      ['0ujtsYcgvSTl8PAuAdqWYSMnLOv'],
    );

    assert.throws(() => generateIds({ ...options, alphabet: 'aab' }), {
      message: 'Alphabet characters must be unique.',
    });

    assert.throws(() => generateIds({ ...options, alphabet: 'a' }), {
      message: 'Alphabet needs 2-256 characters.',
    });

    assert.throws(() => generateIds({ ...options, size: 1 }), {
      message: 'Nano ID size must be 2-256.',
    });

    assert.throws(() => generateIds({ ...options, count: 101 }), {
      message: 'Count must be 1-100.',
    });
  });
});
