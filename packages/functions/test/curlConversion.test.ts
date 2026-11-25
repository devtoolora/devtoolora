import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { curlToFetch } from '../src/web';

describe('cURL conversion fidelity', () => {
  it('preserves quoted backslashes, empty bodies, repeated data and implicit HTTP defaults', () => {
    assert.match(curlToFetch("curl 'https://example.com/' --data-raw ''"), /body: ""/);
    const attached = curlToFetch("curl -XPUT 'https://example.com/' '-HAccept: text/plain' -dx=1");

    assert.match(attached, /method: "PUT"/);
    assert.match(attached, /"Accept": "text\/plain"/);
    assert.match(attached, /body: "x=1"/);
    assert.match(curlToFetch("curl 'https://example.com/' -d a=1 -d b=2"), /body: "a=1&b=2"/);
    assert.match(curlToFetch("curl 'https://example.com/' --data-raw 'a\\nb'"), /body: "a\\\\nb"/);

    assert.match(
      curlToFetch("curl 'https://example.com/' --json '{\"a\":1}'"),
      /application\/json/,
    );

    assert.match(
      curlToFetch(
        "curl --url=https://example.com/ --request=POST --header='X-Demo: sample' --data-raw=demo",
      ),
      /X-Demo/,
    );

    assert.match(
      curlToFetch("curl 'https://example.com/' \\\n --data-raw demo"),
      /application\/x-www-form-urlencoded/,
    );

    assert.match(curlToFetch("curl 'https://example.com/'"), /redirect: "manual"/);
    assert.match(curlToFetch("curl -L 'https://example.com/'"), /redirect: "follow"/);
  });

  it('rejects unsupported behavior instead of silently dropping request data', () => {
    for (const input of [
      "curl 'https://example.com/' --proxy demo",
      "curl 'https://example.com/' --data @file",
      "curl 'https://example.com/' -H 'X: a' -H 'x: b'",
      "curl 'https://example.com/' -X GET -d demo",
      "curl 'https://example.com/' 'https://other.example/'",
      "curl 'https://example.com/' --data-urlencode a=b",
      "curl 'https://example.com/' -H",
      "curl 'https://example.com/' -H 'X:'",
      'curl "https://example.com/$TOKEN"',
      "curl 'https://example.com/' ; echo demo",
      "curl 'https://demo:demo@example.com/'",
      "curl 'file:///demo'",
      "curl 'https://example.com/' --data-raw demo \\",
    ])
      assert.throws(() => curlToFetch(input));
    assert.throws(() => curlToFetch('x'.repeat(65537)), /exceeds/);

    assert.throws(
      () => curlToFetch("curl 'https://example.com/' --location=yes"),
      /does not accept/,
    );

    assert.throws(() => curlToFetch("curl 'https://example.com/'\n-d demo"), /line continuations/);
    assert.throws(() => curlToFetch("curl 'https://example.com/' --data-raw a*b"), /globbing/);
  });

  it('names the reason for each request-shape rejection and builds the headers block', () => {
    const rejected: Array<[string, RegExp]> = [
      ["curl 'https://example.com/' -X 'bad method'", /nonempty HTTP token/],
      ["curl 'https://example.com/' -X CONNECT", /forbidden by Fetch/],
      ["curl 'https://example.com/' -X post", /uppercase method/],
      ["curl 'https://example.com/' -X HEAD -d a=1", /GET or HEAD body/],
      ["curl 'https://example.com/' --json a --json b", /binary\/JSON body flags/],
      ["curl 'https://example.com/' -d a --data-binary b", /binary\/JSON body flags/],
      ["curl 'https://example.com/' -H '__proto__: x'", /ASCII Name: value header/],
      ["curl 'https://example.com/' -H 'X-A: x' -H 'x-a: y'", /Duplicate case-insensitive/],
      ["curl 'https://example.com/[1]'", /glob patterns/],
      ['curl -d demo', /Could not find a URL/],
      ["curl 'ftp://example.com/'", /absolute HTTP\(S\) URL/],
      ["curl 'https://example.com/' --url", /--url requires a value/],
      ["curl 'https://example.com/' --silent=1", /does not accept a value/],
      ["curl 'https://example.com/' --nope", /Unsupported cURL option: --nope/],
      ['wget https://example.com/', /POSIX-style curl command/],
    ];

    for (const [input, message] of rejected)
      assert.throws(() => curlToFetch(input), message, input);

    assert.equal(
      curlToFetch("curl -g 'https://example.com/[1]' -H 'X-A: 1' --json '{}'"),
      [
        'const response = await fetch("https://example.com/[1]", {',
        '  method: "POST",',
        '  redirect: "manual",',
        '  headers: {',
        '    "X-A": "1",',
        '    "Content-Type": "application/json",',
        '    "Accept": "application/json"',
        '  },',
        '  body: "{}"',
        '});',
      ].join('\n'),
    );
  });
});
