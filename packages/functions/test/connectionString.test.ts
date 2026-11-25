import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildConnectionString, parseConnectionString } from '@devtoolora/functions/web';

describe('connection strings', () => {
  it('parses the supported schemes', () => {
    const pg = parseConnectionString(
      'postgres://app:s3cr%40t@db.example.com:5433/appdb?sslmode=require',
    );

    assert.deepEqual(pg, {
      database: 'appdb',
      dialect: 'postgres',
      findings: [
        {
          level: 'info',
          message:
            'The URL carries credentials; prefer an environment variable or a secrets store.',
        },
      ],
      hosts: [{ defaultPort: false, host: 'db.example.com', port: 5433 }],
      options: { sslmode: 'require' },
      password: 's3cr@t',
      scheme: 'postgres',
      tls: true,
      username: 'app',
    });

    const jdbc = parseConnectionString('jdbc:postgresql://localhost/app');

    assert.deepEqual(jdbc.hosts, [{ defaultPort: true, host: 'localhost', port: 5432 }]);
    assert.equal(jdbc.tls, false);
    assert.equal(jdbc.findings[0]?.level, 'medium');

    assert.equal(
      parseConnectionString('mongodb+srv://u:p@cluster0.example.net/app?retryWrites=true').tls,
      true,
    );

    assert.equal(
      parseConnectionString('mongodb://a.example:27017,b.example:27018/app?replicaSet=rs0').hosts
        .length,
      2,
    );

    const redis = parseConnectionString('rediss://:pw@cache.example:6380/2');

    assert.deepEqual(
      [redis.dialect, redis.username, redis.password, redis.database, redis.tls],
      ['redis', undefined, 'pw', '2', true],
    );

    assert.equal(parseConnectionString('mysql://u@h/db?ssl-mode=REQUIRED').tls, true);
  });

  it('rejects malformed strings', () => {
    assert.throws(
      () => parseConnectionString('mongodb+srv://h.example:27017/x'),
      /mongodb\+srv does not allow a port\./,
    );

    assert.throws(
      () => parseConnectionString('postgres://u:p@ss@h/db'),
      /Percent-encode "@" and "\/" in the password\./,
    );

    assert.throws(
      () => parseConnectionString('sqlite:///x.db'),
      /Supported schemes: postgres, postgresql, jdbc:postgresql, mysql, jdbc:mysql, mongodb, mongodb\+srv, redis, rediss\./,
    );

    assert.throws(() => parseConnectionString('nope'), /Supported schemes:/);
    assert.throws(() => parseConnectionString(''), /Connection string input is required\./);

    assert.throws(
      () => parseConnectionString(`postgres://h/${'a'.repeat(8_192)}`),
      /Connection string input exceeds 8,192 characters\./,
    );
  });

  it('does not treat user input as object keys', () => {
    assert.throws(() => parseConnectionString('constructor://h/db'), /Supported schemes:/);
    assert.throws(() => parseConnectionString('__proto__://h/db'), /Supported schemes:/);

    const report = parseConnectionString('postgres://h/db?__proto__=x');

    assert.deepEqual(Object.keys(report.options), ['__proto__']);
    assert.equal(parseConnectionString('jdbc:postgresql://h/db?ssl=true').tls, true);

    assert.throws(
      () => parseConnectionString('postgres://h/db?a=%E0%A4%A'),
      /Option "a" is not valid percent-encoding\./,
    );

    assert.throws(
      () => parseConnectionString('postgres://u:%E0%A4%A@h/db'),
      /Credentials are not valid percent-encoding\./,
    );
  });

  it('builds strings per dialect', () => {
    const pg = buildConnectionString({
      database: 'appdb',
      dialect: 'postgres',
      host: 'db.example.com',
      password: 's3cr@t',
      tls: true,
      username: 'app',
    });

    assert.equal(pg.uri, 'postgresql://app:s3cr%40t@db.example.com:5432/appdb?sslmode=require');

    assert.equal(
      pg.jdbc,
      'jdbc:postgresql://db.example.com:5432/appdb?user=app&password=s3cr%40t&sslmode=require',
    );

    assert.equal(
      pg.env,
      'DATABASE_URL="postgresql://app:s3cr%40t@db.example.com:5432/appdb?sslmode=require"',
    );

    assert.equal(
      buildConnectionString({ dialect: 'mysql', host: 'h', tls: true }).uri,
      'mysql://h:3306?ssl-mode=REQUIRED',
    );

    assert.equal(
      buildConnectionString({
        database: 'app',
        dialect: 'mongodb',
        host: 'h',
        options: 'retryWrites=true\nw=majority',
        tls: true,
      }).uri,
      'mongodb://h:27017/app?tls=true&retryWrites=true&w=majority',
    );

    assert.equal(
      buildConnectionString({
        database: '2',
        dialect: 'redis',
        host: 'h',
        password: 'pw',
        tls: true,
      }).env,
      'REDIS_URL="rediss://:pw@h:6379/2"',
    );

    assert.equal(
      buildConnectionString({ dialect: 'mongodb', host: 'h' }).env.split('=')[0],
      'MONGODB_URI',
    );

    assert.throws(
      () => buildConnectionString({ dialect: 'postgres', host: ' ' }),
      /Host is required\./,
    );

    assert.throws(
      () => buildConnectionString({ dialect: 'postgres', host: 'h', port: 'x' }),
      /Port must be a whole number from 1 to 65535\./,
    );

    assert.throws(
      () => buildConnectionString({ dialect: 'oracle', host: 'h' }),
      /Dialect must be postgres, mysql, mongodb or redis\./,
    );

    assert.throws(
      () => buildConnectionString({ dialect: 'postgres', host: 'h', options: 'novalue' }),
      /Option line 1 must be key=value\./,
    );
  });

  it('rejects hosts with reserved characters', () => {
    assert.throws(
      () => buildConnectionString({ dialect: 'postgres', host: 'db/x' }),
      /Host must not contain "\/", "\?", "#", "@", "," or spaces\./,
    );
  });
});

describe('connection string TLS reporting', () => {
  const finding = (input: string) => parseConnectionString(input).findings.map((f) => f.message);

  it('does not report modes that can fall back to plaintext as encrypted', () => {
    for (const input of [
      'postgres://h/db?sslmode=allow',
      'postgres://h/db?sslmode=prefer',
      'postgres://h/db?sslmode=PREFER',
      'mysql://h/db?ssl-mode=PREFERRED',
      'jdbc:mysql://h/db?sslMode=PREFERRED',
    ]) {
      const report = parseConnectionString(input);

      assert.equal(report.tls, false, input);
      assert.equal(report.tlsOptional, true, input);
      assert.equal(report.findings[0]?.level, 'medium', input);
      assert.match(report.findings[0]?.message ?? '', /fall back/, input);
    }
  });

  it('treats modes that require TLS as on and disabling modes as off', () => {
    for (const input of [
      'postgres://h/db?sslmode=require',
      'postgres://h/db?sslmode=verify-ca',
      'postgres://h/db?sslmode=verify-full',
      'mysql://h/db?ssl-mode=REQUIRED',
      'jdbc:mysql://h/db?sslMode=REQUIRED',
      'jdbc:mysql://h/db?sslMode=VERIFY_IDENTITY',
    ])
      assert.equal(parseConnectionString(input).tls, true, input);

    for (const input of [
      'postgres://h/db?sslmode=disable',
      'jdbc:mysql://h/db?sslMode=DISABLED',
      'mysql://h/db?ssl-mode=DISABLED',
      'mongodb://h/db',
      'redis://h/0',
    ]) {
      const report = parseConnectionString(input);

      assert.equal(report.tls, false, input);
      assert.equal(report.tlsOptional, undefined, input);
      assert.deepEqual(finding(input), ['TLS is off; the connection is unencrypted.'], input);
    }
  });

  it('describes the libpq default instead of calling it off', () => {
    const report = parseConnectionString('postgres://h/db');

    assert.equal(report.tls, false);
    assert.equal(report.tlsOptional, true);
    assert.match(report.findings[0]?.message ?? '', /defaults to prefer/);
  });
});

describe('connection string building', () => {
  it('uses the Connector/J property in the JDBC form', () => {
    const built = buildConnectionString({ dialect: 'mysql', host: 'h', tls: true });

    assert.equal(built.uri, 'mysql://h:3306?ssl-mode=REQUIRED');
    assert.equal(built.jdbc, 'jdbc:mysql://h:3306?sslMode=REQUIRED');
    assert.equal(parseConnectionString(built.jdbc ?? '').tls, true);
  });

  it('encodes the database and options so they survive a round trip', () => {
    const built = buildConnectionString({
      database: 'a/b?c#d e',
      dialect: 'postgres',
      host: 'h',
      options: 'c d=e f&g\napplication_name=a=b',
    });
    const parsed = parseConnectionString(built.uri);

    assert.equal(parsed.database, 'a/b?c#d e');
    assert.deepEqual(parsed.options, { 'c d': 'e f&g', application_name: 'a=b' });
    assert.deepEqual(parseConnectionString(built.jdbc ?? '').options, parsed.options);
  });

  it('brackets an IPv6 host', () => {
    const built = buildConnectionString({ dialect: 'postgres', host: '::1' });

    assert.equal(built.uri, 'postgresql://[::1]:5432');

    assert.deepEqual(parseConnectionString(built.uri).hosts[0], {
      defaultPort: true,
      host: '[::1]',
      port: 5432,
    });

    assert.equal(
      buildConnectionString({ dialect: 'postgres', host: '[::1]' }).uri,
      'postgresql://[::1]:5432',
    );
  });

  it('reads the TLS option from the extra options too', () => {
    const built = buildConnectionString({
      dialect: 'postgres',
      host: 'h',
      options: 'sslmode=verify-full',
    });

    assert.deepEqual(built.findings, []);
  });
});

describe('connection string shape findings', () => {
  it('flags an SRV URL with several hosts and a non-numeric Redis database', () => {
    assert.match(
      parseConnectionString('mongodb+srv://a,b/db').findings[0]?.message ?? '',
      /exactly one host/,
    );

    assert.match(
      parseConnectionString('rediss://h/abc').findings[0]?.message ?? '',
      /Redis database/,
    );

    assert.deepEqual(parseConnectionString('rediss://h/2').findings, []);
  });
});
