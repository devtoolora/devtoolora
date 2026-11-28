import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { cleanStackTrace, redactLogText } from '@devtoolora/functions/logs';

// Results pinned on the regexes these functions used before their linear rewrites, followed by
// inputs that made those regexes backtrack for seconds.

const outcome = (run: () => unknown): unknown => {
  try {
    return run();
  } catch (error) {
    return {
      error: (error as { code?: string }).code ?? String(error),
      message: (error as Error).message,
    };
  }
};

const long = (unit: string, length = 100_000): string =>
  unit.repeat(Math.ceil(length / unit.length));

async function assertQuick(run: () => unknown): Promise<void> {
  const start = performance.now();

  await run();

  // The old regexes took more than 5 seconds on these inputs; the rewrites take milliseconds.
  assert.ok(performance.now() - start < 500, `took ${Math.round(performance.now() - start)} ms`);
}

describe('log regexes', () => {
  it('keeps stack trace results', () => {
    const cases: Array<[string, unknown]> = [
      [
        'Error: boom\n    at foo (/app/a.js:10:5)\n    at bar (/app/b.js:1:2)\n    at foo (/app/a.js:10:5)',
        '# Stack Trace\n\nException: Error: boom\nFrames: 3\n\n1. at foo (/app/a.js:10:5)\n2. at bar (/app/b.js:1:2)\n3. at foo (/app/a.js:10:5)',
      ],
      [
        'TypeError: x\n    at Array.map (<anonymous>)\n    at Promise.all (index 0)\n    at <anonymous>\n    at /app/server.js:10:5\n    at 10:30:00',
        '# Stack Trace\n\nException: TypeError: x\nFrames: 4\n\n1. at Array.map (<anonymous>)\n2. at Promise.all (index 0)\n3. at <anonymous>\n4. at /app/server.js:10:5',
      ],
      [
        'Traceback (most recent call last):\n  File "a.py", line 3, in <module>\n    main()\n  File "b.py", line 9\nValueError: x',
        '# Stack Trace\n\nException: ValueError: x\nFrames: 2\n\n1. File "a.py", line 3, in <module>\n2. File "b.py", line 9',
      ],
      [
        'at foo (native)',
        '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at foo (native)',
      ],
      [
        'at foo\u2028bar (a.js:1:2)',
        {
          error: 'INVALID_LOG_INPUT',
          message: 'No supported JavaScript, TypeScript, or Python stack frames found.',
        },
      ],
      [
        '\tat foo (a.js:1:2)   ',
        '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at foo (a.js:1:2)',
      ],
      ['at   x.js:1:2', '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at   x.js:1:2'],
      [
        'at x (a.js:1:2)\r\nat y (b.js:3:4)\rat z (c.js:5:6)',
        '# Stack Trace\n\nException: Unknown error\nFrames: 3\n\n1. at x (a.js:1:2)\n2. at y (b.js:3:4)\n3. at z (c.js:5:6)',
      ],
      [
        'at foo (index 12)',
        '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at foo (index 12)',
      ],
      [
        'at foo (index x)',
        {
          error: 'INVALID_LOG_INPUT',
          message: 'No supported JavaScript, TypeScript, or Python stack frames found.',
        },
      ],
      [
        'at  (native)',
        {
          error: 'INVALID_LOG_INPUT',
          message: 'No supported JavaScript, TypeScript, or Python stack frames found.',
        },
      ],
      [
        'at (native)',
        {
          error: 'INVALID_LOG_INPUT',
          message: 'No supported JavaScript, TypeScript, or Python stack frames found.',
        },
      ],
      [
        'at a (<anonymous>)',
        '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at a (<anonymous>)',
      ],
      [
        'at a b (index 0)',
        '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at a b (index 0)',
      ],
      ['at a:1:1', '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at a:1:1'],
      [
        'at 1:2:3',
        {
          error: 'INVALID_LOG_INPUT',
          message: 'No supported JavaScript, TypeScript, or Python stack frames found.',
        },
      ],
      ['at a1:2:3', '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at a1:2:3'],
      [
        'at async run (file:///app/x.mjs:1:2)',
        '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at async run (file:///app/x.mjs:1:2)',
      ],
      [
        'at new Foo (webpack://app/./src/a.ts?abc:12:3)',
        '# Stack Trace\n\nException: Unknown error\nFrames: 1\n\n1. at new Foo (webpack://app/./src/a.ts?abc:12:3)',
      ],
      [
        'random text',
        {
          error: 'INVALID_LOG_INPUT',
          message: 'No supported JavaScript, TypeScript, or Python stack frames found.',
        },
      ],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => cleanStackTrace(input)),
        expected,
        input,
      );
  });

  it('keeps redaction results', () => {
    const cases: Array<[string, unknown]> = [
      ['password=hunter2', { redactions: 1, text: 'password=<redacted>' }],
      [
        '{"password":"s3cr\\"et","n":1}',
        { redactions: 1, text: '{"password":"<redacted>","n":1}' },
      ],
      ['token: [1,2,{"a":"b"}]', { redactions: 1, text: 'token: <redacted>' }],
      ['secret=(a b) rest', { redactions: 1, text: 'secret=<redacted> rest' }],
      ['pwd=/home/me', { redactions: 0, text: 'pwd=/home/me' }],
      ['pwd="/home"', { redactions: 0, text: 'pwd="/home"' }],
      ['api_key=\\"abc\\"', { redactions: 1, text: 'api_key=<redacted>' }],
      ['{\\"token\\":\\"abc\\"}', { redactions: 1, text: '{\\"token\\":\\"<redacted>\\"}' }],
      ['password=[\\\\"x\\\\"] tail', { redactions: 1, text: 'password=<redacted> tail' }],
      ['"password": 12.5e3, "a": 1', { redactions: 1, text: '"password": <redacted>, "a": 1' }],
      ['"password": true}', { redactions: 1, text: '"password": <redacted>}' }],
      ['password=`cmd` x', { redactions: 1, text: 'password=<redacted> x' }],
      ['cookie: a=b', { redactions: 1, text: 'cookie: <redacted>' }],
      ['heslo password=žluťoučký', { redactions: 1, text: 'heslo password=<redacted>' }],
      [
        'password="abc',
        {
          redactions: 1,
          text: 'password=<redacted>',
          warning:
            'A quote, bracket or private key block on line 1 never closes, so everything after it is masked.',
        },
      ],
      [
        'token={"a":[1,2',
        {
          redactions: 1,
          text: 'token=<redacted>',
          warning:
            'A quote, bracket or private key block on line 1 never closes, so everything after it is masked.',
        },
      ],
      ['secret=[a, "b]", c] x', { redactions: 1, text: 'secret=<redacted> x' }],
      [
        'password=(\\\\\\"x)',
        {
          redactions: 1,
          text: 'password=<redacted>',
          warning:
            'A quote, bracket or private key block on line 1 never closes, so everything after it is masked.',
        },
      ],
      ['Authorization: Bearer abc.def', { redactions: 1, text: 'Authorization: <redacted>' }],
      ['https://user:pa@ss@host/x', { redactions: 1, text: 'https://user:<redacted>@host/x' }],
      ['curl -u me:pw https://x', { redactions: 1, text: 'curl -u me:<redacted> https://x' }],
      ['--password hunter2 --next', { redactions: 1, text: '--password <redacted> --next' }],
      ['clientSecret=abc', { redactions: 1, text: 'clientSecret=<redacted>' }],
      ['token={"k":"\\\\"}', { redactions: 1, text: 'token=<redacted>' }],
      ["password='it''s' x", { redactions: 1, text: 'password=<redacted> x' }],
      ['pwd=C:\\Users\\me', { redactions: 0, text: 'pwd=C:\\Users\\me' }],
      ['pwd=\\"/x\\"', { redactions: 0, text: 'pwd=\\"/x\\"' }],
      ['"token": -1.5e-3}', { redactions: 1, text: '"token": <redacted>}' }],
      ['"token": 1e5x', { redactions: 1, text: '"token": <redacted>' }],
      ['session=abc;def', { redactions: 1, text: 'session=<redacted>' }],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => redactLogText(input)),
        expected,
        input,
      );
  });

  it('stays linear on long frame and secret lookalikes', async () => {
    await assertQuick(() => outcome(() => cleanStackTrace(`at a(${long('!(')}`)));
    await assertQuick(() => outcome(() => cleanStackTrace(`at ${long('  ')}x`)));
    await assertQuick(() => outcome(() => cleanStackTrace(`at ${long(' ')}x (native`)));
    await assertQuick(() => redactLogText(`password=(${long('\\')}`));
    await assertQuick(() => redactLogText(`password=[${long('\\')}`));
    await assertQuick(() => redactLogText(`{"password":${long('0')}`));
  });
});
