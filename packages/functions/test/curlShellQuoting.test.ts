import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseCurlCommand } from '../src/web/curl';

const parse = (command: string) => parseCurlCommand(command).request;

describe('curl ANSI-C quoting', () => {
  it('decodes the $-quoted forms that bash decodes', () => {
    assert.equal(
      parse(String.raw`curl 'https://x.test/a' --data-raw $'line1\nline2 café'`).body,
      'line1\nline2 café',
    );

    assert.deepEqual(parse(String.raw`curl https://x.test -H $'X-A: b'`).headers, [
      { name: 'X-A', value: 'b' },
    ]);

    assert.equal(
      parse(String.raw`curl https://x.test --data-raw $'it\'s \\ \"\t\u00e9\x41\101\U0001F600!'`)
        .body,
      `it's \\ "\t\u00e9AA\u{1F600}!`,
    );
  });

  it('joins adjacent quoting and reads byte escapes as UTF-8', () => {
    assert.equal(parse(String.raw`curl https://x.test --data-raw a$'\n'"b"'c'`).body, 'a\nbc');
    assert.equal(parse(String.raw`curl https://x.test --data-raw $'\xc3\xa9\303\251'`).body, 'éé');
    assert.equal(parse(String.raw`curl https://x.test --data-raw $'\q\cA'`).body, '\\q\u0001');
  });

  it('keeps $ literal inside double quotes and rejects what it cannot represent', () => {
    assert.equal(parse(`curl https://x.test --data-raw "a$'b"`).body, "a$'b");
    assert.throws(() => parse(String.raw`curl https://x.test --data-raw $'a\0b'`), /NUL/);
    assert.throws(() => parse(String.raw`curl https://x.test --data-raw $'\xff'`), /UTF-8/);
    assert.throws(() => parse(String.raw`curl https://x.test --data-raw $'abc`), /unterminated/);
    assert.throws(() => parse(`curl https://x.test --data-raw $"a"`), /unsupported/);
  });
});

describe('curl flags and globs', () => {
  it('reads bundled short switches', () => {
    assert.equal(parseCurlCommand('curl -sSL https://x.test/').follow, true);
    assert.throws(() => parse('curl -sX https://x.test/'), /Unsupported cURL option/);
  });

  it('sees URL globs the WHATWG parser percent-encodes', () => {
    assert.throws(() => parse("curl 'https://x.test/{a,b}'"), /glob/);
    assert.equal(parse("curl -g 'https://x.test/{a,b}'").url, 'https://x.test/{a,b}');
    assert.equal(parse("curl 'http://[::1]:8080/a'").url, 'http://[::1]:8080/a');
  });

  it('reads --head as a bodyless HEAD request', () => {
    assert.equal(parse('curl --head https://x.test/').method, 'HEAD');
    assert.equal(parse('curl -I https://x.test/').method, 'HEAD');
  });
});
