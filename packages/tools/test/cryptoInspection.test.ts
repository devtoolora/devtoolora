import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { describe, it } from 'vitest';
import { browserCryptoTools } from '../src/catalog/crypto';
import { contentOf } from './toolContent';

const ids = [
  'password-strength',
  'certificate-inspector',
  'certificate-chain-analyzer',
  'pem-key-inspector',
];

describe('crypto inspection adapters', () => {
  it('provides complete guides, six samples, structured output and exact JSON exports', async () => {
    for (const id of ids) {
      const tool = browserCryptoTools.find((candidate) => candidate.id === id)!;

      assert.equal(tool.autoRun, false);
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.match(contentOf(tool).documentation?.[0]?.title ?? '', /^What is /);
      assert.match(contentOf(tool).documentation?.[1]?.title ?? '', /^When to use /);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 5);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 4);
      assert.ok((tool.samples?.length ?? 0) >= 6);

      for (const sample of tool.samples ?? []) {
        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.equal(result.artifact?.fileName, `${id}.json`);

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );

        assert.ok((result.jsonTree?.nodes.length ?? 0) > 0);
        const report = JSON.parse(result.text);

        if (id.includes('certificate')) assert.equal(report.trustEstablished, false);
        if (id === 'password-strength')
          assert.ok(!result.text.includes(sample.fields?.password ?? 'missing'));
      }
    }
  });

  it('reports oversized PEM files as too large', async () => {
    const inspector = browserCryptoTools.find((tool) => tool.id === 'certificate-inspector')!;
    const certificateFile = `data:application/x-pem-file;base64,${Buffer.alloc(1024 * 1024 + 1).toString('base64')}`;

    await assert.rejects(
      async () => inspector.run({ fields: { certificateFile }, text: '' }),
      /no larger than 1 MiB/,
    );
  });

  it('preserves password input, rejects passphrases and never exports private key material', async () => {
    const strength = browserCryptoTools.find((tool) => tool.id === 'password-strength')!;

    assert.equal(strength.supportsSelection, false);
    assert.equal(strength.fields?.[0]?.type, 'password');

    assert.equal(
      JSON.parse((await strength.run({ fields: { password: ' leading spaces ' }, text: '' })).text)
        .length,
      16,
    );

    assert.equal(
      JSON.parse((await strength.run({ fields: {}, text: 'legacy text' })).text).length,
      11,
    );

    await assert.rejects(async () =>
      strength.run({ fields: { password: '' }, text: 'ignored legacy text' }),
    );

    const pem = browserCryptoTools.find((tool) => tool.id === 'pem-key-inspector')!;

    assert.ok(!pem.fields?.some((field) => field.id === 'passphrase'));

    await assert.rejects(
      async () => pem.run({ fields: { passphrase: 'unsupported' }, text: '' }),
      /required/,
    );

    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const text = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const result = await pem.run({ fields: {}, text });

    assert.ok(!result.text.includes(text.split('\n')[1]!));
    assert.equal(JSON.parse(result.text).kind, 'private');
  });

  it('has exact file precedence and distinct reversed-chain results', async () => {
    for (const id of ['certificate-inspector', 'certificate-chain-analyzer', 'pem-key-inspector']) {
      const tool = browserCryptoTools.find((candidate) => candidate.id === id)!;
      const fileField = tool.fields?.find((field) => field.type === 'file');

      assert.ok(fileField?.type === 'file');

      assert.equal(fileField.maxBytes, 1024 * 1024);

      await assert.rejects(async () =>
        tool.run({
          fields: { [fileField.id]: 'invalid selected file' },
          text: tool.samples?.[0]?.text ?? '',
        }),
      );
    }

    const chain = browserCryptoTools.find((tool) => tool.id === 'certificate-chain-analyzer')!;
    const reversed = chain.samples?.find((sample) => sample.label === 'Reversed order');

    assert.ok(reversed);
    const report = JSON.parse(
      (await chain.run({ fields: reversed.fields ?? {}, text: reversed.text ?? '' })).text,
    );

    assert.equal(report.links[0].issuerMatchesNextSubject, false);
    assert.equal(report.links[0].signatureVerified, false);
  });
});
