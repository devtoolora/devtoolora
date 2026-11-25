import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { explainRegex } from '@devtoolora/functions/text';
import { regexExplainerTool } from '../src/catalog/text';
import { result } from './tools.helpers';

const decode = (base64: string | undefined): string =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('regex explainer tool', () => {
  it('declares its fields', () => {
    const tool = regexExplainerTool;

    assert.equal(tool.id, 'regex-explainer');
    assert.equal(tool.inputKind, 'optionalText');
    assert.equal(tool.requiresInput, false);
    assert.equal(tool.supportsSelection, true);
    assert.equal(tool.autoRun, true);
    assert.equal(tool.freshResults, true);
    assert.equal('isolatedWorker' in tool, false);
    assert.deepEqual(tool.resultActions, ['copy', 'scratch', 'save']);
    assert.deepEqual(tool.relatedToolIds, ['regex-test', 'find-replace', 'pattern-extractor']);

    assert.deepEqual(tool.inputPresentation, {
      label: 'Pattern',
      placeholder: '/^(?<year>\\d{4})$/u',
    });

    assert.deepEqual(
      tool.fields?.map(({ defaultValue, id, label, type }) => ({ defaultValue, id, label, type })),
      [{ defaultValue: '', id: 'flags', label: 'Flags', type: 'text' }],
    );
  });

  it('returns the tree and both artifacts', async () => {
    const output = await result('regex-explainer', '/a\\/b/gi', { flags: 'm' });

    assert.match(output.text, /^Flags: g \(global\), i \(ignore case\)\n/);
    assert.equal(output.artifact?.fileName, 'regex-explanation.txt');
    assert.equal(decode(output.artifact?.base64), output.text);

    assert.deepEqual(
      output.artifacts?.map((artifact) => artifact.fileName),
      ['regex-explanation.json'],
    );

    assert.equal(JSON.parse(decode(output.artifacts?.[0]?.base64)).flags, 'gi');
    assert.match(output.summary ?? '', /flags from the \/…\/ literal/);
  });

  it('explains an empty pattern', async () => {
    const output = await result('regex-explainer', '', { flags: '' });

    assert.equal(output.text, 'Flags: none\n(empty)  Matches an empty string at every position\n');
  });

  it('reports a bad pattern as a tool error', async () => {
    await assert.rejects(
      result('regex-explainer', '(a', {}),
      (error: Error) => error.message === 'Unterminated group opened at index 0.',
    );
  });

  it('runs every sample through the parser path', () => {
    for (const sample of regexExplainerTool.samples ?? [])
      assert.match(
        explainRegex(sample.text ?? '', sample.fields?.flags ?? '').summary,
        /^Explained /,
        sample.label,
      );
  });
});
