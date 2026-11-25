import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  formatDotenv,
  inspectDotenv,
  parseDotenv,
  redactDotenv,
} from '@devtoolora/functions/config';
import {
  cleanStackTrace,
  filterLogLines,
  inspectJsonLines,
  redactLogText,
} from '@devtoolora/functions/logs';

describe('config and log functions', () => {
  it('parses, formats, diagnoses, and redacts dotenv documents', () => {
    const document = parseDotenv(' export PORT = 3000\nAPI_TOKEN="secret"\n');

    assert.equal(formatDotenv(document), 'export PORT=3000\nAPI_TOKEN="secret"\n');
    assert.equal(redactDotenv(document), 'export PORT=3000\nAPI_TOKEN=<redacted>\n');
    assert.equal(inspectDotenv('A=1\nA=2').diagnostics.length, 1);
  });

  it('inspects, filters, redacts, and cleans logs', () => {
    assert.match(inspectJsonLines('{"level":"info"}\nnot json'), /Malformed: 1/);
    assert.equal(filterLogLines('INFO ok\nERROR failed', 'error', '', 'i'), 'ERROR failed');
    assert.equal(redactLogText('password=secret').text, 'password=<redacted>');
    assert.match(cleanStackTrace('TypeError: failed\n    at run (/src/app.ts:1:2)'), /Frames: 1/);
  });

  it('redacts camelCase keys that end in a sensitive name and counts each value once', () => {
    const report = redactLogText(
      'clientSecret=abc refreshToken: xyz {"csrfToken": "c1", "accessToken": "t1", "tokenType": "Bearer"} /cb?refreshToken=r1&page=2 sortKey=name maxTokens=10',
    );

    assert.equal(
      report.text,
      'clientSecret=<redacted> refreshToken: <redacted> {"csrfToken": "<redacted>", "accessToken": "<redacted>", "tokenType": "Bearer"} /cb?refreshToken=<redacted>&page=2 sortKey=name maxTokens=10',
    );

    assert.equal(report.redactions, 5);
  });

  it('redacts compound sensitive keys in key=value, key: value, JSON and query forms', () => {
    const redact = (text: string, names = ''): string => redactLogText(text, names).text;

    for (const [source, expected] of [
      ['github_token=ghp_abc123', 'github_token=<redacted>'],
      ['user_password=hunter2', 'user_password=<redacted>'],
      ['GITHUB_TOKEN=abc', 'GITHUB_TOKEN=<redacted>'],
      ['api_token="two words"', 'api_token=<redacted>'],
      ['apikey=abc api_key=def', 'apikey=<redacted> api_key=<redacted>'],
      ['SECRET_KEY=abc', 'SECRET_KEY=<redacted>'],
      ['aws.secret_access_key=abc', 'aws.secret_access_key=<redacted>'],
      ['user_password: hunter2', 'user_password: <redacted>'],
      ['X-Api-Key: abc', 'X-Api-Key: <redacted>'],
      ['db.password : hunter2', 'db.password : <redacted>'],
      [
        '{"api_token": "abc", "user_password":"x\\"y", "x-api-key": "k", "user": "ada"}',
        '{"api_token": "<redacted>", "user_password":"<redacted>", "x-api-key": "<redacted>", "user": "ada"}',
      ],
      ['GET /v1?github_token=abc&page=1#top', 'GET /v1?github_token=<redacted>&page=1#top'],
    ])
      assert.equal(redact(source!), expected, source);

    for (const unchanged of [
      'tokenizer=on',
      'password_policy=strict',
      'max_tokens=100',
      'token_count=5',
      'author=ada',
      'secretary=bob',
      '{"token_type": "Bearer"}',
      'GET /v1?password_policy=strict',
    ]) {
      assert.equal(redact(unchanged), unchanged, unchanged);
    }

    assert.equal(
      redact('SENTRY_DSN=https://demo DSN_HOST=x', 'DSN'),
      'SENTRY_DSN=<redacted> DSN_HOST=x',
    );
  });

  it('keeps nameless Node.js frames and Java frames with a file and line number', () => {
    assert.equal(
      cleanStackTrace(
        'Error: demo\n    at /app/server.js:10:5\n    at file:///app/x.mjs:3:1\n    at node:internal/main:1:1\n    at run (/app/a.js:1:2)',
      ),
      '# Stack Trace\n\nException: Error: demo\nFrames: 4\n\n1. at /app/server.js:10:5\n2. at file:///app/x.mjs:3:1\n3. at node:internal/main:1:1\n4. at run (/app/a.js:1:2)',
    );

    assert.match(
      cleanStackTrace('Error: demo\n    at run (/app/a.js:1:2)\nat 10:30:00'),
      /Frames: 1\n\n1\. at run/,
    );

    assert.equal(
      cleanStackTrace(
        'Exception in thread "main" java.lang.IllegalStateException: demo\n\tat com.example.App.run(App.java:42)\n\tat com.example.App.main(App.java:5)\n\tat java.base/jdk.internal.Native.invoke(Native Method)',
      ),
      '# Stack Trace\n\nException: Exception in thread "main" java.lang.IllegalStateException: demo\nFrames: 2\n\n1. at com.example.App.run(App.java:42)\n2. at com.example.App.main(App.java:5)',
    );

    assert.throws(() => cleanStackTrace('Job started\n  at 10:30:00'), /No supported/);
  });

  it('ignores a byte order mark before the first record', () => {
    assert.doesNotMatch(inspectJsonLines('\uFEFF{"a":1}'), /Invalid JSON/);
  });

  it('keeps V8 frames that have no file location', () => {
    assert.equal(
      cleanStackTrace(
        'TypeError: x\n    at Array.map (<anonymous>)\n    at new Promise (<anonymous>)\n    at Promise.all (index 0)\n    at f (/a.js:1:1)\n    at async g (/b.js:2:2)\n    at node:internal/main:1:1\n    at Object.<anonymous> (/c.js:3:3)\n    at <anonymous>',
      ),
      '# Stack Trace\n\nException: TypeError: x\nFrames: 8\n\n1. at Array.map (<anonymous>)\n2. at new Promise (<anonymous>)\n3. at Promise.all (index 0)\n4. at f (/a.js:1:1)\n5. at async g (/b.js:2:2)\n6. at node:internal/main:1:1\n7. at Object.<anonymous> (/c.js:3:3)\n8. at <anonymous>',
    );

    assert.match(
      cleanStackTrace('    at Array.map (<anonymous>)\n    at f (/a.js:1:1)'),
      /Exception: Unknown error\nFrames: 2/,
    );

    assert.throws(() => cleanStackTrace('Waiting at gate (anonymous)'), /No supported/);
  });
});
