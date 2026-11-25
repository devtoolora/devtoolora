import assert from 'node:assert/strict';
import { ToolError } from '@devtoolora/core';
import { describe, it } from 'vitest';
import { dockerComposeValidatorTool } from '../src/catalog/devUtilities';

const typo = 'services:\n  web:\n    image: nginx\n    enviroment:\n      - DEBUG=1\n';
const decode = (base64: string | undefined): string =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('docker compose validator tool', () => {
  it('declares its fields', () => {
    assert.equal(dockerComposeValidatorTool.id, 'docker-compose-validator');
    assert.equal(dockerComposeValidatorTool.inputKind, 'text');
    assert.equal(dockerComposeValidatorTool.sensitiveInput, true);
    assert.equal(dockerComposeValidatorTool.autoRun, true);
    assert.equal(dockerComposeValidatorTool.freshResults, true);
    assert.deepEqual(dockerComposeValidatorTool.resultActions, ['copy', 'scratch', 'save']);

    assert.deepEqual(dockerComposeValidatorTool.relatedToolIds, [
      'docker-to-compose',
      'yaml-format',
      'dotenv-validator',
    ]);

    assert.deepEqual(
      dockerComposeValidatorTool.fields?.map(({ defaultValue, id, type }) => [
        id,
        type,
        defaultValue,
      ]),
      [['output', 'select', 'report']],
    );
  });

  it('returns a normal result for an invalid file', async () => {
    const result = await dockerComposeValidatorTool.run({
      fields: { output: 'report' },
      text: typo,
    });

    assert.match(result.text ?? '', /did you mean "environment"\?/);
    assert.equal(result.summary, 'Invalid · 1 error · 1 service.');
    assert.equal(result.artifact?.fileName, 'compose-report.txt');
    assert.equal(decode(result.artifact?.base64), result.text);
    assert.equal(result.artifacts?.[0]?.fileName, 'compose-report.json');
    assert.equal(result.noWrap, undefined);
  });

  it('writes the JSON report', async () => {
    const result = await dockerComposeValidatorTool.run({ fields: { output: 'json' }, text: typo });
    const parsed = JSON.parse(result.text ?? '') as Record<string, unknown>;

    assert.deepEqual(Object.keys(parsed), ['errors', 'services', 'valid', 'warnings']);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.services, 1);
    assert.equal(result.noWrap, undefined);
    assert.equal(result.artifact?.fileName, 'compose-report.json');
    assert.equal(decode(result.artifact?.base64), result.text);
    assert.equal(result.artifacts?.[0]?.fileName, 'compose-report.txt');
    assert.ok((result.text ?? '').includes('\n  "errors"'));
  });

  it('turns limits and parser errors into tool errors', async () => {
    await assert.rejects(
      async () => dockerComposeValidatorTool.run({ fields: { output: 'report' }, text: '- a' }),
      (error: unknown) =>
        error instanceof ToolError &&
        error.message === 'The Compose file must be a mapping at the top level.',
    );

    await assert.rejects(
      async () => dockerComposeValidatorTool.run({ fields: { output: 'report' }, text: 'a: [' }),
      (error: unknown) => error instanceof ToolError,
    );

    await assert.rejects(
      async () => dockerComposeValidatorTool.run({ fields: { output: 'xml' }, text: typo }),
      (error: unknown) => error instanceof ToolError && error.message === 'Choose Report or JSON.',
    );
  });
});
