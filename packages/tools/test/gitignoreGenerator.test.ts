import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { gitignoreGeneratorTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';

describe('gitignore generator tool', () => {
  it('preserves exact custom lines and audits the same exported file', async () => {
    const custom = '*.log\r\n!keep.log\r*.log\n\ntrailing\\ \n';
    const result = await gitignoreGeneratorTool.run({ fields: { customRules: custom }, text: '' });

    assert.equal(result.text, '# Custom rules\n*.log\n!keep.log\n*.log\n\ntrailing\\ \n');
    assert.equal(result.artifact?.fileName, '.gitignore');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    const report = JSON.parse(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.equal(report.result.text, result.text);
    assert.deepEqual(report.customLines, ['*.log', '!keep.log', '*.log', '', 'trailing\\ ']);
    assert.equal(report.result.customRuleCount, 4);
    assert.deepEqual(report.selectedTemplates, []);
  });

  it('provides complete samples and only excludes generated rules', async () => {
    assert.equal(contentOf(gitignoreGeneratorTool).documentation?.length, 2);
    assert.equal(gitignoreGeneratorTool.samples?.length, 9);

    for (const sample of gitignoreGeneratorTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 7);
      const result = await gitignoreGeneratorTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    const node = await gitignoreGeneratorTool.run({ fields: { languages: 'node' }, text: '' });

    assert.match(node.text, /^\.env\*\.local$/m);

    const result = await gitignoreGeneratorTool.run({
      fields: { customRules: '.env', excludeGeneratedRules: '.env', languages: 'node' },
      text: '',
    });

    assert.match(result.text, /# Custom rules\n\.env\n$/);
    assert.equal(result.text.match(/^\.env$/gm)?.length, 1);
    assert.match(result.summary ?? '', /1 generated lines excluded/);
  });

  it('rejects unknown selections, NUL and oversized fields without hiding them', async () => {
    await assert.rejects(
      async () => gitignoreGeneratorTool.run({ fields: { languages: 'node,unknown' }, text: '' }),
      /Unknown selections/,
    );

    await assert.rejects(
      async () => gitignoreGeneratorTool.run({ fields: { customRules: '\u0000' }, text: '' }),
      /valid Unicode lines/,
    );

    await assert.rejects(
      async () =>
        gitignoreGeneratorTool.run({ fields: { customRules: 'x'.repeat(100001) }, text: '' }),
      /100,000/,
    );

    await assert.rejects(
      async () => gitignoreGeneratorTool.run({ fields: { os: 'x'.repeat(2049) }, text: '' }),
      /2,048/,
    );
  });
});
