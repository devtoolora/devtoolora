import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { describe, it } from 'vitest';
import { browserCryptoTools } from '../src/catalog/crypto';
import { contentOf } from './toolContent';

const ids = ['hash', 'hmac', 'uuid', 'ulid', 'random-token', 'password-generator'];

describe('crypto generator tools', () => {
  it('provides complete guides, examples and exact text exports for every sample', async () => {
    for (const id of ids) {
      const tool = browserCryptoTools.find((candidate) => candidate.id === id)!;

      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.match(contentOf(tool).documentation?.[0]?.title ?? '', /^What is /);
      assert.match(contentOf(tool).documentation?.[1]?.title ?? '', /^When to use /);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 5);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 4);
      assert.ok((contentOf(tool).help?.split('\n\n').length ?? 0) >= 4);
      assert.ok((tool.samples?.length ?? 0) >= 6);
      assert.deepEqual(tool.resultActions, ['copy', 'scratch', 'save']);

      for (const sample of tool.samples ?? []) {
        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.equal(result.artifact?.fileName, `${id}.txt`);

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );

        assert.equal(result.artifacts, undefined);
        if (id === 'hmac') assert.ok(!result.summary?.includes(sample.fields?.secret ?? 'missing'));
      }
    }
  });

  it('uses binary file precedence and preserves whitespace in literal HMAC keys', async () => {
    const hash = browserCryptoTools.find((tool) => tool.id === 'hash')!;
    const binary = Buffer.from([0, 255, 13, 10]);

    assert.equal(
      (
        await hash.run({
          fields: { file: `data:application/octet-stream;base64,${binary.toString('base64')}` },
          text: 'ignored text',
        })
      ).text,
      createHash('sha256').update(binary).digest('hex'),
    );

    await assert.rejects(async () => hash.run({ fields: { file: 'broken' }, text: 'valid text' }));
    const hmac = browserCryptoTools.find((tool) => tool.id === 'hmac')!;

    assert.equal(
      (await hmac.run({ fields: { secret: ' secret ' }, text: '' })).text,
      createHmac('sha256', ' secret ').update('').digest('hex'),
    );

    await assert.rejects(async () => hmac.run({ fields: { secret: '' }, text: 'message' }));
  });

  it('uses standard algorithm names and correct singular and plural counts in summaries', async () => {
    const summary = async (id: string, fields: Record<string, string>, text = '') =>
      (await browserCryptoTools.find((tool) => tool.id === id)!.run({ fields, text })).summary ??
      '';

    assert.match(
      await summary('hash', { algorithm: 'sha256' }, 'hello'),
      /^SHA-256 · 5 input bytes · /,
    );

    assert.match(await summary('hash', { algorithm: 'sha1' }, 'a'), /^SHA-1 · 1 input byte · /);
    assert.match(await summary('hash', { algorithm: 'sha512' }, ''), /^SHA-512 · 0 input bytes · /);
    assert.match(await summary('hash', { algorithm: 'md5' }, 'hello'), /^MD5 · /);

    assert.match(
      await summary('hmac', { algorithm: 'sha256', secret: 'k' }, 'a'),
      /^HMAC SHA-256 · 1 message byte · /,
    );

    assert.match(await summary('uuid', { count: '1' }), /^1 UUID v4 identifier · /);
    assert.match(await summary('uuid', { count: '2' }), /^2 UUID v4 identifiers · /);
    assert.match(await summary('ulid', { count: '1' }), /^1 ULID · /);
    assert.match(await summary('ulid', { count: '3' }), /^3 ULIDs · /);
    assert.match(await summary('random-token', { count: '1' }), /^1 fresh token · /);
    assert.match(await summary('random-token', { count: '2' }), /^2 fresh tokens · /);
    assert.match(await summary('password-generator', { count: '1' }), /^1 fresh password · /);
    assert.match(await summary('password-generator', { count: '2' }), /^2 fresh passwords · /);
  });

  it('validates active settings and never silently defaults explicit empty values', async () => {
    for (const id of ['uuid', 'ulid', 'random-token', 'password-generator']) {
      const tool = browserCryptoTools.find((candidate) => candidate.id === id)!;

      assert.equal(tool.autoRun, false);
      for (const count of ['', '0', '101', '1.5', '1e1'])
        await assert.rejects(async () => tool.run({ fields: { count }, text: '' }));
    }

    const token = browserCryptoTools.find((tool) => tool.id === 'random-token')!;

    for (const fields of [
      { mode: 'bad' },
      { mode: 'bytes', encoding: 'bad' },
      { lowercase: 'yes' },
      { length: '' },
      { lowercase: 'false', uppercase: 'false', numbers: 'false', symbols: 'false' },
    ] as Array<Record<string, string>>)
      await assert.rejects(async () => token.run({ fields, text: '' }));

    assert.match(
      (
        await token.run({
          fields: { bytes: '16', encoding: 'hex', length: '', lowercase: 'bad', mode: 'bytes' },
          text: '',
        })
      ).text,
      /^[a-f0-9]{32}$/,
    );
  });
});
