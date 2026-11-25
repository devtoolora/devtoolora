import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { jwkToPemTool, pemToJwkTool } from '../src/catalog/crypto/jwk-to-pem/tool';

describe('jwk-to-pem tool', () => {
  it('runs every sample with text and a summary', async () => {
    for (const sample of jwkToPemTool.samples ?? []) {
      const result = await jwkToPemTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('summarizes keys and sets', async () => {
    const [first, second, , set, pem] = jwkToPemTool.samples ?? [];
    const run = (text = '') => jwkToPemTool.run({ fields: {}, text });

    assert.equal((await run(first?.text)).summary, 'RSA 2048-bit public key · JWK → PEM');
    assert.equal((await run(second?.text)).summary, 'EC P-256 private key · JWK → PEM');
    assert.equal((await run(second?.text)).artifact?.fileName, 'key.pem');
    assert.equal((await run(set?.text)).summary, '2 keys · JWK Set → PEM · kid a, b');
    assert.equal((await run(pem?.text)).summary, 'EC P-256 public key · PEM → JWK');
  });

  it('rejects a direction that disagrees with the input', async () => {
    await assert.rejects(
      async () =>
        jwkToPemTool.run({
          fields: { direction: 'jwk-to-pem' },
          text: '-----BEGIN PUBLIC KEY-----\nAA==\n-----END PUBLIC KEY-----',
        }),
      /Input is PEM; switch Direction to PEM to JWK\./,
    );
  });

  it('reports invalid input as a tool error', async () => {
    await assert.rejects(
      async () => jwkToPemTool.run({ fields: {}, text: 'hello' }),
      (error) =>
        error instanceof ToolError && /Paste a JWK, a JWK Set or a PEM key/.test(error.message),
    );
  });

  it('defines the PEM to JWK alias', () => {
    assert.equal(pemToJwkTool.aliasOf, 'jwk-to-pem');

    assert.equal(
      pemToJwkTool.fields?.find((field) => field.id === 'direction')?.defaultValue,
      'pem-to-jwk',
    );
  });

  it('runs every sample of both tools with the UI field defaults applied', async () => {
    for (const tool of [jwkToPemTool, pemToJwkTool]) {
      const defaults = Object.fromEntries(
        (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
      );

      for (const sample of tool.samples ?? []) {
        const result = await tool.run({
          fields: { ...defaults, ...sample.fields },
          text: sample.text ?? '',
        });

        assert.ok(result.text, `${tool.id}: ${sample.label}`);
        assert.ok(result.summary, `${tool.id}: ${sample.label}`);
      }
    }
  });
});
