import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import { buildSshConfig, type SshConfigOptions } from '../src/dev';
import { isDnsName } from '../src/network';

const base: SshConfigOptions = {
  addKeysToAgent: 'omit',
  forwardAgent: false,
  host: 'prod',
  hostName: '',
  identitiesOnly: true,
  identityFile: '',
  localForward: '',
  port: '',
  proxyJump: '',
  serverAliveInterval: '0',
  strictHostKeyChecking: 'omit',
  useKeychain: false,
  user: '',
};

const build = (extra: Partial<SshConfigOptions>) => buildSshConfig({ ...base, ...extra });

const message = (extra: Partial<SshConfigOptions>): string => {
  try {
    build(extra);
  } catch (error) {
    assert.ok(error instanceof FunctionError);

    return error.message;
  }

  return 'no error';
};

const numbered = (count: number, make: (index: number) => string, join: string): string =>
  Array.from({ length: count }, (_, index) => make(index)).join(join);

describe('isDnsName', () => {
  it('accepts and rejects names', () => {
    const long = [63, 63, 63, 61].map((length) => 'a'.repeat(length)).join('.');

    assert.equal(long.length, 253);

    for (const name of ['example.com', 'a-b.example', long])
      assert.equal(isDnsName(name), true, name);

    for (const name of [
      '-a.com',
      'a-.com',
      'a..b',
      `${long}a`,
      `${'a'.repeat(64)}.com`,
      '1.2.3.4',
      '999.1.1.1',
      'ex ample.com',
    ])
      assert.equal(isDnsName(name), false, name);
  });
});

describe('buildSshConfig', () => {
  it('writes the spec vector', () => {
    const result = build({
      hostName: '203.0.113.10',
      identityFile: '~/.ssh/id_ed25519',
      port: '2222',
      user: 'deploy',
    });

    assert.equal(
      result.text,
      'Host prod\n  HostName 203.0.113.10\n  User deploy\n  Port 2222\n  IdentityFile ~/.ssh/id_ed25519\n  IdentitiesOnly yes\n',
    );

    assert.equal(result.optionCount, 5);
  });

  it('writes every option in the fixed order', () => {
    const result = build({
      addKeysToAgent: 'yes',
      forwardAgent: true,
      host: 'prod prod-*',
      hostName: '2001:db8::10',
      identityFile: '~/My Keys/id_ed25519',
      localForward: '5432 db.internal:5432\n127.0.0.1:8080 [2001:db8::5]:80',
      port: '2222',
      proxyJump: 'jump@bastion.example.com:2200,[2001:db8::1]',
      serverAliveInterval: '60',
      strictHostKeyChecking: 'accept-new',
      useKeychain: true,
      user: 'deploy',
    });

    assert.equal(
      result.text,
      [
        'IgnoreUnknown UseKeychain',
        'Host prod prod-*',
        '  HostName 2001:db8::10',
        '  User deploy',
        '  Port 2222',
        '  IdentityFile "~/My Keys/id_ed25519"',
        '  IdentitiesOnly yes',
        '  ProxyJump jump@bastion.example.com:2200,[2001:db8::1]',
        '  ForwardAgent yes',
        '  AddKeysToAgent yes',
        '  UseKeychain yes',
        '  ServerAliveInterval 60',
        '  StrictHostKeyChecking accept-new',
        '  LocalForward 5432 db.internal:5432',
        '  LocalForward 127.0.0.1:8080 [2001:db8::5]:80',
        '',
      ].join('\n'),
    );

    assert.equal(result.optionCount, 13);
  });

  it('accepts aliases with an underscore and the %i identity token, as ssh does', () => {
    assert.equal(message({ proxyJump: 'my_jump' }), 'no error');
    assert.equal(message({ hostName: 'my_host.local' }), 'no error');
    assert.ok(build({ identityFile: '~/.ssh/%i' }).text.includes('  IdentityFile ~/.ssh/%i\n'));
  });

  it('quotes identity files with spaces', () => {
    assert.ok(
      build({ identityFile: '~/My Keys/id_ed25519' }).text.includes(
        '  IdentityFile "~/My Keys/id_ed25519"\n',
      ),
    );
  });

  it('doubles backslashes in IdentityFile like ssh argv_split expects', () => {
    assert.ok(
      build({ identityFile: 'C:\\k\\\\x' }).text.includes('  IdentityFile C:\\\\k\\\\\\\\x\n'),
    );

    assert.ok(build({ identityFile: "a\\'b" }).text.includes('  IdentityFile "a\\\\\'b"\n'));
  });

  it('omits IdentitiesOnly without a file and strips IPv6 brackets', () => {
    assert.equal(build({ hostName: '[::1]' }).text, 'Host prod\n  HostName ::1\n');
  });

  it('rejects control characters in every free-text field', () => {
    const valid: Partial<SshConfigOptions> = {
      host: 'h',
      hostName: 'example.com',
      identityFile: '~/k',
      localForward: '80 h:80',
      proxyJump: 'jump',
      user: 'u',
    };
    const labels: Record<string, string> = {
      host: 'Host',
      hostName: 'HostName',
      identityFile: 'IdentityFile',
      localForward: 'LocalForward',
      proxyJump: 'ProxyJump',
      user: 'User',
    };

    for (const [field, label] of Object.entries(labels)) {
      const good = String(valid[field as keyof SshConfigOptions]);
      const injected = [
        `a${String.fromCharCode(10)}B=1`,
        `a${String.fromCharCode(13)}B`,
        `a${String.fromCharCode(0x2028)}B`,
        `${good}\\`,
      ];

      for (const value of injected) {
        const text = message({ ...valid, [field]: value });

        assert.ok(text.startsWith(label), `${field}: ${text}`);
        assert.notEqual(text, 'no error', field);
      }
    }
  });

  it('enforces the limits at and past the edge', () => {
    const hosts = (count: number) => numbered(count, (i) => `h${i}`, ' ');
    const hops = (count: number) => numbered(count, (i) => `h${i}`, ',');
    const forwards = (count: number) => numbered(count, (i) => `${i + 1} h:80`, '\n');

    assert.equal(message({ host: hosts(10) }), 'no error');
    assert.equal(message({ host: hosts(11) }), 'Host is limited to 10 patterns.');
    assert.equal(message({ proxyJump: hops(8) }), 'no error');
    assert.equal(message({ proxyJump: hops(9) }), 'ProxyJump is limited to 8 hops.');
    assert.equal(message({ localForward: forwards(10) }), 'no error');
    assert.equal(message({ localForward: forwards(11) }), 'LocalForward is limited to 10 lines.');
    assert.equal(message({ identityFile: 'a'.repeat(1_024) }), 'no error');

    assert.equal(
      message({ identityFile: 'a'.repeat(1_025) }),
      'IdentityFile is limited to 1,024 characters.',
    );

    assert.equal(message({ port: '65535' }), 'no error');
    assert.equal(message({ port: '65536' }), 'Port must be a whole number from 1 to 65,535.');
    assert.equal(message({ serverAliveInterval: '86400' }), 'no error');

    assert.equal(
      message({ serverAliveInterval: '86401' }),
      'ServerAliveInterval must be a whole number from 0 to 86,400.',
    );
  });

  it('rejects unsafe values with named messages', () => {
    assert.equal(message({ host: '' }), 'Host is required.');
    assert.equal(message({ host: '!' }), 'Host pattern "!" needs a name after "!".');

    assert.equal(
      message({ host: 'a/b' }),
      'Host pattern "a/b" may contain only letters, digits, ".", "_", "-", "*", "?" and a leading "!".',
    );

    assert.equal(
      message({ user: 'a b' }),
      'User may contain only letters, digits, ".", "_", "@" and "-", up to 64 characters.',
    );

    assert.equal(message({ proxyJump: 'a,-b' }), 'ProxyJump hop 2 must be [user@]host[:port].');
    assert.equal(message({ proxyJump: '[[::1]]' }), 'ProxyJump hop 1 must be [user@]host[:port].');

    assert.equal(
      message({ localForward: 'bad:x:80 h:80' }),
      'LocalForward line 1 must be [bind:]port host:hostport.',
    );

    assert.equal(
      message({ hostName: '[[::1]]' }),
      'HostName must be a DNS name, an IPv4 address or an IPv6 address.',
    );

    assert.equal(
      message({ hostName: 'fe80::1%eth0' }),
      'HostName must not contain an IPv6 zone; ssh reads % as a token.',
    );

    assert.equal(
      message({ hostName: '999.1.1.1' }),
      'HostName must be a DNS name, an IPv4 address or an IPv6 address.',
    );

    assert.equal(
      message({ identityFile: '${HOME}/k' }),
      'IdentityFile must not contain ${, which ssh expands as an environment variable.',
    );

    assert.equal(
      message({ identityFile: '~/%x' }),
      'IdentityFile may use only the tokens %d, %u, %i, %l, %h, %r and %%.',
    );

    assert.equal(message({ identityFile: '~/%h/%%/k' }), 'no error');
    assert.equal(message({ identityFile: 'a"b' }), 'IdentityFile must not contain a double quote.');
    assert.equal(message({ proxyJump: 'none' }), 'no error');
    assert.equal(message({ proxyJump: 'a,,b' }), 'ProxyJump hop 2 must be [user@]host[:port].');
    assert.equal(message({ hostName: '%h.example.com' }), 'no error');

    assert.equal(
      message({ localForward: '80 h' }),
      'LocalForward line 1 must be [bind:]port host:hostport.',
    );
  });

  it('quotes single quotes and rejects whitespace around addresses', () => {
    assert.ok(
      build({ identityFile: "~/it's_key" }).text.includes('  IdentityFile "~/it\'s_key"\n'),
    );

    assert.equal(
      message({ proxyJump: 'jump@ 10.0.0.1' }),
      'ProxyJump hop 1 must be [user@]host[:port].',
    );

    assert.equal(
      message({ proxyJump: '[ ::1 ]:22' }),
      'ProxyJump hop 1 must be [user@]host[:port].',
    );

    assert.equal(
      message({ localForward: `80 [${String.fromCharCode(0xa0)}::1]:80` }),
      'LocalForward line 1 must be [bind:]port host:hostport.',
    );
  });

  it('splits hops in linear time', () => {
    const start = performance.now();

    assert.notEqual(message({ proxyJump: 'a@'.repeat(50_000) }), 'no error');
    assert.ok(performance.now() - start < 100);
  });
});
