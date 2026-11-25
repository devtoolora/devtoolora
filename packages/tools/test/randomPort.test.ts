import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { randomPortTool } from '../src/catalog/devUtilities';
import { contentOf } from './toolContent';

describe('Random Port Generator tool', () => {
  it('exports the same distinct batch as TXT and a clearly unverified availability audit', async () => {
    const result = await randomPortTool.run({
      fields: { count: '3', max: '3002', min: '3000' },
      text: '',
    });
    const ports = result.text.split('\n').map(Number);

    assert.deepEqual(
      [...ports].sort((a, b) => a - b),
      [3000, 3001, 3002],
    );

    assert.equal(result.artifact?.fileName, 'random-ports.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.equal(result.artifacts?.[0]?.fileName, 'random-ports-report.json');
    const audit = JSON.parse(
      Buffer.from(result.artifacts?.[0].base64 ?? '', 'base64').toString('utf8'),
    );

    assert.deepEqual(audit.ports, ports);
    assert.equal(audit.availabilityChecked, false);
    assert.deepEqual(audit.range, { max: 3002, min: 3000 });
    assert.match(result.summary ?? '', /3 distinct.*availability not checked/);
    assert.equal(randomPortTool.autoRun, undefined);
    assert.deepEqual(randomPortTool.resultActions, ['copy', 'scratch', 'save']);
  });

  it('provides complete samples, guides and a warning for System Ports', async () => {
    assert.equal(contentOf(randomPortTool).documentation?.length, 2);
    assert.equal(randomPortTool.samples?.length, 7);

    for (const sample of randomPortTool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), ['count', 'max', 'min']);
      const result = await randomPortTool.run({ fields: sample.fields ?? {}, text: '' });
      const ports = result.text.split('\n').map(Number);

      assert.equal(ports.length, Number(sample.fields?.count));
      assert.equal(new Set(ports).size, ports.length);

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    const system = await randomPortTool.run({
      fields: { count: '1', max: '1', min: '1' },
      text: '',
    });

    assert.equal(system.text, '1');
    assert.match(system.summary ?? '', /System Ports/);
    assert.equal((await randomPortTool.run({ fields: {}, text: '' })).text.split('\n').length, 5);
  });

  it('rejects edited empty fields and invalid syntax instead of silently rounding or clamping', async () => {
    for (const field of ['count', 'min', 'max']) {
      for (const value of ['', ' ', '1.5', '1e2', '0x10', '-1', 'Infinity', 'NaN']) {
        await assert.rejects(
          async () =>
            randomPortTool.run({
              fields: { count: '1', max: '3002', min: '3000', [field]: value },
              text: '',
            }),
          /must be a whole number between/,
        );
      }
    }

    await assert.rejects(
      async () =>
        randomPortTool.run({ fields: { count: '4', max: '3002', min: '3000' }, text: '' }),
      /3 distinct ports/,
    );

    await assert.rejects(
      async () =>
        randomPortTool.run({ fields: { count: '1', max: '3000', min: '3002' }, text: '' }),
      /Min port must not exceed/,
    );

    await assert.rejects(
      async () => randomPortTool.run({ fields: { count: '1001' }, text: '' }),
      /between 1 and 1000/,
    );
  });
});
