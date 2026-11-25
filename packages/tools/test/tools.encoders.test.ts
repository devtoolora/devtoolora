import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { encoderTools } from '@devtoolora/tools';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { ToolError } from '@devtoolora/core';
import { contentOf } from './toolContent';
import { result, run } from './tools.helpers';

describe('bidirectional encoders', () => {
  it('does not name an encoded file after the decode fallback', async () => {
    const file = 'data:text/plain;base64,aGk=';
    const fields = { file, inputType: 'file', mode: 'encode' };

    assert.equal(
      (await result('base64-encode', '', fields)).summary,
      'Encoded file \u00B7 2 bytes \u00B7 text/plain',
    );

    assert.match(
      (await result('base64-encode', '', { ...fields, fileName: 'a.txt' })).summary ?? '',
      /^Encoded a\.txt /,
    );
  });

  it('encodes local files and recovers exact bytes from Base64 or Data URI', async () => {
    const bytes = Buffer.from([0, 255, 128, 10, 13, 0]);
    const file = `data:application/octet-stream;base64,${bytes.toString('base64')}`;
    const fields = { inputType: 'file', mode: 'encode', file, fileName: 'bytes.bin' };
    const encoded = await result('base64-encode', '', fields);

    assert.equal(encoded.text, bytes.toString('base64'));
    const decoded = await result('base64-encode', encoded.text, {
      inputType: 'file',
      mode: 'decode',
      fileName: 'bytes.bin',
    });

    assert.deepEqual(Buffer.from(decoded.artifact?.base64 ?? '', 'base64'), bytes);
    assert.equal(decoded.artifact?.fileName, 'bytes.bin');
    assert.deepEqual(decoded.resultActions, ['save']);
    const dataUri = await result('base64-encode', '', {
      ...fields,
      alphabet: 'url-safe',
      fileOutput: 'data-uri',
    });

    assert.equal(dataUri.text, file);
    const fromUri = await result('base64-decode', dataUri.text, { inputType: 'file' });

    assert.equal(fromUri.artifact?.base64, bytes.toString('base64'));
    assert.equal(fromUri.artifact?.mimeType, 'application/octet-stream');
    assert.equal(fromUri.artifact?.fileName, 'decoded.bin');
    assert.equal(fromUri.previewDataUri, undefined);
    const empty = await result('base64-encode', '', {
      ...fields,
      file: 'data:application/octet-stream;base64,',
    });

    assert.equal(empty.text, '');
    assert.match(empty.summary ?? '', /0 bytes/);
  });

  it('provides raster previews by bytes, never by untrusted Data URI media type alone', async () => {
    const tool = encoderTools.find((entry) => entry.id === 'base64-encode');
    const png = tool?.samples?.find((sample) => sample.label === 'Decode PNG file');

    assert.ok(png?.text);
    const image = await result('base64-encode', png.text, { inputType: 'file', mode: 'decode' });

    assert.equal(image.artifact?.fileName, 'decoded.png');
    assert.equal(image.artifact?.mimeType, 'image/png');
    assert.equal(image.previewDataUri, `data:image/png;base64,${png.text}`);

    for (const source of [
      '<svg onload="alert(1)"></svg>',
      '<html><script>alert(1)</script></html>',
    ]) {
      const encoded = Buffer.from(source).toString('base64');
      const unsafe = await result('base64-encode', `data:image/png;base64,${encoded}`, {
        inputType: 'file',
        mode: 'decode',
      });

      assert.equal(unsafe.previewDataUri, undefined);
      assert.equal(unsafe.artifact?.base64, encoded);
    }

    const pdf = await result('base64-encode', Buffer.from('%PDF-1.7\n').toString('base64'), {
      inputType: 'file',
      mode: 'decode',
    });

    assert.equal(pdf.artifact?.fileName, 'decoded.pdf');
    assert.equal(pdf.previewDataUri, undefined);
    const renamed = await result('base64-encode', '/w==', {
      inputType: 'file',
      mode: 'decode',
      fileName: '../bad\nname.bin',
    });

    assert.equal(renamed.artifact?.fileName, '.._bad_name.bin');
  });

  it('handles the exact 10 MiB file boundary without regular-expression stack overflow', async () => {
    const bytes = Buffer.alloc(10 * 1024 * 1024);

    bytes[0] = 255;
    bytes[bytes.length - 1] = 128;
    const standard = bytes.toString('base64');
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const file = `data:application/octet-stream;base64,${standard}`;
    const encoded = await result('base64-encode', '', { file, inputType: 'file', mode: 'encode' });

    assert.equal(encoded.text, standard);

    for (const alphabet of ['standard', 'url-safe']) {
      const text = alphabet === 'standard' ? standard : urlSafe;
      const decoded = await result('base64-encode', text, {
        alphabet,
        inputType: 'file',
        mode: 'decode',
      });

      assert.deepEqual(Buffer.from(decoded.artifact?.base64 ?? '', 'base64'), bytes);
    }

    await assert.rejects(
      () =>
        run('base64-encode', Buffer.alloc(bytes.length + 1).toString('base64'), {
          inputType: 'file',
          mode: 'decode',
        }),
      /10 MiB/,
    );
  }, 120_000);

  it('rejects malformed file values, output modes and oversized files', async () => {
    await assert.rejects(
      () => run('base64-encode', '', { inputType: 'file', mode: 'encode' }),
      /local file/,
    );

    for (const text of [
      'Zh==',
      'data:image/png,AAAA',
      'data:image/png;base64,Zh==',
      'data:image/png\n;base64,AAAA',
    ]) {
      await assert.rejects(
        () => run('base64-encode', text, { inputType: 'file', mode: 'decode' }),
        /invalid|Base64 data URI/,
      );
    }

    await assert.rejects(
      () =>
        run('base64-encode', '', {
          inputType: 'file',
          file: 'data:application/octet-stream;base64,AA==',
          fileOutput: 'wrong',
        }),
      /output/,
    );

    await assert.rejects(
      () =>
        run('base64-encode', 'A'.repeat(Math.ceil((10 * 1024 * 1024) / 3) * 4 + 4), {
          inputType: 'file',
          mode: 'decode',
        }),
      /10 MiB/,
    );

    await assert.rejects(
      () => run('base64-encode', 'hello', { inputType: 'unknown' }),
      /Text or File/,
    );
  });

  it('shares Base64 explanation and use cases with both entry points', () => {
    const tools = listBrowserWorkerTools();
    const base64 = tools.find((tool) => tool.id === 'base64-encode');
    const legacy = tools.find((tool) => tool.id === 'base64-decode');

    assert.ok(base64 && legacy);

    assert.deepEqual(
      contentOf(base64).documentation?.map((section) => section.title),
      ['What is Base64?', 'When to use Base64 Encode / Decode'],
    );

    assert.equal(typeof contentOf(base64).documentation?.[0]?.content, 'string');
    assert.ok(Array.isArray(contentOf(base64).documentation?.[1]?.content));
    assert.deepEqual(contentOf(legacy).documentation, contentOf(base64).documentation);
  });

  it('shares URL explanation and use cases with both entry points', () => {
    const tools = listBrowserWorkerTools();
    const url = tools.find((tool) => tool.id === 'url-encode');
    const legacy = tools.find((tool) => tool.id === 'url-decode');

    assert.ok(url && legacy);

    assert.deepEqual(
      contentOf(url).documentation?.map((section) => section.title),
      ['What is URL encoding?', 'When to use URL Encode / Decode'],
    );

    assert.equal(typeof contentOf(url).documentation?.[0]?.content, 'string');
    assert.ok(Array.isArray(contentOf(url).documentation?.[1]?.content));
    assert.equal(contentOf(url).help?.split('\n\n').length, 5);
    assert.deepEqual(contentOf(legacy).documentation, contentOf(url).documentation);
  });

  it('matches the URL guide examples without extra encoding or decoding passes', async () => {
    assert.equal(await run('url-encode', 'čau & ahoj'), '%C4%8Dau%20%26%20ahoj');
    assert.equal(await run('url-encode', 'a+b c', { context: 'form' }), 'a%2Bb+c');
    assert.equal(await run('url-encode', 'a%2Bb+c', { context: 'form', mode: 'decode' }), 'a+b c');

    assert.equal(
      await run('url-encode', 'https://example.com/a b?q=hello', { context: 'url' }),
      'https://example.com/a%20b?q=hello',
    );

    assert.equal(
      await run('url-encode', 'https://example.com/?q=A%26B', { context: 'url', mode: 'decode' }),
      'https://example.com/?q=A%26B',
    );

    assert.equal(await run('url-encode', '%252F', { mode: 'decode' }), '%2F');
    assert.equal(await run('url-encode', '%20'), '%2520');
  });

  it('runs both modes and keeps the decode aliases', async () => {
    assert.equal(await run('base64-encode', 'aGVsbG8=', { mode: 'decode' }), 'hello');
    assert.equal(await run('base64-decode', 'aGVsbG8='), 'hello');

    assert.equal(
      await run('base64-decode', 'Hi?', { alphabet: 'url-safe', mode: 'encode' }),
      'SGk_',
    );

    assert.equal(await run('url-encode', 'a+b', { mode: 'decode' }), 'a+b');
    assert.equal(await run('url-encode', 'a+b', { context: 'form', mode: 'decode' }), 'a b');
    assert.equal(await run('url-decode', 'a+b'), 'a b');
    await assert.rejects(() => run('base64-encode', '/w==', { mode: 'decode' }), /UTF-8/);
    await assert.rejects(() => run('base64-encode', 'hello', { mode: 'guess' }), ToolError);
    await assert.rejects(() => run('url-encode', 'hello', { context: 'unknown' }), ToolError);
  });

  it('provides working samples and documentation for each mode', async () => {
    for (const tool of listBrowserWorkerTools().filter(
      (entry) => entry.category === 'Encoders' && !entry.aliasOf,
    )) {
      assert.ok(
        contentOf(tool).help && contentOf(tool).examples?.length && contentOf(tool).notes?.length,
      );

      assert.equal(contentOf(tool).documentation?.length, 2, tool.id);
      assert.ok(contentOf(tool).help!.split('\n\n').length >= 3, tool.id);

      assert.ok(
        contentOf(tool).examples!.length >= 2 && contentOf(tool).notes!.length >= 2,
        tool.id,
      );

      assert.ok(tool.relatedToolIds?.length && tool.keywords?.length, tool.id);

      if (tool.textConversion) {
        assert.ok(
          tool.samples?.some((sample) => sample.fields?.mode === 'decode'),
          tool.id,
        );

        await assert.rejects(
          () => run(tool.id, 'A', { mode: 'invalid' }),
          /Choose Encode or Decode/,
        );
      }

      for (const sample of tool.samples ?? []) {
        const output = await run(tool.id, sample.text, sample.fields);

        if (sample.text === '') assert.equal(output, '', tool.id);
        else assert.ok(output, tool.id);
      }
    }
  });

  it('matches the runnable samples of the remaining Encoders', async () => {
    const expectedSamples: Record<string, Record<string, string>> = {
      'html-entities': {
        'Decode basic entities': '<b>A&B</b>',
        'HTML snippet': '&lt;span title=&quot;A&amp;B&quot;&gt;Hello&lt;/span&gt;',
        'Named symbols': 'Price: 10 €\n© 2026 — A\u00A0B',
        'Numeric Unicode': 'č ✓ 🐎',
        'One escaping layer': '&lt;',
        'Code example': 'if (a &lt; b &amp;&amp; b &gt; c) { return &#39;ok&#39;; }',
        'Missing semicolons': '&copy 2026 & &notanentity;',
      },
      'basic-auth': {
        'Demo credentials': 'Authorization: Basic ZGVtbzpzZWNyZXQ=',
        'Placeholder user and pass': 'Authorization: Basic dXNlcjpwYXNz',
        'RFC 7617 example': 'Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==',
        'Colon in password': 'Authorization: Basic dXNlcjpwYTpzcw==',
        'Email as username': 'Authorization: Basic ZGVtb0BleGFtcGxlLmNvbTpkZW1v',
        'UTF-8 password': 'Authorization: Basic ZGVtbzpww6Rzc3fDtnJk',
      },
      'text-binary': {
        Hello: '01001000 01100101 01101100 01101100 01101111',
        'Decode letter A': 'A',
        'UTF-8 character': '11000100 10001101',
        'Emoji bytes': '11110000 10011111 10010000 10001110',
        'Line-separated bytes': 'OK',
        'Decode accented word': 'čau',
      },
      'unicode-escape': {
        Symbols: '\\u{48}\\u{69}\\u{20}\\u{2713}',
        'Decode code points': 'Hi ✓',
        'Decode surrogate pair': '😊',
        'Four-digit escapes': 'Hi',
        'Text with escapes': 'Café 😀',
        'Invisible characters': '\\u{61}\\u{a0}\\u{62}\\u{200b}\\u{63}',
        Emoji: '\\u{1f60a}',
      },
      'hex-text': {
        Hello: '48 65 6c 6c 6f',
        'Decode greeting': 'Hi',
        'Compact UTF-8 bytes': 'č',
        'Accented text': '43 61 66 c3 a9',
        'Emoji bytes': 'f0 9f 90 8e',
        'Uppercase hex bytes': 'OK!',
        'Line-wrapped bytes': '{"ok":true}',
      },
      'ascii-text': {
        ABC: '65 66 67',
        'Decode greeting': 'Hi',
        'Space and newline': '65 32 10',
        'Digits as characters': '50 48 50 54',
        'JSON punctuation': '123 34 105 100 34 58 49 125',
        'Mixed whitespace': 'Hello',
        'Zero-padded codes': 'Hey',
      },
      'caesar-cipher': {
        ROT13: 'Uryyb',
        'Shift forward by 3': 'Def abc!',
        'Shift backward by 3': 'Abc xyz!',
        'Decode ROT13 sentence': 'Hello, world!',
        'Classic Caesar shift': 'YHQL YLGL YLFL',
        'Shift wraps past 26': 'Def',
        'Digits and accents unchanged': 'Ebbz 101, pnsé!',
      },
      'morse-code': {
        SOS: '... --- ...',
        'Decode SOS': 'SOS',
        'Two words': '.... . .-.. .-.. --- / .-- --- .-. .-.. -..',
        'Decode two words': 'HI THERE',
        Numbers: '..--- ----- ..--- -....',
        'Decode numbers': '123',
        Punctuation: '.... .. --..-- / --- -.- ..--..',
      },
      'url-encode': {
        'Encode query value': 'hello%20world%20%26%20more',
        'Decode query value': 'hello world & more',
        'Complete URL': 'https://example.com/a%20b?q=%C4%8Dau&next=/home#top',
        'Form plus / space': 'a+b c',
        'Encode form value': 'a%2Bb+c',
        'Redirect URL as value': 'https%3A%2F%2Fexample.com%2F%3Fa%3D1%26b%3D2',
        'Decode complete URL': 'https://example.com/a b?q=čau',
      },
    };

    for (const [id, expected] of Object.entries(expectedSamples)) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool);

      assert.deepEqual(
        tool.samples?.map((sample) => sample.label).sort(),
        Object.keys(expected).sort(),
      );

      for (const sample of tool.samples ?? []) {
        assert.equal(
          await run(id, sample.text, sample.fields),
          expected[sample.label],
          `${id}: ${sample.label}`,
        );
      }
    }
  });
});

describe('encoders and web tools', () => {
  it('decodes complete HTML references as plain text without recursive or legacy partial decoding', async () => {
    const text = '&NotEqualTilde; &#128014; &copy; &nbsp; &amp;lt; &Copy; &notanentity; &copy &#65';
    const decoded = await result('html-entities', text, { mode: 'decode' });

    assert.equal(decoded.text, '\u2242\u0338 🐎 © \u00A0 &lt; &Copy; &notanentity; &copy &#65');
    assert.equal(decoded.language, 'plaintext');
    assert.match(decoded.summary ?? '', /one pass/);

    assert.equal(
      await run('html-entities', '&lt;img src=x onerror=alert(1)&gt;', { mode: 'decode' }),
      '<img src=x onerror=alert(1)>',
    );
  });

  it('preserves Basic Auth credentials and rejects ambiguous or control-character input', async () => {
    const fields = { password: ' secret: word ', username: ' demo ' };

    assert.equal(
      await run('basic-auth', '', fields),
      `Authorization: Basic ${Buffer.from(' demo : secret: word ').toString('base64')}`,
    );

    await assert.rejects(
      () => run('basic-auth', '', { username: 'user:name', password: 'secret' }),
      /colon/,
    );

    await assert.rejects(
      () => run('basic-auth', '', { username: 'demo', password: 'line\nbreak' }),
      /control/,
    );

    await assert.rejects(
      () => run('basic-auth', '', { username: '', password: 'secret' }),
      /required/,
    );
  });

  it('encodes and decodes Base64 and URLs', async () => {
    assert.equal(await run('base64-encode', 'hello'), 'aGVsbG8=');
    assert.equal(await run('base64-decode', 'aGVsbG8='), 'hello');
    await assert.rejects(() => run('base64-decode', 'not base64!'), ToolError);
    assert.equal(await run('url-encode', 'hello world'), 'hello%20world');
    assert.equal(await run('url-decode', 'hello%20world'), 'hello world');
  });

  it('handles additional encoder helpers', async () => {
    assert.equal(
      await run('html-entities', '<b>A&B</b>', { mode: 'encode' }),
      '&lt;b&gt;A&amp;B&lt;/b&gt;',
    );

    assert.equal(
      await run('html-entities', '&lt;b&gt;A&lt;/b&gt;', { mode: 'decode' }),
      '<b>A</b>',
    );

    assert.equal(
      await run('basic-auth', '', { username: 'demo', password: 'secret' }),
      'Authorization: Basic ZGVtbzpzZWNyZXQ=',
    );

    assert.equal(await run('text-binary', 'A', { mode: 'encode' }), '01000001');
    assert.equal(await run('text-binary', '01000001', { mode: 'decode' }), 'A');
    assert.equal(await run('unicode-escape', '✓', { mode: 'encode' }), '\\u{2713}');
    assert.equal(await run('unicode-escape', '\\u{2713}', { mode: 'decode' }), '✓');
  });

  it('parses URLs and JWTs locally', async () => {
    const parsedUrl = JSON.parse(await run('url-parse', 'https://example.com:8443/path?q=1#top'));

    assert.equal(parsedUrl.hostname, 'example.com');
    assert.equal(parsedUrl.params.q, '1');

    const jwt = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: '123', exp: 4102444800 })).toString('base64url'),
      '',
    ].join('.');
    const decoded = JSON.parse(await run('jwt-parse', `Bearer ${jwt}`));

    assert.equal(decoded.payload.sub, '123');
    assert.equal(decoded.signature, 'none (unsigned token)');
    assert.match(decoded.times.exp, /^2100-01-01T00:00:00Z \(in \d+ years\)$/);

    const signed = await run('jwt-parse', '{"sub":"abc"}', { key: 'k'.repeat(32), mode: 'sign' });

    assert.match(signed, /^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]{43}$/);
    const verified = JSON.parse(
      await run('jwt-parse', signed, { key: 'k'.repeat(32), mode: 'verify' }),
    );

    assert.equal(verified.valid, true);
    assert.equal(verified.algorithm, 'HS256');
  });

  it('converts timestamps and performs lookups', async () => {
    assert.equal(JSON.parse(await run('timestamp-convert', '0')).iso, '1970-01-01T00:00:00.000Z');
    assert.equal(await run('http-status', '404'), '404 Not Found');
    assert.match(await run('http-status'), /2xx Success\n200 OK/);
    assert.equal(await run('mime-lookup', '.json'), 'json: application/json');
    assert.match(await run('mime-lookup'), /\.json: application\/json/);
    assert.equal(JSON.parse(await run('color-converter', '#ff0000')).hsl, 'hsl(0, 100%, 50%)');

    assert.equal(
      JSON.parse(await run('user-agent-parser', 'Mozilla/5.0 Chrome/120.0 Safari/537.36')).browser
        .name,
      'Chrome',
    );

    assert.equal(
      JSON.parse(await run('email-normalizer', 'Ada.Lovelace+demo@gmail.com')).normalized,
      'adalovelace@gmail.com',
    );

    assert.match(
      await run('meta-tag-generator', '', {
        title: 'Page',
        description: 'Description',
        url: 'https://example.com',
        image: 'https://example.com/og.png',
      }),
      /og:title/,
    );
  });

  it('parses query strings and raw HTTP headers', async () => {
    const query = JSON.parse(
      await run('query-string-parser', 'https://example.com/search?q=dev+tools&page=2&q=local', {
        mode: 'parse',
      }),
    );

    assert.deepEqual(query.q, ['dev tools', 'local']);
    assert.equal(query.page, '2');

    assert.equal(
      await run('query-string-parser', '{"q":"dev tools","page":2}', { mode: 'stringify' }),
      'q=dev+tools&page=2',
    );

    const headers = JSON.parse(
      await run(
        'http-headers-parser',
        'HTTP/2 200 OK\ncontent-type: application/json\nset-cookie: a=1\nset-cookie: b=2',
      ),
    );

    assert.equal(headers.startLine, 'HTTP/2 200 OK');
    assert.equal(headers.headers['content-type'], 'application/json');
    assert.deepEqual(headers.headers['set-cookie'], ['a=1', 'b=2']);
  });

  it('converts common cURL and fetch snippets', async () => {
    const fetch = await run(
      'curl-to-fetch',
      'curl -X POST https://api.example.com/items -H "Content-Type: application/json" --data-raw \'{"name":"Ada"}\'',
    );

    assert.match(fetch, /fetch\("https:\/\/api\.example\.com\/items"/);
    assert.match(fetch, /method: "POST"/);
    assert.match(fetch, /Content-Type/);

    const curl = await run(
      'fetch-to-curl',
      'fetch("https://api.example.com/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{\\"name\\":\\"Ada\\"}" })',
    );

    assert.match(curl, /^curl --location --globoff 'https:\/\/api\.example\.com\/items'/);
    assert.match(curl, /-H 'Content-Type: application\/json'/);
    assert.match(curl, /--data-raw/);
    const roundTrip = await run('curl-to-fetch', curl);

    assert.match(roundTrip, /method: "POST"/);
    assert.match(roundTrip, /body: "\{\\"name\\":\\"Ada\\"\}"/);
  });

  it('builds local HTTP requests with auth, bodies, and repeated headers', async () => {
    const built = await run('http-request-builder', '', {
      url: 'https://api.example.com/items?existing=yes',
      method: 'POST',
      query: 'tag=one\ntag=two',
      headers: 'X-Trace: first\nX-Trace: second\nAuthorization: Manual token',
      bodyMode: 'json',
      body: '{"name":"Ada"}',
      authMode: 'bearer',
      bearerToken: 'ignored-token',
    });

    assert.match(built, /https:\/\/api\.example\.com\/items\?existing=yes&tag=one&tag=two/);
    assert.match(built, /-H 'X-Trace: first' -H 'X-Trace: second'/);
    assert.match(built, /headers\.append\("X-Trace", "first"\);/);
    assert.match(built, /headers\.append\("X-Trace", "second"\);/);
    assert.match(built, /Authorization: Manual token/);
    assert.doesNotMatch(built, /Bearer ignored-token/);
    assert.match(built, /Content-Type: application\/json/);

    const form = await run('http-request-builder', '', {
      url: 'https://api.example.com/login',
      method: 'POST',
      bodyMode: 'form',
      body: 'name=Ada Lovelace\nrole=admin',
      authMode: 'basic',
      basicUsername: 'demo',
      basicPassword: 'secret',
    });

    assert.match(form, /Content-Type: application\/x-www-form-urlencoded/);
    assert.match(form, /name=Ada\+Lovelace&role=admin/);
    assert.match(form, /Authorization: Basic ZGVtbzpzZWNyZXQ=/);

    const raw = await run('http-request-builder', '', {
      url: 'https://api.example.com/raw',
      method: 'PUT',
      headers: 'Content-Type: application\/custom',
      bodyMode: 'raw',
      body: 'hello',
      rawContentType: 'text/plain',
      authMode: 'api-key',
      apiKeyName: 'api_key',
      apiKeyValue: 'local-key',
      apiKeyLocation: 'query',
    });

    assert.match(raw, /https:\/\/api\.example\.com\/raw\?api_key=local-key/);
    assert.match(raw, /Content-Type: application\/custom/);
    assert.doesNotMatch(raw, /Content-Type: text\/plain/);
  });

  it('inspects raw HTTP requests without executing them', async () => {
    const inspected = await run(
      'raw-http-request-inspector',
      'POST /items?dryRun=true HTTP/1.1\nHost: api.example.com\nX-Trace: first\nX-Trace: second\n\n{"name":"Ada"}',
      { scheme: 'https' },
    );

    assert.match(inspected, /https:\/\/api\.example\.com\/items\?dryRun=true/);
    assert.match(inspected, /headers\.append\("X-Trace", "first"\);/);
    assert.match(inspected, /headers\.append\("X-Trace", "second"\);/);
    assert.doesNotMatch(inspected, /headers\.append\("Host"/);
    assert.match(inspected, /--data-raw '\{"name":"Ada"\}'/);

    const absolute = await run(
      'raw-http-request-inspector',
      'GET http://localhost:3000/health HTTP/1.0\nAccept: application/json',
      { scheme: 'https' },
    );

    assert.match(absolute, /http:\/\/localhost:3000\/health/);

    await assert.rejects(
      () => run('raw-http-request-inspector', 'GET /items HTTP/1.1\nAccept: application/json'),
      ToolError,
    );

    await assert.rejects(
      () => run('raw-http-request-inspector', 'GET /items HTTP/2\nHost: api.example.com'),
      ToolError,
    );

    await assert.rejects(
      () =>
        run(
          'raw-http-request-inspector',
          'GET /items HTTP/1.1\nBroken header\nHost: api.example.com',
        ),
      ToolError,
    );
  });

  it('generates an Open Graph preview and tags', async () => {
    const preview = await run('open-graph-preview', '', {
      title: 'Dev Toolora',
      description: 'Private utilities for developers.',
      url: 'https://example.com',
      image: 'https://example.com/og.png',
      siteName: 'Dev Toolora',
    });

    assert.match(preview, /<link rel="canonical" href="https:\/\/example\.com\/">/);
    assert.match(preview, /og:title/);
    assert.match(preview, /og:site_name/);
    assert.match(preview, /<meta name="twitter:card" content="summary_large_image">/);
  });
});
