import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { detectContext } from '@devtoolora/core';

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

describe('detectContext', () => {
  it('keeps context results', () => {
    const cases: Array<[string, unknown]> = [
      ['curl https://api.example.com/users', 'curl'],
      [
        'curl -X POST \\\n  -H "Content-Type: application/json" \\\n  https://api.example.com',
        null,
      ],
      ['curl\n\nhttps://x.io', 'curl'],
      ['CURL  https://x.io', 'curl'],
      ['curl\r\nhttps://x.io', 'curl'],
      ['curling https://x.io', null],
      ['curl -s http://localhost:3000/a?b=c', 'curl'],
      ['GET /users HTTP/1.1\r\nHost: example.com\r\n\r\n', null],
      ['POST https://x.io/a HTTP/1.0\nContent-Type: text/plain\n\nbody', 'http'],
      ['GET / HTTP/1.1\n:authority: x\n', null],
      ['GET / HTTP/1.1\nHost example\n', null],
      ['GET / HTTP/1.1\nHost:', null],
      ['GET / HTTP/1.1\nHost: a\rb\n', null],
      ['GET / HTTP/1.1\nA:B:C\n', null],
      ['GET / HTTP/1.1\n: x\n', null],
      ['get * HTTP/1.1\nx:\n', null],
      ['Error: boom\n    at foo (/app/a.js:10:5)\n    at bar (/app/b.js:1:2)', 'stackTrace'],
      ['TypeError: x\n    at Object.<anonymous> (C:\\app\\a.js:1:2)', 'stackTrace'],
      ['    at async Promise.all (index 0)', null],
      ['at   x.js:1:2', 'stackTrace'],
      ['at x.js:1:2', null],
      ['  at foo (a.js:1)', 'stackTrace'],
      ['at foo bar.js:1:2', 'stackTrace'],
      ['at\tfoo\t(a.js:1:2)', 'stackTrace'],
      ['at foo (a.js:1:2) extra', null],
      ['at foo (eval at bar (a.js:1:2), <anonymous>:3:4)', 'stackTrace'],
      ['at foo(a.js:1:2)', 'stackTrace'],
      ['at  (a.js:1:2)', 'stackTrace'],
      ['at (a.js:1:2)', null],
      ['at a(b(c.js:1:2)', 'stackTrace'],
      ['at a (b c.js:1:2)', 'stackTrace'],
      ['at élève (ú.js:1:2)', 'stackTrace'],
      ['at foo (a.js:1:2)\r\nat bar (b.js:3:4)', 'stackTrace'],
      [
        'Traceback (most recent call last):\n  File "a.py", line 3, in <module>\nValueError',
        'stackTrace',
      ],
      ['Traceback (most recent call last):\r\n  File "a.py", line 3\r\n', 'stackTrace'],
      ['Traceback (most recent call last):\n\n\n  File "a", line 1', 'stackTrace'],
      [
        'x\nTraceback (most recent call last):\nTraceback (most recent call last):\n File "b", line 2',
        'stackTrace',
      ],
      ['Traceback (most recent call last):\n  x File "a", line 1', null],
      ['Traceback (most recent call last):File "a", line 1', null],
      ['Traceback (most recent call last):\n\u2028File "a\nb", line 1', 'stackTrace'],
      ['name: x\nother: y', 'yaml'],
      ['{"a":1}', 'json'],
      ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc', 'jwt'],
      ['<a>b</a>', 'xml'],
      ['a,b\n1,2', 'csv'],
      ['https://x.io/a', 'url'],
      ['a=1&b=2', 'query'],
      ['', null],
      ['   ', null],
      ['Traceback (most recent call last):\n\n\n  File "a", line 1', 'stackTrace'],
      [
        'x\nTraceback (most recent call last):\nTraceback (most recent call last):\n File "b", line 2',
        'stackTrace',
      ],
      ['Traceback (most recent call last):\n  x File "a", line 1', null],
      ['Traceback (most recent call last):File "a", line 1', null],
      ['Traceback (most recent call last):\n\u2028File "a\nb", line 1', 'stackTrace'],
      ['Traceback (most recent call last):\r\n\r  File "a", line 1', 'stackTrace'],
      ['Traceback (most recent call last):\n\t File "", line 1', null],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => detectContext(input)?.kind ?? null),
        expected,
        input,
      );
  });

  it('detects a frame on its own line only', () => {
    assert.equal(detectContext('Error\n    at main (/app/index.js:4:11)')?.kind, 'stackTrace');
    assert.equal(detectContext('at main\n(/app/index.js:4:11)'), undefined);
  });

  it('stays linear on long curl, HTTP and stack trace lookalikes', async () => {
    await assertQuick(() => detectContext(`curl ${long(' ')}x`));
    await assertQuick(() => detectContext(`GET / HTTP/1.1\na:${long(' ')}x`));
    await assertQuick(() => detectContext(`GET / HTTP/1.1\n${long('a:')}\rx`));
    await assertQuick(() => detectContext(`at ${long(' ')}x`));
    await assertQuick(() => detectContext(`at a(${long('!(')}`));
    await assertQuick(() => detectContext(`Traceback (most recent call last):\n${long('\n')}x`));
  });
});
