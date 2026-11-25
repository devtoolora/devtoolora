import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { lookupExitCodes } from '@devtoolora/functions/logs';

const names = (query: string, table: 'all' | 'errno' | 'exit' | 'signals'): string[] =>
  lookupExitCodes(query, table).map((row) => `${row.table}:${row.code}:${row.name}`);

describe('lookupExitCodes', () => {
  it('lists full tables with the expected structure', () => {
    const errno = lookupExitCodes('', 'errno');

    assert.equal(errno.length, 131);
    assert.ok(errno.every((row) => /^E[A-Z0-9]+$/.test(row.name)));
    assert.equal(new Set(errno.map((row) => row.code)).size, 131);
    assert.equal(lookupExitCodes('', 'signals').length, 31);
    assert.ok(lookupExitCodes('', 'signals').every((row) => /^SIG[A-Z0-9]+$/.test(row.name)));
    assert.equal(lookupExitCodes('', 'exit').length, 8 + 15);
    assert.equal(lookupExitCodes('', 'all').length, 131 + 31 + 15 + 8);
    assert.equal(lookupExitCodes('', 'all')[0]?.table, 'exit');
    assert.equal(lookupExitCodes('', 'all').at(-1)?.table, 'errno');
  });

  it('matches a number in every table', () => {
    assert.deepEqual(names('2', 'all'), ['exit:2:', 'signal:2:SIGINT', 'errno:2:ENOENT']);
    assert.equal(lookupExitCodes('2', 'all')[0]?.description, 'Misuse of shell builtins');
    assert.deepEqual(names('130', 'all'), ['exit:130:', 'exit:130:', 'errno:130:EOWNERDEAD']);
    assert.equal(lookupExitCodes('130', 'all')[1]?.description, 'Killed by signal 2 (SIGINT)');
    assert.deepEqual(names('2', 'errno'), ['errno:2:ENOENT']);
  });

  it('synthesizes exit rows', () => {
    assert.equal(lookupExitCodes('137', 'exit')[0]?.description, 'Killed by signal 9 (SIGKILL)');

    assert.deepEqual(
      lookupExitCodes('42', 'exit').map((row) => row.description),
      ['Exit status 42 (program-defined)'],
    );
  });

  it('handles sysexits and range edges', () => {
    assert.deepEqual(names('64', 'all'), ['sysexits:64:EX_USAGE', 'errno:64:ENONET']);
    assert.deepEqual(names('64', 'exit'), ['sysexits:64:EX_USAGE']);

    assert.deepEqual(
      lookupExitCodes('0', 'exit').map((row) => row.description),
      ['Success'],
    );

    assert.equal(lookupExitCodes('129', 'exit')[0]?.description, 'Killed by signal 1 (SIGHUP)');

    assert.equal(lookupExitCodes('159', 'exit')[0]?.description, 'Killed by signal 31 (SIGSYS)');

    assert.throws(() => lookupExitCodes('256', 'all'), { message: /No exit code/ });
    assert.equal(lookupExitCodes(' SIGTERM ', 'all')[0]?.name, 'SIGTERM');
  });

  it('matches names case-insensitively with optional prefixes', () => {
    assert.equal(lookupExitCodes('ENOENT', 'all')[0]?.code, 2);
    assert.equal(lookupExitCodes('term', 'signals')[0]?.name, 'SIGTERM');
    assert.equal(lookupExitCodes('sigterm', 'all')[0]?.code, 15);
    assert.equal(lookupExitCodes('usage', 'all')[0]?.name, 'EX_USAGE');
    assert.equal(lookupExitCodes('EWOULDBLOCK', 'errno')[0]?.name, 'EAGAIN');
    assert.equal(lookupExitCodes('ENOTSUP', 'all')[0]?.name, 'EOPNOTSUPP');
  });

  it('rejects unknown and oversized queries', () => {
    assert.throws(() => lookupExitCodes('FOO', 'all'), {
      message: 'No exit code, errno or signal named "FOO".',
    });

    assert.throws(() => lookupExitCodes('300', 'all'), {
      message: 'No exit code, errno or signal named "300".',
    });

    assert.throws(() => lookupExitCodes('1'.repeat(65), 'all'), {
      message: 'Query exceeds 64 characters.',
    });
  });

  it('covers numeric range edges and table filters', () => {
    assert.deepEqual(names('0', 'all'), ['exit:0:']);
    assert.deepEqual(names('1', 'all'), ['exit:1:', 'signal:1:SIGHUP', 'errno:1:EPERM']);
    assert.deepEqual(names('64', 'all'), ['sysexits:64:EX_USAGE', 'errno:64:ENONET']);
    assert.deepEqual(names('129', 'all'), ['exit:129:', 'errno:129:EKEYREJECTED']);
    assert.deepEqual(names('158', 'all'), ['exit:158:']);

    assert.equal(
      lookupExitCodes('160', 'all')[0]?.description,
      'Exit status 160 (program-defined)',
    );

    assert.equal(lookupExitCodes('255', 'all')[0]?.description, 'Exit status out of range');
    assert.throws(() => lookupExitCodes('256', 'all'), /No exit code/);
    assert.deepEqual(names(' SIGTERM ', 'all'), ['signal:15:SIGTERM']);

    assert.match(
      lookupExitCodes('SIGTERM', 'signals')[0]?.description ?? '',
      /default action: Term/,
    );

    assert.throws(() => lookupExitCodes('EX_USAGE', 'errno'), /No exit code/);
    assert.throws(() => lookupExitCodes('ENOENT', 'signals'), /No exit code/);
  });

  it('treats prototype property names as unknown queries', () => {
    for (const query of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      assert.throws(() => lookupExitCodes(query, 'all'), /No exit code/, query);
    }
  });
});
