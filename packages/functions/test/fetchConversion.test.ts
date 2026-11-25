import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { curlToFetch, fetchToCurl } from '../src/web';
import { readLiteralFetch } from '../src/web/literalFetch';

describe('literal Fetch conversion', () => {
  it('round-trips generated literals, escaped quotes, Unicode and empty bodies without executing code', () => {
    for (const command of [
      "curl 'https://example.com/'",
      "curl -L 'https://example.com/' -H 'X-Demo: sample'",
      "curl 'https://example.com/' --data-raw ''",
      'curl \'https://example.com/\' --json \'{"name":"Ada"}\'',
      "curl 'https://example.com/' --data-raw 'demo\\nb'",
      "curl --globoff 'https://example.com/?q=[a]' -X PUT --data-raw demo",
    ]) {
      const before = readLiteralFetch(curlToFetch(command));
      const after = readLiteralFetch(curlToFetch(fetchToCurl(curlToFetch(command))));

      assert.deepEqual(after, before);
    }

    const input =
      'const response = await fetch("https://example.com/", { method: "post", redirect: "manual", body: "O\'Reilly \\u{1F600} \\x41 \\n" });';
    const parsed = readLiteralFetch(input);

    assert.equal(parsed.request.method, 'POST');
    assert.equal(parsed.request.body, "O'Reilly 😀 A \n");
    assert.deepEqual(readLiteralFetch(curlToFetch(fetchToCurl(input))), parsed);

    assert.equal(
      readLiteralFetch('fetch(`https://example.com/`, { body: null, });').request.body,
      undefined,
    );

    assert.equal(
      readLiteralFetch('fetch("https://example.com/", { method: "POST", body: `first\r\nsecond` })')
        .request.body,
      'first\nsecond',
    );
  });

  it('rejects variables, evaluation, unsupported options and unrepresentable syntax', () => {
    const invalid = [
      'fetch(url)',
      'fetch("https://example.com/", options)',
      'fetch("https://example.com/", {method:"POST", body:JSON.stringify({x:1})})',
      'fetch(`https://${host}/`)',
      'fetch("https://example.com/").then(handler)',
      'fetch("https://example.com/"); doSomething()',
      'fetch("https://example.com/", { credentials:"include" })',
      'fetch("https://example.com/", { redirect:"error" })',
      'fetch("https://example.com/", { body:"" })',
      'fetch("https://example.com/", { method:"TRACE" })',
      'fetch("https://example.com/", { method:"POST", body:"\\u0000" })',
      'fetch("https://example.com/", { method:"POST", body:"\\uD800" })',
      'fetch("https://example.com/", { headers:{ X:"one", x:"two" } })',
      'fetch("https://example.com/", { headers:{ X:"" } })',
      'fetch("https://example.com/", { headers:{ "__proto__":"demo" } })',
      'fetch("https://example.com/", {...options})',
      'fetch("/relative")',
    ];

    for (const input of invalid) assert.throws(() => fetchToCurl(input));
    assert.throws(() => fetchToCurl('x'.repeat(65537)), /exceeds/);
  });
});
