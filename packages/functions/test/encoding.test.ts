import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  asciiToText,
  binaryToText,
  caesarCipher,
  decodeBase64Text,
  decodeBase64Bytes,
  decodeHtmlEntities,
  decodeUnicodeEscapes,
  decodeUrlText,
  encodeBase64Text,
  encodeBase64Bytes,
  encodeHtmlEntities,
  encodeUnicodeEscapes,
  encodeUrlText,
  hexToText,
  morseToText,
  textToAscii,
  textToBinary,
  textToHex,
  textToMorse,
} from '@devtoolora/functions/encoding';
import { FunctionError } from '@devtoolora/functions/errors';

describe('encoding functions', () => {
  it('round-trips all byte values without interpreting UTF-8 and retains strict Base64 validation', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);

    for (const alphabet of ['standard', 'url-safe'] as const) {
      assert.deepEqual(decodeBase64Bytes(encodeBase64Bytes(bytes, alphabet), alphabet), bytes);
    }

    assert.deepEqual(decodeBase64Bytes('/w=='), new Uint8Array([255]));
    assert.deepEqual(decodeBase64Bytes(''), new Uint8Array());
    for (const invalid of ['Zh==', 'a', 'aGVsbG8==', 'SGk_', 'aG=V'])
      assert.throws(() => decodeBase64Bytes(invalid), /invalid/);
  });

  it('supports explicit Base64 alphabets and preserves UTF-8 text exactly', () => {
    const text = '\uFEFFPříliš žluťoučký 🐎\n';

    assert.equal(decodeBase64Text(encodeBase64Text(text)), text);
    assert.equal(encodeBase64Text('Hi?', 'url-safe'), 'SGk_');
    assert.equal(decodeBase64Text('SGk_', 'url-safe'), 'Hi?');
    assert.equal(decodeBase64Text(' aG Vs\nbG8= '), 'hello');
    assert.equal(decodeBase64Text(''), '');
    assert.equal(decodeBase64Text('IA=='), ' ');

    for (const malformed of ['a', 'aGVsbG8==', 'aG=V', 'Zh==', 'SGk_']) {
      assert.throws(() => decodeBase64Text(malformed), /invalid/);
    }

    assert.throws(() => decodeBase64Text('SGk/', 'url-safe'), /invalid/);
    assert.throws(() => decodeBase64Text('/w=='), /UTF-8/);
  });

  it('distinguishes URL components, complete URLs and form values', () => {
    assert.equal(decodeUrlText('a+b', 'component'), 'a+b');
    assert.equal(decodeUrlText('a+b', 'form'), 'a b');
    assert.equal(encodeUrlText('a+b c', 'form'), 'a%2Bb+c');
    assert.equal(encodeUrlText("!*'()", 'form'), '%21*%27%28%29');
    const url = 'https://example.com/a b?q=čau&next=/home#top';

    assert.equal(decodeUrlText(encodeUrlText(url, 'url'), 'url'), url);

    assert.equal(
      decodeUrlText('https://example.com/?q=a%26b', 'url'),
      'https://example.com/?q=a%26b',
    );

    assert.equal(decodeUrlText('%252F', 'component'), '%2F');
    assert.equal(decodeUrlText('a+b', 'form'), 'a b');
    assert.throws(() => decodeUrlText('%E0%A4', 'component'), /percent|UTF-8/);
    assert.throws(() => encodeUrlText('\uD800', 'component'), /Unicode/);
  });

  it('round-trips UTF-8 text through Base64, binary, and HEX', () => {
    const text = 'Hi ✓';

    assert.equal(decodeBase64Text(encodeBase64Text(text)), text);
    assert.equal(binaryToText(textToBinary(text)), text);
    assert.equal(hexToText(textToHex(text)), text);
  });

  it('preserves BOM and whitespace in byte converters and rejects non-UTF-8 bytes', () => {
    const text = '\uFEFF č 🐎\n';

    assert.equal(binaryToText(textToBinary(text)), text);
    assert.equal(hexToText(textToHex(text)), text);
    assert.throws(() => binaryToText('11111111'), /UTF-8/);
    assert.throws(() => hexToText('ff'), /UTF-8/);
    assert.equal(hexToText('C4\n8D'), 'č');
    assert.equal(binaryToText('11000100\n10001101'), 'č');
  });

  it('rejects invalid Caesar shifts and handles zero, negative and wrapped shifts', () => {
    for (const shift of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => caesarCipher('ABC', shift), /integer/);
    }

    assert.equal(caesarCipher('Abc xyz!', 0), 'Abc xyz!');
    assert.equal(caesarCipher('Def', -3), 'Abc');
    assert.equal(caesarCipher('Abc', 29), 'Def');
    assert.equal(caesarCipher(caesarCipher('Hello č!', 13), 13), 'Hello č!');
  });

  it('decodes HTML named references, including case aliases and multi-code-point symbols', () => {
    assert.equal(
      decodeHtmlEntities('&copy; &COPY; &euro; &mdash; &nbsp; &apos;'),
      "© © € — \u00A0 '",
    );

    assert.equal(
      decodeHtmlEntities('&NotEqualTilde; &CounterClockwiseContourIntegral;'),
      '\u2242\u0338 ∳',
    );
  });

  it('decodes decimal and hexadecimal HTML references using HTML Unicode rules', () => {
    assert.equal(decodeHtmlEntities('&#65; &#269; &#x2713; &#128014; &#X1F40E;'), 'A č ✓ 🐎 🐎');
    assert.equal(decodeHtmlEntities('&#0; &#xD800; &#1114112; &#128;'), '� � � €');
    assert.equal(decodeHtmlEntities('&#x10FFFF;'), String.fromCodePoint(0x10ffff));
  });

  it('decodes a single HTML escaping layer and leaves unknown or incomplete references unchanged', () => {
    assert.equal(decodeHtmlEntities('&amp;lt; &amp;#65; &amp;copy;'), '&lt; &#65; &copy;');
    const unsupported = '&Copy; &notanentity; &copy &#65 &#x41 &#x; &#-1; &#65xyz;';

    assert.equal(decodeHtmlEntities(unsupported), unsupported);
    assert.equal(decodeHtmlEntities(''), '');
  });

  it('preserves Unicode and whitespace while escaping exactly five HTML syntax characters', () => {
    const source = '\uFEFF č 🐎\t\r\n <>&"\' &copy;';
    const encoded = '\uFEFF č 🐎\t\r\n &lt;&gt;&amp;&quot;&#39; &amp;copy;';

    assert.equal(encodeHtmlEntities(source), encoded);
    assert.equal(decodeHtmlEntities(encoded), source);
    assert.equal(encodeHtmlEntities('"it\'s"'), '&quot;it&#39;s&quot;');
    assert.equal(encodeHtmlEntities(''), '');
  });

  it('documents exact Unicode, ASCII and Morse boundaries', () => {
    assert.equal(decodeUnicodeEscapes('\\u0041\\u{2713}'), 'A✓');
    assert.equal(decodeUnicodeEscapes('\\uD83D\\uDE0A'), '😊');
    assert.equal(decodeUnicodeEscapes('\\uZZZZ \\n'), '\\uZZZZ \\n');
    assert.equal(decodeUnicodeEscapes('\\u00E9 \\u{E9}'), 'é é');

    assert.equal(
      decodeUnicodeEscapes('\\U00E9 \\U000000E9 \\U{e9}'),
      '\\U00E9 \\U000000E9 \\U{e9}',
    );

    assert.throws(() => decodeUnicodeEscapes('\\u{110000}'), /valid range/);
    assert.throws(() => textToAscii('č'), /ASCII/);
    assert.throws(() => asciiToText('128'), /0 and 127/);

    for (const character of ['č', 'ß', 'ſ', '😊']) {
      assert.throws(() => textToMorse(character), /Cannot encode/);
    }

    assert.throws(() => morseToText('.......'), /Unknown Morse/);
  });

  it('normalizes Morse capitalization and whitespace without empty edge words', () => {
    const encoded = textToMorse('  hi\tthere \n');

    assert.equal(encoded, '.... .. / - .... . .-. .');
    assert.equal(morseToText(encoded), 'HI THERE');
    assert.throws(() => textToMorse('   '), /required/);
  });

  it('handles URL, Unicode, HTML, ASCII, Caesar, and Morse transforms', () => {
    assert.equal(decodeUrlText(encodeUrlText('hello world & more')), 'hello world & more');

    assert.equal(decodeUnicodeEscapes(encodeUnicodeEscapes('Hi ✓')), 'Hi ✓');
    assert.equal(decodeHtmlEntities(encodeHtmlEntities('<b>A&B</b>')), '<b>A&B</b>');
    assert.equal(asciiToText(textToAscii('ABC')), 'ABC');
    assert.equal(caesarCipher('Hello', 13), 'Uryyb');
    assert.equal(morseToText(textToMorse('SOS')), 'SOS');
  });

  it('reports malformed inputs with stable error codes', () => {
    assert.throws(
      () => decodeBase64Text('not base64!'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_BASE64',
    );

    assert.throws(
      () => binaryToText('101'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_BINARY',
    );

    assert.throws(
      () => hexToText('f'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_HEX_BYTES',
    );
  });

  it('rejects Morse tokens that are prototype keys and names an empty word', () => {
    for (const token of ['constructor', 'toString', '__proto__'])
      assert.throws(() => morseToText(token), new RegExp(`Unknown Morse sequence: ${token}`));

    for (const input of ['... /', '/ ...', '... / / ---'])
      assert.throws(() => morseToText(input), /empty word/, input);

    assert.equal(morseToText('... / ---'), 'S O');
  });
});
