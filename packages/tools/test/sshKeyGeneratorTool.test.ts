import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { sshKeyGeneratorTool } from '../src/catalog/crypto/ssh-key-generator/tool';

describe('ssh key generator tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of sshKeyGeneratorTool.samples ?? []) {
      const result = await sshKeyGeneratorTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes the first sample and lists the three sections', async () => {
    const [sample] = sshKeyGeneratorTool.samples ?? [];
    const result = await sshKeyGeneratorTool.run({ fields: sample?.fields ?? {}, text: '' });

    assert.match(
      result.summary ?? '',
      /^Ed25519 · SHA256:[A-Za-z0-9+/]{43} · comment "alice@laptop"$/,
    );

    assert.match(
      result.text,
      /^# Public key \(authorized_keys\)\nssh-ed25519 \S+ alice@laptop\n\n# Private key \(id_ed25519\)\n-----BEGIN OPENSSH PRIVATE KEY-----\n[\s\S]+-----END OPENSSH PRIVATE KEY-----\n\n# Fingerprint\nSHA256:\S+\n$/,
    );
  });

  it('never autoRuns and summarizes an empty comment', async () => {
    const result = await sshKeyGeneratorTool.run({ fields: { comment: '' }, text: '' });

    assert.equal(sshKeyGeneratorTool.autoRun, false);
    assert.match(result.summary ?? '', / · no comment$/);
  });

  it('rejects an oversized comment', async () => {
    await assert.rejects(
      async () => sshKeyGeneratorTool.run({ fields: { comment: 'c'.repeat(257) }, text: '' }),
      /256 characters/,
    );
  });
});
