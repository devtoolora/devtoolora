import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { generateGitignore } from '../src/dev';

describe('gitignore generation', () => {
  it('retains all custom lines, duplicates, comments, blank lines and escaped whitespace', () => {
    const custom = [
      '*.log',
      '!keep.log',
      '*.log',
      '# comment',
      '',
      '\\#literal',
      'trailing\\ ',
      ' leading',
    ];
    const report = generateGitignore([{ label: 'Base', rules: ['*.log', 'dist/'] }], custom, []);

    assert.equal(report.text, `# Base\n*.log\ndist/\n\n# Custom rules\n${custom.join('\n')}\n`);
    assert.equal(report.customLineCount, 8);
    assert.equal(report.customRuleCount, 6);
    assert.equal(report.generatedRuleCount, 2);
  });

  it('deduplicates positive generated lines without removing repetitions across negation', () => {
    const report = generateGitignore(
      [
        { label: 'First', rules: ['*.log', '*.log', '!keep.log', '!keep.log'] },
        { label: 'Second', rules: ['*.log', '*.log'] },
      ],
      [],
      [],
    );

    assert.equal(report.text, '# First\n*.log\n!keep.log\n!keep.log\n\n# Second\n*.log\n');
    assert.equal(report.generatedRuleCount, 4);
  });

  it('only excludes literal generated lines and returns a valid empty starter', () => {
    const report = generateGitignore(
      [{ label: 'Base', rules: ['dist/', '.env', 'dist/'] }],
      ['dist/', 'dist/'],
      ['dist/'],
    );

    assert.equal(report.text, '# Base\n.env\n\n# Custom rules\ndist/\ndist/\n');
    assert.equal(report.excludedRuleCount, 2);
    assert.equal(report.customRuleCount, 2);

    assert.equal(
      generateGitignore([], [], []).text,
      '# Select one or more templates or add custom rules.\n',
    );
  });

  it('rejects malformed lines and bounded inputs before returning a partial file', () => {
    for (const line of ['a\n!a', 'a\rb', '\u0000', '\uD800']) {
      assert.throws(() => generateGitignore([], [line], []), /valid Unicode lines/);

      assert.throws(
        () => generateGitignore([{ label: line, rules: ['x'] }], [], []),
        /valid Unicode lines/,
      );

      assert.throws(() => generateGitignore([], [], [line]), /valid Unicode lines/);
    }

    assert.equal(generateGitignore([], ['😀'], []).customRuleCount, 1);
    assert.equal(generateGitignore([], ['x'.repeat(100000)], []).customLineCount, 1);
    assert.throws(() => generateGitignore([], ['x'.repeat(100001)], []), /100,000/);
    assert.throws(() => generateGitignore([], Array(10001).fill('x'), []), /10,000/);
  });

  it('matches the intended order and escape behavior in actual Git', () => {
    const directory = mkdtempSync(join(tmpdir(), 'devtoolora-gitignore-'));

    try {
      assert.equal(spawnSync('git', ['init', '--quiet', directory]).status, 0);
      const result = generateGitignore(
        [],
        ['*.log', '!keep.log', '*.log', '\\#literal', 'trailing\\ '],
        [],
      );

      writeFileSync(join(directory, '.gitignore'), result.text);

      for (const path of ['keep.log', '#literal', 'trailing ']) {
        const check = spawnSync('git', [
          '-c',
          'core.excludesFile=/dev/null',
          '-C',
          directory,
          'check-ignore',
          '--no-index',
          '-q',
          '--',
          path,
        ]);

        assert.equal(check.status, 0, `${path} must remain ignored by the generated rules.`);
      }

      const check = spawnSync('git', [
        '-c',
        'core.excludesFile=/dev/null',
        '-C',
        directory,
        'check-ignore',
        '--no-index',
        '-q',
        '--',
        'trailing',
      ]);

      assert.equal(check.status, 1);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
