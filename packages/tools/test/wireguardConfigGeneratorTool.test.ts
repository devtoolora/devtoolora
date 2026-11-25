import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError, type ToolResult } from '@devtoolora/core';
import { wireguardConfigGeneratorTool, wireguardKeyGeneratorTool } from '../src/catalog/network';

const defaultsOf = (fields = wireguardConfigGeneratorTool.fields) =>
  Object.fromEntries((fields ?? []).map((field) => [field.id, field.defaultValue ?? '']));

const run = async (
  extra: Record<string, string>,
  tool = wireguardConfigGeneratorTool,
): Promise<ToolResult> => tool.run({ fields: { ...defaultsOf(tool.fields), ...extra }, text: '' });

const text = (base64: string): string => Buffer.from(base64, 'base64').toString('utf8');

describe('wireguard config generator tool', () => {
  it('declares its fields', () => {
    assert.equal(wireguardConfigGeneratorTool.id, 'wireguard-config-generator');
    assert.equal(wireguardConfigGeneratorTool.inputKind, 'none');
    assert.equal(wireguardConfigGeneratorTool.autoRun, false);
    assert.equal(wireguardKeyGeneratorTool.autoRun, false);
    assert.equal(wireguardConfigGeneratorTool.freshResults, true);
    assert.deepEqual(wireguardConfigGeneratorTool.resultActions, ['copy', 'scratch', 'save']);

    assert.deepEqual(wireguardConfigGeneratorTool.relatedToolIds, [
      'ipv4-subnet',
      'cidr-aggregator',
      'qr-code-generator',
    ]);

    assert.deepEqual(
      wireguardConfigGeneratorTool.fields?.map(({ defaultValue, id, label, type }) => [
        id,
        label,
        type,
        defaultValue,
      ]),
      [
        ['mode', 'Mode', 'select', 'config'],
        ['privateKey', 'Private key', 'password', undefined],
        ['endpoint', 'Endpoint', 'text', undefined],
        ['listenPort', 'Listen port', 'number', '51820'],
        ['subnet', 'IPv4 subnet', 'text', '10.8.0.0/24'],
        ['subnet6', 'IPv6 subnet', 'text', undefined],
        ['clients', 'Clients', 'number', '3'],
        ['clientAllowedIps', 'Client AllowedIPs', 'select', 'full'],
        ['customAllowedIps', 'Custom AllowedIPs', 'textarea', undefined],
        ['dns', 'DNS', 'text', undefined],
        ['keepalive', 'PersistentKeepalive', 'number', '25'],
        ['presharedKeys', 'Preshared keys', 'checkbox', 'true'],
        ['natInterface', 'NAT interface', 'text', undefined],
      ],
    );
  });

  it('defaults the alias to the key pair mode', () => {
    assert.equal(wireguardKeyGeneratorTool.aliasOf, 'wireguard-config-generator');

    assert.equal(
      wireguardKeyGeneratorTool.fields?.find((field) => field.id === 'mode')?.defaultValue,
      'keys',
    );
  });

  it('sets the mode in every sample', () => {
    for (const tool of [wireguardConfigGeneratorTool, wireguardKeyGeneratorTool])
      for (const sample of tool.samples ?? [])
        assert.ok(sample.fields?.mode === 'config' || sample.fields?.mode === 'keys', sample.label);
  });

  it('writes wg0.conf and three client files with 44-character keys', async () => {
    const sample = wireguardConfigGeneratorTool.samples?.[0];
    const output = await run(sample?.fields ?? {});

    assert.equal(output.artifact?.fileName, 'wg0.conf');

    assert.deepEqual(
      output.artifacts?.map((artifact) => artifact.fileName),
      ['client1.conf', 'client2.conf', 'client3.conf'],
    );

    assert.equal(output.artifact?.mimeType, 'text/plain;charset=utf-8');
    assert.equal(output.summary, 'Server 10.8.0.1 + 3 clients · full tunnel · preshared keys');

    for (const artifact of [output.artifact, ...(output.artifacts ?? [])]) {
      const keyLines = text(artifact?.base64 ?? '')
        .split('\n')
        .filter((line) => /^(PrivateKey|PublicKey|PresharedKey) = /.test(line));

      assert.ok(keyLines.length >= 3, artifact?.fileName);

      for (const line of keyLines) assert.match(line.split(' = ')[1] ?? '', /^[A-Za-z0-9+/]{43}=$/);
    }

    assert.ok(output.text.startsWith('# ===== wg0.conf =====\n[Interface]\n'));
  });

  it('derives the RFC 7748 public key in key pair mode', async () => {
    const output = await run(
      wireguardKeyGeneratorTool.samples?.[1]?.fields ?? {},
      wireguardKeyGeneratorTool,
    );

    assert.ok(output.text.includes('PublicKey = hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo=\n'));
    assert.equal(output.artifact?.fileName, 'wireguard-keys.txt');
    assert.equal(output.artifacts, undefined);
  });

  it('ignores hidden custom AllowedIPs and reports function errors', async () => {
    const hidden = await run({ customAllowedIps: 'garbage', endpoint: 'vpn.example.com' });

    assert.ok(hidden.text.includes('AllowedIPs = 0.0.0.0/0\n'));

    await assert.rejects(
      () => run({ endpoint: '' }),
      (error: unknown) => error instanceof ToolError && error.message === 'Endpoint is required.',
    );

    await assert.rejects(
      () => run({ endpoint: 'vpn.example.com', listenPort: '1e3' }),
      (error: unknown) =>
        error instanceof ToolError &&
        error.message === 'Listen port must be a whole number from 1 to 65,535.',
    );

    await assert.rejects(() => run({ mode: 'other' }), ToolError);
  });
});
