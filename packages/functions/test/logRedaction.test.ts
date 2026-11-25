import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { redactLogText } from '../src/logs/redaction';

const redact = (text: string, names = ''): string => redactLogText(text, names).text;

function assertRedacted(cases: Array<[source: string, expected: string]>): void {
  for (const [source, expected] of cases) assert.equal(redact(source), expected, source);
}

describe('redactLogText value forms', () => {
  it('masks JSON embedded in a string at any escape depth', () => {
    assertRedacted([
      [
        '{\\"password\\":\\"hunter2\\",\\"user\\":\\"ada\\"}',
        '{\\"password\\":\\"<redacted>\\",\\"user\\":\\"ada\\"}',
      ],
      ['"{\\"token\\":\\"abc123\\"}"', '"{\\"token\\":\\"<redacted>\\"}"'],
      [
        '{\\\\\\"token\\\\\\":\\\\\\"abc123\\\\\\",\\\\\\"user\\\\\\":\\\\\\"ada\\\\\\"}',
        '{\\\\\\"token\\\\\\":\\\\\\"<redacted>\\\\\\",\\\\\\"user\\\\\\":\\\\\\"ada\\\\\\"}',
      ],
      [
        '{\\"token\\":\\"ab\\\\\\"cd\\",\\"user\\":\\"ada\\"}',
        '{\\"token\\":\\"<redacted>\\",\\"user\\":\\"ada\\"}',
      ],
      ['{\\"clientSecret\\":\\"abc123\\"}', '{\\"clientSecret\\":\\"<redacted>\\"}'],
    ]);
  });

  it('masks single-quoted keys and values', () => {
    assertRedacted([
      ["{'password': 'hunter2', 'user': 'ada'}", "{'password': '<redacted>', 'user': 'ada'}"],
      ["{'api_key': 'abc123'}", "{'api_key': '<redacted>'}"],
      ["'Authorization': 'Bearer abc123'", "'Authorization': '<redacted>'"],
      ["{'password': 'it\\'s secret', 'user': 'ada'}", "{'password': '<redacted>', 'user': 'ada'}"],
      ["{'clientSecret': \"abc def\", 'user': 1}", "{'clientSecret': \"<redacted>\", 'user': 1}"],
      ["'password' => 'hunter2'", "'password' => '<redacted>'"],
    ]);
  });

  it('masks non-string JSON values whole, across lines', () => {
    assertRedacted([
      ['{"password": 12345678}', '{"password": <redacted>}'],
      ['{"token":12345,"user":"ada"}', '{"token":<redacted>,"user":"ada"}'],
      ['{"token":true,"user":"ada"}', '{"token":<redacted>,"user":"ada"}'],
      ['{"token":["abc123"]}', '{"token":<redacted>}'],
      ['{"token":["a]b","c"],"user":"ada"}', '{"token":<redacted>,"user":"ada"}'],
      [
        '{"password":{"value":"x}y","n":{"m":1}},"user":"ada"}',
        '{"password":<redacted>,"user":"ada"}',
      ],
      [
        '{"token": [\n  "abc123",\n  "def456"\n],\n"user": "ada"}',
        '{"token": <redacted>,\n"user": "ada"}',
      ],
      [
        '{\\"token\\":[\\"a]b\\"],\\"user\\":\\"ada\\"}',
        '{\\"token\\":<redacted>,\\"user\\":\\"ada\\"}',
      ],
      ["{'token': ['a]b'], 'user': 'ada'}", "{'token': <redacted>, 'user': 'ada'}"],
    ]);
  });

  it('never keeps part of a quoted or unquoted value', () => {
    assertRedacted([
      ['password="ab\\"cd"', 'password=<redacted>'],
      ["password='it\\'s secret'", 'password=<redacted>'],
      ["password='it''s secret'", 'password=<redacted>'],
      ['password=abc,def', 'password=<redacted>'],
      ['password=abc;def', 'password=<redacted>'],
      ['password=abc&def', 'password=<redacted>'],
      ['password="abc"def more', 'password=<redacted> more'],
      ['password => hunter2', 'password => <redacted>'],
      ['password=[abc def]', 'password=<redacted>'],
      ['password=`abc def`', 'password=<redacted>'],
      ['password="two\nlines" next', 'password=<redacted> next'],
    ]);
  });

  it('masks everything after a value that never ends', () => {
    assertRedacted([
      ['password="abc def\nnext line', 'password=<redacted>'],
      ['{"token":"abc def', '{"token":"<redacted>"'],
      ['{"token":["abc def\nnext line', '{"token":<redacted>'],
    ]);
  });

  it('masks PascalCase keys', () => {
    assertRedacted([
      ['ClientSecret=abc123', 'ClientSecret=<redacted>'],
      ['"ClientSecret":"abc123"', '"ClientSecret":"<redacted>"'],
      ['UserPassword: abc123', 'UserPassword: <redacted>'],
      ['GET /cb?RefreshToken=abc&page=1', 'GET /cb?RefreshToken=<redacted>&page=1'],
    ]);

    for (const unchanged of ['MaxTokens=10', 'SortKey=name', 'TokenType=Bearer']) {
      assert.equal(redact(unchanged), unchanged, unchanged);
    }
  });

  it('masks URL credentials', () => {
    assertRedacted([
      [
        'postgres://admin:hunter2@db.example.com/app',
        'postgres://admin:<redacted>@db.example.com/app',
      ],
      ['https://user:pa55@host/x', 'https://user:<redacted>@host/x'],
      ['mysql://root:12345@db:3306/app', 'mysql://root:<redacted>@db:3306/app'],
      ['redis://:hunter2@cache:6379', 'redis://:<redacted>@cache:6379'],
      ['postgres://admin:p@ss/w:rd@db/app', 'postgres://admin:<redacted>@db/app'],
      ['https://ghp_abc123@github.com/org/repo', 'https://<redacted>@github.com/org/repo'],
      ['{"url":"https://u:p@h/x","n":1}', '{"url":"https://u:<redacted>@h/x","n":1}'],
    ]);

    for (const unchanged of [
      'https://example.com/a',
      'https://registry.test:4873/@scope/pkg',
      'https://example.com/@user',
      'https://example.com/a:b@c',
    ]) {
      assert.equal(redact(unchanged), unchanged, unchanged);
    }
  });

  it('masks standalone Bearer tokens and curl credentials', () => {
    assertRedacted([
      ['Bearer abc.def.ghi', 'Bearer <redacted>'],
      ['sent bearer abc,def to host', 'sent bearer <redacted> to host'],
      ['{"value":"Bearer abc","n":1}', '{"value":"Bearer <redacted>","n":1}'],
      ['curl -u admin:hunter2 https://x.test', 'curl -u admin:<redacted> https://x.test'],
      ['curl -uadmin:hunter2 https://x.test', 'curl -uadmin:<redacted> https://x.test'],
      ['curl --user admin:hunter2', 'curl --user admin:<redacted>'],
      ['curl --user=admin:hunter2', 'curl --user=admin:<redacted>'],
      ['curl -u "admin:two words" x.test', 'curl -u "admin:<redacted> x.test'],
      ["curl -u 'admin:two words' x.test", "curl -u 'admin:<redacted> x.test"],
    ]);

    for (const unchanged of ['sudo -u admin ls', 'ps -u root', 'not-u a:b']) {
      assert.equal(redact(unchanged), unchanged, unchanged);
    }
  });

  it('masks every part of a JWT-shaped token', () => {
    assertRedacted([
      ['eyJhbGciOiJSUzI1.aaaa.bbbb', '<redacted-jwt>'],
      ['eyJhbGciOiJSUzI1.aaaa.bbbb.cccc.dddd next', '<redacted-jwt> next'],
      ['eyJhbGciOiJkaXIi..bbbb.cccc.dddd', '<redacted-jwt>'],
      ['eyJhbGciOiJub25l.aaaa. next', '<redacted-jwt> next'],
    ]);
  });

  it('keeps the rest of the line and counts each value once', () => {
    const report = redactLogText('GET /v1?api_key=abc&page=1 {"token":"x","user":"ada"} done');

    assert.equal(
      report.text,
      'GET /v1?api_key=<redacted>&page=1 {"token":"<redacted>","user":"ada"} done',
    );

    assert.equal(report.redactions, 2);
    assert.equal(redactLogText('password=<redacted>').redactions, 0);
    assert.equal(redact('secret: abc\nuser: ada\n'), 'secret: <redacted>\nuser: ada\n');
  });

  it('scans long hostile input in linear time', () => {
    const started = performance.now();

    for (const unit of ['://a:', 'token=["', "'", 'a.', '\\"', '-u "a', 'Bearer ']) {
      redact(unit.repeat(1_000_000 / unit.length));
    }

    assert.ok(performance.now() - started < 3000);
  });
});

describe('redactLogText long flags', () => {
  it('masks the whole value after a space or =', () => {
    for (const [input, expected] of [
      ['mysql --password hunter2 --user=ada', 'mysql --password <redacted> --user=ada'],
      ['mysql --password=hunter2', 'mysql --password=<redacted>'],
      ['x --passwd hunter2', 'x --passwd <redacted>'],
      ['x --pass=hunter2', 'x --pass=<redacted>'],
      ['x --pass hunter2', 'x --pass <redacted>'],
      ['x --pass   hunter2 y', 'x --pass   <redacted> y'],
      ['x --token abc', 'x --token <redacted>'],
      ['x --api-key abc', 'x --api-key <redacted>'],
      ['x --api_key=abc', 'x --api_key=<redacted>'],
      ['x --secret abc', 'x --secret <redacted>'],
      ['x --db-password abc', 'x --db-password <redacted>'],
      ['x --PASSWORD abc', 'x --PASSWORD <redacted>'],
      ['x --password "hunter 2" y', 'x --password <redacted> y'],
      ["x --password 'hunter 2' y", 'x --password <redacted> y'],
    ])
      assert.equal(redact(input ?? ''), expected);
  });

  it('leaves other flags and ordinary words alone', () => {
    for (const input of [
      '--password-file path',
      '--token-file=path',
      '--no-password foo',
      '--password --verbose',
      '--password   --verbose',
      '--password',
      '--password\nnext',
      'compass=north',
      'Compass=north',
      'COMPASS: north',
      'bypass=1',
      'pass=3',
      'pass: 12, fail: 3',
      '--compass north',
      '-phunter2',
      '-p hunter2',
    ])
      assert.equal(redact(input), input);
  });
});

describe('redactLogText new key names', () => {
  it('masks pwd, passphrase and *_PASS in each key style', () => {
    for (const [input, expected] of [
      ['pwd=abc', 'pwd=<redacted>'],
      ['pwd=home/x', 'pwd=<redacted>'],
      ['PWD=.', 'PWD=<redacted>'],
      ['PWD=C:x', 'PWD=<redacted>'],
      ['db_pwd=/home/x', 'db_pwd=<redacted>'],
      ['db.pwd=/home/x', 'db.pwd=<redacted>'],
      ['--pwd /home/x', '--pwd <redacted>'],
      ['userPwd=/home/x', 'userPwd=<redacted>'],
      ['GET /x?db_pwd=/home/x', 'GET /x?db_pwd=<redacted>'],
      ['PWD: abc', 'PWD: <redacted>'],
      ['passphrase=a,b', 'passphrase=<redacted>'],
      ['DB_PASS=abc', 'DB_PASS=<redacted>'],
      ['smtp_pass: abc', 'smtp_pass: <redacted>'],
      ['{"db_pass":"abc","u":1}', '{"db_pass":"<redacted>","u":1}'],
      ["{'pwd': 'abc'}", "{'pwd': '<redacted>'}"],
      ['{\\"passphrase\\":\\"abc\\"}', '{\\"passphrase\\":\\"<redacted>\\"}'],
      ['GET /x?pwd=abc&db_pass=def&a=1', 'GET /x?pwd=<redacted>&db_pass=<redacted>&a=1'],
      ['userPwd=abc', 'userPwd=<redacted>'],
      ['dbPass=abc', 'dbPass=<redacted>'],
      ['KeyPassphrase=abc', 'KeyPassphrase=<redacted>'],
    ])
      assert.equal(redact(input ?? ''), expected);
  });
});

describe('redactLogText working directory', () => {
  it('leaves a bare pwd alone when its value is clearly a path', () => {
    for (const input of [
      'PWD=/home/x',
      'pwd: /home/x',
      'export PWD=/home/x',
      'PWD=~/work',
      'PWD=C:\\\\Users\\\\x',
      'PWD=c:/users/x',
      'PWD="/home/x"',
      '{"PWD":"/home/x","u":1}',
      "{'pwd': '~/x'}",
      '{\\"PWD\\":\\"/home/x\\"}',
      'GET /x?pwd=/home/x',
      'OLDPWD=/home/y',
    ])
      assert.equal(redact(input), input);
  });

  it('still masks what follows it', () => {
    assert.equal(redact('PWD=/home/x password=abc'), 'PWD=/home/x password=<redacted>');
  });
});

describe('redactLogText PEM blocks', () => {
  const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC\nBKcwggSjAgEAAoIBAQC7';

  it('masks whole private key blocks of each label', () => {
    for (const label of [
      'PRIVATE KEY',
      'RSA PRIVATE KEY',
      'EC PRIVATE KEY',
      'OPENSSH PRIVATE KEY',
      'ENCRYPTED PRIVATE KEY',
      'PGP PRIVATE KEY BLOCK',
    ]) {
      const report = redactLogText(
        `before\n-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\nafter`,
      );

      assert.equal(report.text, 'before\n<redacted-private-key>\nafter', label);
      assert.equal(report.warning, undefined);
    }
  });

  it('masks a block with literal \\n line breaks inside a JSON string', () => {
    const text = redact(
      '{"key":"-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----\\n","u":1}',
    );

    assert.doesNotMatch(text, /MIIE|BEGIN/);
    assert.match(text, /"u":1/);
  });

  it('masks several blocks without taking the text between them', () => {
    const block = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;

    assert.equal(
      redact(`${block}\nkeep\n${block}`),
      '<redacted-private-key>\nkeep\n<redacted-private-key>',
    );
  });

  it('masks an unterminated block to the end and warns with its line', () => {
    const report = redactLogText(`a\nb\n-----BEGIN RSA PRIVATE KEY-----\n${body}\nmore`);

    assert.equal(report.text, 'a\nb\n<redacted-private-key>');
    assert.match(report.warning ?? '', /on line 3 never closes/);
  });

  it('leaves certificates and public keys visible', () => {
    for (const label of ['CERTIFICATE', 'PUBLIC KEY', 'CERTIFICATE REQUEST']) {
      const block = `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;

      assert.equal(redact(block), block);
    }
  });
});

describe('redactLogText open-ended warnings', () => {
  it('names the line of an unterminated quote or bracket', () => {
    for (const [input, line] of [
      ['ok\nok\npassword="abc\nmore\nmore', 3],
      ["token='abc", 1],
      ['a\n{"token":"abc\nmore', 2],
      ['a\nb\nc\ntoken=[1,2\nmore', 4],
      ['a\ntoken={"a":"b\n}', 2],
      ['a\nclientSecret="abc\nmore', 2],
      ['a\nb\n--password "abc\nmore', 3],
      ['a\ncurl -u "admin:abc\nmore', 2],
    ] as const) {
      const report = redactLogText(input);

      assert.match(report.warning ?? '', new RegExp(`on line ${line} never closes`), input);
      assert.doesNotMatch(report.text, /abc|more/, input);
    }
  });

  it('counts the lines a mask swallowed before the start', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nAAAA\nBBBB\n-----END PRIVATE KEY-----';

    assert.match(
      redactLogText(`a\n${pem}\nb\npassword="abc`).warning ?? '',
      /on line 7 never closes/,
    );

    assert.match(
      redactLogText('token="a\nb"\nc\nclientSecret="abc').warning ?? '',
      /on line 4 never closes/,
    );
  });

  it('takes the earliest start and CRLF counts one line', () => {
    assert.match(
      redactLogText('a\r\npassword="abc\r\n-----BEGIN PRIVATE KEY-----\r\nAAAA').warning ?? '',
      /on line 2 never closes/,
    );
  });

  it('stays quiet when everything closes', () => {
    for (const input of [
      'password="abc" user=ada',
      'token=[1,2] x',
      '-u "admin:abc" x',
      '-u admin:abc x',
      'password=abc"',
    ])
      assert.equal(redactLogText(input).warning, undefined, input);
  });
});
