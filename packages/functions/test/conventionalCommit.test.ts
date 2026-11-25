import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildConventionalCommit, type CommitOptions, type CommitType } from '../src/dev';

describe('conventional commit', () => {
  const base: CommitOptions = {
    body: '',
    breaking: false,
    breakingText: '',
    description: 'add arrays',
    footers: '',
    scope: 'parser',
    type: 'feat',
  };

  it('builds header, body and footers', () => {
    assert.deepEqual(buildConventionalCommit(base), {
      header: 'feat(parser): add arrays',
      message: 'feat(parser): add arrays\n',
      warnings: [],
    });

    assert.equal(
      buildConventionalCommit({
        ...base,
        body: 'Body line\r\n\r\nSecond\n\n',
        breaking: true,
        breakingText: 'drops Node 18',
        footers: 'Refs: #12\n\nReviewed-by: Ada\nCloses #7',
      }).message,
      'feat(parser)!: add arrays\n\nBody line\n\nSecond\n\nRefs: #12\nReviewed-by: Ada\nCloses #7\nBREAKING CHANGE: drops Node 18\n',
    );

    assert.equal(
      buildConventionalCommit({ ...base, breaking: true, scope: '', type: 'fix' }).message,
      'fix!: add arrays\n',
    );

    assert.equal(
      buildConventionalCommit({ ...base, footers: 'BREAKING-CHANGE: x' }).message,
      'feat(parser): add arrays\n\nBREAKING-CHANGE: x\n',
    );
  });

  it('validates parts and warns on long headers', () => {
    const fails = (options: Partial<CommitOptions>, message: string) =>
      assert.throws(() => buildConventionalCommit({ ...base, ...options }), { message });

    fails({ description: ' ' }, 'Enter a description.');
    fails({ description: 'a\nb' }, 'Description must be one line.');
    fails({ scope: 'a b' }, 'Scope may contain letters, digits and . _ / , - only.');
    fails({ scope: 'a'.repeat(51) }, 'Scope is limited to 50 characters.');
    fails({ footers: 'Fixes bug' }, 'Footer line 1 must be "Token: value" or "Token #value".');

    fails(
      { footers: 'Signed off by: x' },
      'Footer line 1 must be "Token: value" or "Token #value".',
    );

    fails({ footers: 'A: b\n'.repeat(101) }, 'Footers are limited to 100 lines.');
    fails({ type: '__proto__' as CommitType }, 'Choose a commit type.');

    assert.deepEqual(buildConventionalCommit({ ...base, description: 'x'.repeat(70) }).warnings, [
      'Header is 84 characters; many projects limit it to 72.',
    ]);
  });
});
