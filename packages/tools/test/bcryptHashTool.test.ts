import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { bcryptHashTool } from '../src/catalog/crypto';

const vector = '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW';
const run = async (fields: Record<string, string>): Promise<ToolResult> =>
  bcryptHashTool.run({ fields, text: '' });
const rejects = (fields: Record<string, string>, message: string) =>
  assert.rejects(
    () => run(fields),
    (error) => error instanceof ToolError && error.message === message,
  );

describe('bcrypt hash tool', () => {
  it('declares itself with manual fresh results', () => {
    assert.equal(bcryptHashTool.id, 'bcrypt-hash');
    assert.equal(bcryptHashTool.category, 'Crypto');
    assert.equal(bcryptHashTool.autoRun, false);
    assert.equal(bcryptHashTool.freshResults, true);
    assert.equal(bcryptHashTool.sensitiveInput, true);

    assert.deepEqual(
      bcryptHashTool.fields?.find((field) => field.id === 'hash'),
      {
        defaultValue: '',
        id: 'hash',
        label: 'Hash',
        rows: 3,
        type: 'textarea',
        visibleWhen: { field: 'mode', is: ['verify'] },
      },
    );

    assert.equal(bcryptHashTool.isolatedWorker, undefined);
  });

  it('hashes with a cost summary', async () => {
    const result = await run({ cost: '4', mode: 'hash', password: 'secret' });

    assert.match(result.text, /^\$2b\$04\$[./A-Za-z0-9]{53}$/);
    assert.match(result.summary ?? '', /^Cost 4 · 2\^4 rounds · took \d+ ms$/);
  });

  it('verifies a hash and names the prefix', async () => {
    const hit = await run({ hash: vector, mode: 'verify', password: 'U*U' });
    const miss = await run({ hash: vector, mode: 'verify', password: 'nope' });

    assert.equal(hit.text, 'Match');
    assert.equal(miss.text, 'No match');
    assert.match(hit.summary ?? '', /\$2a\$/);
  });

  it('flags a verdict only in verify mode', async () => {
    const hit = await run({ hash: vector, mode: 'verify', password: 'U*U' });
    const miss = await run({ hash: vector, mode: 'verify', password: 'nope' });
    const hashed = await run({ cost: '4', mode: 'hash', password: 'secret' });

    assert.equal(hit.verdict, 'match');
    assert.equal(miss.verdict, 'mismatch');
    assert.equal(hashed.verdict, undefined);
  });

  it('keeps surrounding spaces', async () => {
    const { text } = await run({ cost: '4', mode: 'hash', password: 'a' });
    const result = await run({ hash: text, mode: 'verify', password: ' a' });

    assert.equal(result.text, 'No match');
  });

  it('reports the documented errors', async () => {
    await rejects({ mode: 'hash', password: '' }, 'Password is empty.');
    await rejects({ cost: '15', mode: 'hash', password: 'a' }, 'Cost must be between 4 and 14.');

    await rejects(
      { mode: 'hash', password: 'é'.repeat(37) },
      'Bcrypt uses only the first 72 bytes; this password is 74 bytes. Shorten it or pre-hash it.',
    );

    await rejects(
      { hash: vector.replace('$2a$', '$2x$'), mode: 'verify', password: 'a' },
      'Unsupported bcrypt prefix "$2x$"; use $2a$, $2b$ or $2y$.',
    );

    await rejects({ mode: 'sign', password: 'a' }, 'Choose hash or verify mode.');
  });
});
