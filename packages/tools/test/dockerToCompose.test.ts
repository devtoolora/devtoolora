import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { dockerToComposeTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';

describe('Docker Run to Compose tool', () => {
  it('exports exact YAML and matching audit from the same conversion', async () => {
    const text = "docker run -e 'MESSAGE=$literal' alpine sh -c 'echo $HOME'";
    const yaml = await dockerToComposeTool.run({ fields: { output: 'yaml' }, text });
    const audit = await dockerToComposeTool.run({ fields: { output: 'report' }, text });

    assert.equal(yaml.artifact?.fileName, 'compose.yaml');
    assert.equal(audit.artifact?.fileName, 'docker-compose-report.json');
    assert.equal(Buffer.from(yaml.artifact?.base64 ?? '', 'base64').toString('utf8'), yaml.text);

    assert.equal(
      Buffer.from(yaml.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
      audit.text,
    );

    assert.equal(
      Buffer.from(audit.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
      yaml.text,
    );

    const report = JSON.parse(audit.text);

    assert.equal(report.runtimeValidated, false);
    assert.equal(report.result.originalInput, text);
    assert.deepEqual(report.result.command, ['sh', '-c', 'echo $HOME']);
    assert.equal(report.result.text, yaml.text);
    assert.match(yaml.text, /\$\$HOME/);
    assert.match(yaml.summary ?? '', /secrets/);
    assert.deepEqual(dockerToComposeTool.resultActions, ['copy', 'scratch', 'save']);
  });

  it('provides complete samples and documentation on every platform', async () => {
    assert.equal(contentOf(dockerToComposeTool).documentation?.length, 2);
    assert.equal(dockerToComposeTool.samples?.length, 12);

    for (const sample of dockerToComposeTool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}), ['output']);

      assert.ok(
        (await dockerToComposeTool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' }))
          .artifact,
      );
    }

    assert.deepEqual(dockerToComposeTool.capabilities, [
      'browserWorker',
      'browserMain',
      'vscode',
      'desktop',
    ]);
  });

  it('returns no partial output for malformed commands or unknown modes', async () => {
    await assert.rejects(
      async () =>
        dockerToComposeTool.run({ fields: { output: 'unknown' }, text: 'docker run alpine' }),
      /Choose/,
    );

    await assert.rejects(
      async () => dockerToComposeTool.run({ fields: {}, text: 'docker run --gpus all alpine' }),
      /Unsupported Docker option/,
    );

    await assert.rejects(async () => dockerToComposeTool.run({ fields: {}, text: '' }), /required/);
  });
});
