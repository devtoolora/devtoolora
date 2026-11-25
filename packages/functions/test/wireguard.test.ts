import assert from 'node:assert/strict';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FunctionError } from '../src/errors';
import { generateWireguard, type WireguardOptions } from '../src/network';

type ConfigOptions = Extract<WireguardOptions, { mode: 'config' }>;

const counterRandom = (): ((length: number) => Uint8Array) => {
  let call = 0;

  return (length) => {
    const start = call++ * 32;

    return Uint8Array.from({ length }, (_, index) => (start + index) & 255);
  };
};

const config: ConfigOptions = {
  clientAllowedIps: 'full',
  clients: 3,
  customAllowedIps: '',
  dns: '',
  endpoint: 'vpn.example.com',
  keepalive: 25,
  listenPort: 51_820,
  mode: 'config',
  natInterface: '',
  presharedKeys: true,
  subnet: '10.8.0.0/24',
  subnet6: '',
};

const keysFor = (privateKey: string) =>
  generateWireguard({ mode: 'keys', privateKey }, counterRandom());

const messageOf = async (extra: Partial<ConfigOptions>): Promise<string> => {
  try {
    await generateWireguard({ ...config, ...extra }, counterRandom());
  } catch (error) {
    assert.ok(error instanceof FunctionError);

    return error.message;
  }

  return 'no error';
};

const defaultFiles: Array<[string, string]> = [
  [
    'wg0.conf',
    '[Interface]\nAddress = 10.8.0.1/24\nListenPort = 51820\nPrivateKey = AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHl8=\n\n[Peer]\n# client1\nPublicKey = NYBy1jZYgNGu6jKa35EhODhR7SGijjt16WXQ0s0WYlQ=\nPresharedKey = QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8=\nAllowedIPs = 10.8.0.2/32\n\n[Peer]\n# client2\nPublicKey = Z13VdO13iTELPS52gfN5C0ZsdzsVIf7PNld5WDcepS8=\nPresharedKey = gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8=\nAllowedIPs = 10.8.0.3/32\n\n[Peer]\n# client3\nPublicKey = YFpyXSpK3+6xop4X7dYhwbdZPujNvESsbEq24vgF0jw=\nPresharedKey = wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t8=\nAllowedIPs = 10.8.0.4/32\n',
  ],
  [
    'client1.conf',
    '[Interface]\nAddress = 10.8.0.2/32\nPrivateKey = ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pn8=\n\n[Peer]\n# Server\nPublicKey = j0DFrbaPJWJK5bIU6nZ6bslNgp09e14a0bpvPiE4KF8=\nPresharedKey = QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl8=\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25\n',
  ],
  [
    'client2.conf',
    '[Interface]\nAddress = 10.8.0.3/32\nPrivateKey = YGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn8=\n\n[Peer]\n# Server\nPublicKey = j0DFrbaPJWJK5bIU6nZ6bslNgp09e14a0bpvPiE4KF8=\nPresharedKey = gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp8=\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25\n',
  ],
  [
    'client3.conf',
    '[Interface]\nAddress = 10.8.0.4/32\nPrivateKey = oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vn8=\n\n[Peer]\n# Server\nPublicKey = j0DFrbaPJWJK5bIU6nZ6bslNgp09e14a0bpvPiE4KF8=\nPresharedKey = wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t8=\nEndpoint = vpn.example.com:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25\n',
  ],
];

const ipv6Files: Array<[string, string]> = [
  [
    'wg0.conf',
    '[Interface]\nAddress = 10.8.0.1/24, fd00:8::1/64\nListenPort = 51821\nPrivateKey = AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHl8=\nPostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; ip6tables -A FORWARD -i %i -j ACCEPT; ip6tables -A FORWARD -o %i -j ACCEPT; ip6tables -t nat -A POSTROUTING -o eth0 -j MASQUERADE\nPostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; ip6tables -D FORWARD -i %i -j ACCEPT; ip6tables -D FORWARD -o %i -j ACCEPT; ip6tables -t nat -D POSTROUTING -o eth0 -j MASQUERADE\n\n[Peer]\n# client1\nPublicKey = NYBy1jZYgNGu6jKa35EhODhR7SGijjt16WXQ0s0WYlQ=\nAllowedIPs = 10.8.0.2/32, fd00:8::2/128\n',
  ],
  [
    'client1.conf',
    '[Interface]\nAddress = 10.8.0.2/32, fd00:8::2/128\nPrivateKey = ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pn8=\nDNS = 10.8.0.1, fd00:8::1\n\n[Peer]\n# Server\nPublicKey = j0DFrbaPJWJK5bIU6nZ6bslNgp09e14a0bpvPiE4KF8=\nEndpoint = [2001:db8::10]:51821\nAllowedIPs = 10.8.0.0/24, fd00:8::/64\n',
  ],
];

afterEach(() => vi.restoreAllMocks());

describe('wireguard keys mode', () => {
  it('derives the RFC 7748 public key', async () => {
    const { text } = await keysFor('dwdtCnMYpX08FsFyUbJmRd9ML4frwJkqsXf7pR25LCo=');

    assert.ok(text.includes('PublicKey = hSDwCYkwp1R0i33ctD73Wg2/Og0mOBr066SpjqqbTmo=\n'));
    assert.ok(text.startsWith('PrivateKey = dwdtCnMYpX08FsFyUbJmRd9ML4frwJkqsXf7pR25LCo=\n'));
  });

  it('generates a clamped key pair from the random source', async () => {
    const result = await keysFor('');

    assert.equal(
      result.text,
      'PrivateKey = AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHl8=\nPublicKey = j0DFrbaPJWJK5bIU6nZ6bslNgp09e14a0bpvPiE4KF8=\n',
    );

    assert.equal(result.summary, 'X25519 key pair · generated');
    assert.deepEqual(result.files, [{ name: 'wireguard-keys.txt', text: result.text }]);
  });

  it('says when the key was derived', async () => {
    const { summary } = await keysFor('dwdtCnMYpX08FsFyUbJmRd9ML4frwJkqsXf7pR25LCo=');

    assert.equal(summary, 'X25519 key pair · derived from your private key');
  });

  it('clamps 1,000 random private keys', async () => {
    const sources = [
      (n: number) => crypto.getRandomValues(new Uint8Array(n)),
      (n: number) => new Uint8Array(n).fill(0),
      (n: number) => new Uint8Array(n).fill(255),
    ];

    for (const [index, random] of sources.entries())
      for (let run = 0; run < (index === 0 ? 1000 : 1); run += 1) {
        const { text } = await generateWireguard({ mode: 'keys', privateKey: '' }, random);
        const key = Buffer.from(
          (text.split('\n')[0] ?? '').slice('PrivateKey = '.length),
          'base64',
        );

        assert.equal(key.length, 32);
        assert.equal((key[0] ?? 0) & 7, 0);
        assert.equal((key[31] ?? 0) & 128, 0);
        assert.equal((key[31] ?? 0) & 64, 64);
      }
  });

  it('rejects keys that are not 32 Base64 bytes', async () => {
    const wrong = 'Private key must be 44 Base64 characters (32 bytes).';
    const forty3 = Buffer.alloc(43, 1).toString('base64');

    for (const value of ['abc', forty3, 'dwdtCnMYpX08FsFyUbJmRd9ML4frwJkqsXf7pR25LCo'])
      await expect(keysFor(value)).rejects.toThrow(wrong);
  });

  it('reports a runtime without X25519', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValueOnce(
      new DOMException('x', 'NotSupportedError'),
    );

    await expect(keysFor('')).rejects.toThrow(
      'This runtime does not support X25519 in Web Crypto. Use a current browser or update VS Code.',
    );
  });

  it('hides engine text for other Web Crypto failures', async () => {
    vi.spyOn(crypto.subtle, 'deriveBits').mockRejectedValueOnce(new Error('engine secret'));

    await expect(keysFor('')).rejects.toThrow('The X25519 key could not be derived.');
  });

  it('rejects control characters in the private key', async () => {
    const injected = [
      'a\nB=1',
      'a\rB=1',
      `a${String.fromCharCode(0x2028)}B=1`,
      `a${String.fromCharCode(0)}B=1`,
      '\n',
    ];

    for (const value of injected)
      await expect(keysFor(value)).rejects.toThrow(
        'Private key must be one line without control characters.',
      );
  });
});

describe('wireguard config mode', () => {
  it('writes the default config', async () => {
    const result = await generateWireguard(config, counterRandom());

    assert.deepEqual(
      result.files.map((file) => [file.name, file.text]),
      defaultFiles,
    );

    assert.equal(result.summary, 'Server 10.8.0.1 + 3 clients · full tunnel · preshared keys');

    assert.equal(
      result.text,
      defaultFiles.map(([name, text]) => `# ===== ${name} =====\n${text}`).join('\n'),
    );
  });

  it('writes dual stack with NAT and DNS', async () => {
    const result = await generateWireguard(
      {
        ...config,
        clientAllowedIps: 'vpn',
        clients: 1,
        dns: '10.8.0.1, fd00:8::1',
        endpoint: '2001:db8::10',
        keepalive: 0,
        listenPort: 51_821,
        natInterface: 'eth0',
        presharedKeys: false,
        subnet6: 'fd00:8::/64',
      },
      counterRandom(),
    );

    assert.deepEqual(
      result.files.map((file) => [file.name, file.text]),
      ipv6Files,
    );

    assert.equal(
      result.summary,
      'Server 10.8.0.1 + 1 client · VPN subnet only · no preshared keys',
    );
  });

  it('writes custom routes in input order', async () => {
    const { files, summary } = await generateWireguard(
      {
        ...config,
        clientAllowedIps: 'custom',
        clients: 1,
        customAllowedIps: ' 192.168.1.0/24\r\n\n10.0.0.0/8\n',
      },
      counterRandom(),
    );

    assert.ok(files[1]?.text.includes('AllowedIPs = 192.168.1.0/24, 10.0.0.0/8\n'));
    assert.ok(summary.includes('custom AllowedIPs'));
  });

  it('adds ::/0 to the full tunnel with an IPv6 subnet', async () => {
    const { files } = await generateWireguard(
      { ...config, subnet6: 'fd00:8::/64' },
      counterRandom(),
    );

    assert.ok(files[1]?.text.includes('AllowedIPs = 0.0.0.0/0, ::/0\n'));
  });

  it('draws random bytes in a fixed order', async () => {
    const lengths: number[] = [];

    await generateWireguard({ ...config, clients: 2 }, (length) => {
      lengths.push(length);

      return new Uint8Array(length).fill(lengths.length);
    });

    assert.equal(lengths.length, 1 + 2 * 2);
  });

  it('rejects control characters in every free-text field', async () => {
    const injected = [
      'a\nB=1',
      'a\rB=1',
      `a${String.fromCharCode(0x2028)}B=1`,
      `a${String.fromCharCode(0)}B=1`,
    ];
    const fields: Array<[keyof ConfigOptions, string, Partial<ConfigOptions>]> = [
      ['endpoint', 'Endpoint', {}],
      ['subnet', 'IPv4 subnet', {}],
      ['subnet6', 'IPv6 subnet', {}],
      ['customAllowedIps', 'Custom AllowedIPs', { clientAllowedIps: 'custom' }],
      ['dns', 'DNS', {}],
      ['natInterface', 'NAT interface', {}],
    ];

    for (const [field, label, extra] of fields)
      for (const value of injected) {
        const message = await messageOf({ ...extra, [field]: value });

        assert.ok(message.startsWith(label), `${field}: ${message}`);
      }
  });

  it('does not strip leading or trailing line breaks', async () => {
    const lineBreaks = ['\n', '\r', String.fromCharCode(0x2028)];
    const fields = ['endpoint', 'subnet', 'subnet6', 'dns', 'natInterface'] as const;

    for (const lineBreak of lineBreaks)
      for (const field of fields) {
        const base = field === 'endpoint' ? 'vpn.example.com' : '';
        const message = await messageOf({ [field]: `${base}${lineBreak}` });

        assert.ok(message.endsWith('must be one line without control characters.'), field);
      }
  });

  it('checks the endpoint', async () => {
    assert.equal(await messageOf({ endpoint: '' }), 'Endpoint is required.');
    assert.equal(await messageOf({ endpoint: '  ' }), 'Endpoint is required.');
    assert.equal(await messageOf({ endpoint: 'vpn.example.com' }), 'no error');
    assert.equal(await messageOf({ endpoint: '203.0.113.10' }), 'no error');
    assert.equal(await messageOf({ endpoint: '2001:db8::10' }), 'no error');

    assert.equal(
      await messageOf({ endpoint: 'vpn.example.com:51820' }),
      'Endpoint must not include a port; set Listen port instead.',
    );

    assert.equal(
      await messageOf({ endpoint: '[2001:db8::10]:51820' }),
      'Endpoint must not include a port; set Listen port instead.',
    );

    for (const endpoint of ['::', '0.0.0.0'])
      assert.match(await messageOf({ endpoint }), /^Endpoint must not be the unspecified address/);

    assert.match(
      await messageOf({ clientAllowedIps: 'custom', customAllowedIps: '10.0.0.0/33' }),
      /^Custom AllowedIPs/,
    );

    for (const endpoint of [
      'bad host',
      '-a.example.com',
      '1.2.3',
      '256.1.1.1',
      'fe80::1%eth0',
      '[::1]',
    ])
      assert.equal(
        await messageOf({ endpoint }),
        'Endpoint must be a DNS name, an IPv4 address or an IPv6 address.',
        endpoint,
      );
  });

  it('checks the listen port at and past its limits', async () => {
    const message = 'Listen port must be a whole number from 1 to 65,535.';

    assert.equal(await messageOf({ listenPort: 1 }), 'no error');
    assert.equal(await messageOf({ listenPort: 65_535 }), 'no error');
    assert.equal(await messageOf({ listenPort: 0 }), message);
    assert.equal(await messageOf({ listenPort: 65_536 }), message);
    assert.equal(await messageOf({ listenPort: 1.5 }), message);
  });

  it('checks the client count at and past its limits', async () => {
    const message = 'Clients must be a whole number from 1 to 50.';

    assert.equal(await messageOf({ clients: 50 }), 'no error');
    assert.equal(await messageOf({ clients: 51 }), message);
    assert.equal(await messageOf({ clients: 0 }), message);
  });

  it('checks the IPv4 subnet', async () => {
    const shape = 'IPv4 subnet must be a CIDR such as 10.8.0.0/24.';
    const prefix = 'IPv4 subnet prefix must be from /8 to /30.';

    assert.equal(await messageOf({ clients: 1, subnet: '10.8.0.0/30' }), 'no error');

    assert.equal(
      await messageOf({ clients: 2, subnet: '10.8.0.0/30' }),
      '10.8.0.0/30 has room for 1 peer; 2 are needed.',
    );

    assert.equal(
      await messageOf({ clients: 8, subnet: '10.8.0.0/29' }),
      '10.8.0.0/29 has room for 5 peers; 8 are needed.',
    );

    assert.equal(await messageOf({ clients: 5, subnet: '10.8.0.0/29' }), 'no error');
    assert.equal(await messageOf({ subnet: '10.0.0.0/8' }), 'no error');
    assert.equal(await messageOf({ subnet: '10.0.0.0/7' }), prefix);
    assert.equal(await messageOf({ subnet: '10.8.0.0/31' }), prefix);

    assert.equal(
      await messageOf({ subnet: '10.8.0.1/24' }),
      'Use the network address 10.8.0.0/24.',
    );

    for (const subnet of [
      '10.8.0.0',
      '10.8.0/24',
      '999.8.0.0/24',
      '10.8.0.0/24/1',
      '',
      '10.8.0.0/ 24',
    ])
      assert.equal(await messageOf({ subnet }), shape, subnet);
  });

  it('checks the IPv6 subnet', async () => {
    const shape = 'IPv6 subnet must be a prefix such as fd00:8::/64.';
    const prefix = 'IPv6 subnet prefix must be from /48 to /120.';

    assert.equal(await messageOf({ subnet6: 'fd00:8::/48' }), 'no error');
    assert.equal(await messageOf({ subnet6: 'fd00:8::/120' }), 'no error');
    assert.equal(await messageOf({ subnet6: 'fd00:8::/47' }), prefix);
    assert.equal(await messageOf({ subnet6: 'fd00:8::/121' }), prefix);

    assert.equal(
      await messageOf({ subnet6: 'fd00:8::5/64' }),
      'Use the network address fd00:8::/64.',
    );

    for (const subnet6 of [
      'fd00:8::',
      'fd00:8::%eth0/64',
      'zz::/64',
      '[fd00:8::]/64',
      'fd00:8::/6x',
    ])
      assert.equal(await messageOf({ subnet6 }), shape, subnet6);
  });

  it('checks custom AllowedIPs at and past 64 entries', async () => {
    const list = (count: number) =>
      Array.from({ length: count }, (_, index) => `10.${index}.0.0/16`).join('\n');
    const custom = { clientAllowedIps: 'custom' } as const;

    assert.equal(await messageOf({ ...custom, customAllowedIps: list(64) }), 'no error');

    assert.equal(
      await messageOf({ ...custom, customAllowedIps: list(65) }),
      'Custom AllowedIPs is limited to 64 entries.',
    );

    assert.equal(
      await messageOf({ ...custom, customAllowedIps: '\n \n' }),
      'Custom AllowedIPs needs at least one CIDR.',
    );

    for (const entry of ['10.0.0.1-10.0.0.9', '10.0.0.1', '# 10.0.0.0/8', '10.0.0.0/8 x'])
      assert.equal(
        await messageOf({ ...custom, customAllowedIps: `10.1.0.0/16\n${entry}` }),
        'Custom AllowedIPs line 2 must be a CIDR such as 192.168.1.0/24.',
        entry,
      );
  });

  it('ignores custom AllowedIPs unless they are selected', async () => {
    assert.equal(await messageOf({ customAllowedIps: 'garbage' }), 'no error');
  });

  it('checks DNS servers at and past four', async () => {
    assert.equal(await messageOf({ dns: '1.1.1.1, 1.0.0.1,8.8.8.8, 2606:4700::1111' }), 'no error');

    assert.equal(
      await messageOf({ dns: '1.1.1.1, 1.0.0.1, 8.8.8.8, 8.8.4.4, 9.9.9.9' }),
      'DNS is limited to 4 servers.',
    );

    assert.equal(
      await messageOf({ dns: '1.1.1.1, dns.example.com' }),
      'DNS server "dns.example.com" must be an IPv4 or IPv6 address.',
    );

    assert.equal(
      await messageOf({ dns: 'fe80::1%eth0' }),
      'DNS server "fe80::1%eth0" must be an IPv4 or IPv6 address.',
    );
  });

  it('checks PersistentKeepalive at and past its limits', async () => {
    const message = 'PersistentKeepalive must be a whole number from 0 to 65,535.';

    assert.equal(await messageOf({ keepalive: 0 }), 'no error');
    assert.equal(await messageOf({ keepalive: 65_535 }), 'no error');
    assert.equal(await messageOf({ keepalive: 65_536 }), message);
    assert.equal(await messageOf({ keepalive: -1 }), message);
  });

  it('checks the NAT interface at and past 15 characters', async () => {
    const message = 'NAT interface must be 1-15 letters, digits, "_", "." or "-".';

    assert.equal(await messageOf({ natInterface: 'a'.repeat(15) }), 'no error');
    assert.equal(await messageOf({ natInterface: 'a'.repeat(16) }), message);
    assert.equal(await messageOf({ natInterface: 'eth 0' }), message);
    assert.equal(await messageOf({ natInterface: 'eth0;reboot' }), message);
  });
});
