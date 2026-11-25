import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import { buildSystemdUnit, type SystemdUnitOptions } from '../src/dev';

const base: SystemdUnitOptions = {
  description: 'My app',
  environment: '',
  environmentFile: '',
  execStart: '/usr/bin/node /srv/myapp/server.js',
  group: '',
  hardening: true,
  networkOnline: true,
  restart: 'on-failure',
  restartSec: 5,
  scope: 'system',
  type: 'simple',
  unitName: 'myapp',
  user: '',
  workingDirectory: '',
};

const build = (extra: Partial<SystemdUnitOptions>) => buildSystemdUnit({ ...base, ...extra });

const message = (extra: Partial<SystemdUnitOptions>): string => {
  try {
    build(extra);
  } catch (error) {
    assert.ok(error instanceof FunctionError);

    return error.message;
  }

  return 'no error';
};

const specVector = `[Unit]
Description=My app
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=myapp
WorkingDirectory=/srv/myapp
Environment="NODE_ENV=production"
Environment="PORT=8080"
ExecStart=/usr/bin/node /srv/myapp/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full

[Install]
WantedBy=multi-user.target
`;

const userVector = `[Unit]
Description=50%% CPU job

[Service]
Type=simple
ExecStart=/usr/bin/env -S python3 -m http.server 8000
Restart=no

[Install]
WantedBy=default.target
`;

function readEnvironment(line: string): string {
  const match = /^Environment="(.*)"$/.exec(line);

  assert.ok(match, line);
  let out = '';
  const body = match[1] ?? '';

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index] ?? '';

    assert.notEqual(char === '"', true, `unescaped quote in ${line}`);
    if (char === '\\') index += 1;

    out += char === '\\' ? (body[index] ?? '') : char;
  }

  return out.replaceAll('%%', '%');
}

describe('systemd unit builder', () => {
  it('writes the spec vector', () => {
    const unit = build({
      environment: 'NODE_ENV=production\nPORT=8080',
      user: 'myapp',
      workingDirectory: '/srv/myapp',
    });

    assert.equal(unit.text, specVector);
    assert.equal(unit.fileName, 'myapp.service');
    assert.equal(unit.environmentCount, 2);
    assert.deepEqual(unit.warnings, []);
  });

  it('escapes percent, quotes and backslashes in Environment', () => {
    const { text } = build({ environment: 'GREETING=say "hi" 100% C:\\x' });

    assert.ok(text.includes('Environment="GREETING=say \\"hi\\" 100%% C:\\\\x"\n'));
  });

  it('writes a user unit without User, hardening, RestartSec or network lines', () => {
    const { text } = build({
      description: '50% CPU job',
      execStart: '/usr/bin/env -S python3 -m http.server 8000',
      networkOnline: false,
      restart: 'no',
      scope: 'user',
      user: 'ignored',
    });

    assert.equal(text, userVector);
  });

  it('refuses Restart=always on a oneshot unit, which systemd will not load', () => {
    assert.match(message({ restart: 'always', type: 'oneshot' }), /^Type=oneshot cannot use/);
    assert.equal(message({ restart: 'on-failure', type: 'oneshot' }), 'no error');
    assert.equal(message({ restart: 'always', type: 'simple' }), 'no error');
  });

  it('leaves out network-online.target in the user scope, where it does not exist', () => {
    const { text } = build({ networkOnline: true, scope: 'user' });

    assert.ok(!text.includes('network-online.target'));
  });

  it('round-trips every Environment line through a systemd-style reader', () => {
    const values = [
      'a b',
      '"q"',
      '\\x',
      '%h',
      '100%',
      '$HOME',
      '${X}',
      'a=b=c',
      '#hash',
      '  spaced  ',
      '\\"',
      '%%',
      'C:\\dir\\x',
      '"',
      '=',
      '',
      "it's",
      'tab here',
      '\\\\%"$',
      'ünï',
    ];
    const lines = values.map((value, index) => `K${index}=${value}`);
    const { text } = build({ environment: lines.join('\n') });
    const written = text.split('\n').filter((line) => line.startsWith('Environment='));

    assert.equal(written.length, values.length);
    assert.deepEqual(written.map(readEnvironment), lines);
  });

  it('rejects control characters and continuations in every free-text field', () => {
    const valid: Partial<SystemdUnitOptions> = {
      description: 'd',
      environment: 'A=1',
      environmentFile: '/etc/x',
      execStart: '/bin/x',
      group: 'g',
      unitName: 'n',
      user: 'u',
      workingDirectory: '/srv',
    };
    const labels: Record<string, string> = {
      description: 'Description',
      environment: 'Environment line 1',
      environmentFile: 'EnvironmentFile',
      execStart: 'ExecStart',
      group: 'Group',
      unitName: 'Unit name',
      user: 'User',
      workingDirectory: 'WorkingDirectory',
    };

    for (const [field, label] of Object.entries(labels)) {
      const good = String(valid[field as keyof SystemdUnitOptions]);
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

  it('escapes percent signs in ExecStart, WorkingDirectory and EnvironmentFile', () => {
    const { text } = build({
      environmentFile: '-/etc/100%.env',
      execStart: '/bin/date +%H',
      workingDirectory: '/srv/50%',
    });

    assert.ok(text.includes('ExecStart=/bin/date +%%H\n'));
    assert.ok(text.includes('WorkingDirectory=/srv/50%%\n'));
    assert.ok(text.includes('EnvironmentFile=-/etc/100%%.env\n'));
  });

  it('checks ExecStart', () => {
    assert.equal(
      message({ execStart: 'node app.js' }),
      'ExecStart must start with an absolute path such as /usr/bin/node.',
    );

    assert.equal(message({ execStart: '  ' }), 'ExecStart is required.');

    for (const ok of ['-/usr/bin/true', '!!/usr/bin/id', '@/usr/bin/x x']) {
      assert.equal(message({ execStart: ok }), 'no error', ok);
    }

    for (const ok of ['-@:!!/bin/x', '+/bin/x', '!/bin/x', '@-/bin/x'])
      assert.equal(message({ execStart: ok }), 'no error', ok);

    for (const bad of ['+!/bin/x', '!+/bin/x', '!!!/bin/x', '--/bin/x', '@@/bin/x', '::/bin/x'])
      assert.equal(
        message({ execStart: bad }),
        'ExecStart prefixes @, - and : may each appear once, together with at most one of +, ! or !!.',
        bad,
      );

    assert.equal(message({ execStart: `/bin/x ${'a'.repeat(4_089)}` }), 'no error');

    assert.equal(
      message({ execStart: `/bin/x ${'a'.repeat(4_090)}` }),
      'ExecStart is limited to 4,096 characters.',
    );

    const shellWarning =
      "ExecStart is not run by a shell; wrap pipes and redirects in /bin/sh -c '…'.";

    for (const risky of [
      '/usr/bin/a | b',
      '/usr/bin/a $(b)',
      '/usr/bin/a `b`',
      '/usr/bin/a 2>&1',
    ]) {
      assert.deepEqual(build({ execStart: risky }).warnings, [shellWarning], risky);
    }

    for (const calm of ['/usr/bin/a|b', "/bin/sh -c 'a | b'", '/usr/bin/bash -c "a > b"']) {
      assert.deepEqual(build({ execStart: calm }).warnings, [], calm);
    }
  });

  it('checks names, paths, users and environment', () => {
    assert.equal(
      message({ unitName: 'myapp.service' }),
      'Unit name must not end in .service; it is added for you.',
    );

    assert.equal(
      message({ unitName: 'my@app' }),
      'Template units (with @) are not supported; specifiers such as %i are not expanded.',
    );

    assert.equal(message({ unitName: 'a'.repeat(200) }), 'no error');
    assert.match(message({ unitName: 'a'.repeat(201) }), /^Unit name must be 1-200 characters/);
    assert.match(message({ unitName: '' }), /^Unit name must be 1-200 characters/);
    assert.match(message({ workingDirectory: 'srv/app' }), /^WorkingDirectory must be an absolute/);
    assert.equal(message({ environmentFile: '-/etc/x.env' }), 'no error');
    assert.match(message({ environmentFile: 'etc/x.env' }), /^EnvironmentFile must be an absolute/);
    assert.match(message({ workingDirectory: '-/srv' }), /^WorkingDirectory must be an absolute/);
    assert.match(message({ user: 'Bad' }), /^User must be a name such as myapp/);
    assert.match(message({ group: 'Bad' }), /^Group must be a name such as myapp/);
    assert.equal(message({ user: '4294967294' }), 'no error');
    assert.match(message({ user: '4294967295' }), /^User must be a name/);
    assert.equal(message({ scope: 'user', user: 'Bad' }), 'no error');

    assert.equal(message({ description: 'x'.repeat(200) }), 'no error');

    assert.equal(
      message({ description: 'x'.repeat(201) }),
      'Description is limited to 200 characters.',
    );

    const lines = (count: number) =>
      Array.from({ length: count }, (_, index) => `K${index}=1`).join('\n');

    assert.equal(message({ environment: lines(100) }), 'no error');
    assert.equal(message({ environment: lines(101) }), 'Environment is limited to 100 variables.');

    assert.equal(
      message({ environment: 'PORT=1\nPORT=2' }),
      'Environment variable PORT is set twice.',
    );

    assert.equal(
      message({ environment: 'A=1\n\n1A=2' }),
      'Environment line 3 must be KEY=value with KEY made of letters, digits and _, not starting with a digit.',
    );

    assert.equal(message({ environment: '__proto__=x\nconstructor=y' }), 'no error');
    assert.equal(message({ restartSec: 3_600 }), 'no error');

    assert.equal(
      message({ restartSec: 3_601 }),
      'RestartSec must be a whole number from 0 to 3,600.',
    );

    assert.equal(
      message({ restartSec: 1.5 }),
      'RestartSec must be a whole number from 0 to 3,600.',
    );

    assert.equal(message({ environment: `A=${'x'.repeat(4_094)}` }), 'no error');

    assert.equal(
      message({ environment: `A=${'x'.repeat(4_095)}` }),
      'Environment line 1 is limited to 4,096 characters.',
    );
  });
});
