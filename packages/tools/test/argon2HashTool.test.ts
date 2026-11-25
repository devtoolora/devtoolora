import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { argon2HashTool } from '../src/catalog/crypto';

const vector =
  '$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc';
const run = async (fields: Record<string, string>): Promise<ToolResult> =>
  argon2HashTool.run({ fields, text: '' });
const rejects = (fields: Record<string, string>, message: string) =>
  assert.rejects(
    () => run(fields),
    (error) => error instanceof ToolError && error.message === message,
  );

describe('argon2 hash tool', () => {
  it('declares itself with manual fresh results', () => {
    assert.equal(argon2HashTool.id, 'argon2-hash');
    assert.equal(argon2HashTool.category, 'Crypto');
    assert.equal(argon2HashTool.autoRun, false);
    assert.equal(argon2HashTool.freshResults, true);
    assert.equal(argon2HashTool.sensitiveInput, true);

    assert.deepEqual(
      argon2HashTool.fields?.find((field) => field.id === 'hash'),
      {
        defaultValue: '',
        id: 'hash',
        label: 'Hash',
        rows: 3,
        type: 'textarea',
        visibleWhen: { field: 'mode', is: ['verify'] },
      },
    );

    assert.deepEqual(argon2HashTool.relatedToolIds, ['bcrypt-hash', 'pbkdf2', 'password-strength']);
  });

  it('hashes with the OWASP defaults and a summary', async () => {
    const result = await run({ mode: 'hash', password: 'secret' });

    assert.match(
      result.text,
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );

    assert.match(result.summary ?? '', /^argon2id · 19 MiB · 2 passes · took \d+ ms\.$/);
    assert.equal(result.verdict, undefined);
  });

  it('is deterministic with a fixed hex or Base64 salt', async () => {
    const hex = await run({
      iterations: '1',
      memory: '1024',
      password: 'a',
      salt: '736f6d6573616c74',
    });
    const b64 = await run({ iterations: '1', memory: '1024', password: 'a', salt: 'c29tZXNhbHQ' });

    assert.equal(hex.text, b64.text);
    assert.match(hex.summary ?? '', /^argon2id · 1 MiB · 1 pass · took/);
  });

  it('verifies a hash and sets the verdict', async () => {
    const hit = await run({ hash: ` ${vector}\n`, mode: 'verify', password: 'password' });
    const miss = await run({ hash: vector, mode: 'verify', password: 'Password' });

    assert.equal(hit.text, 'Match');
    assert.equal(hit.verdict, 'match');
    assert.equal(hit.summary, 'argon2id · 64 MiB · 2 passes · password matches');
    assert.equal(miss.text, 'No match');
    assert.equal(miss.verdict, 'mismatch');
    assert.equal(miss.summary, 'argon2id · 64 MiB · 2 passes · password does not match');
  });

  it('reports the documented errors', async () => {
    await rejects({ mode: 'hash', password: '' }, 'Password is empty.');

    await rejects(
      { memory: '512', mode: 'hash', password: 'a' },
      'Memory must be between 1,024 and 65,536 KiB.',
    );

    await rejects(
      { mode: 'hash', password: 'a', salt: 'abcd' },
      'Salt must be 8-64 bytes; this one is 2.',
    );

    await rejects(
      { mode: 'hash', password: 'a', variant: 'argon2x' },
      'Choose Argon2id, Argon2i or Argon2d.',
    );

    await rejects({ mode: 'sign', password: 'a' }, 'Choose hash or verify mode.');

    await rejects(
      { hash: vector.replace('v=19$', ''), mode: 'verify', password: 'a' },
      'Argon2 version 16 (1.0) is not supported.',
    );
  });
});
