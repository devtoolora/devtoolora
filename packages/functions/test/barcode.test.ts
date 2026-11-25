import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { barcodeSvg, encodeBarcode } from '@devtoolora/functions/barcode';
import { code128Patterns } from '../src/barcode/tables';

const code128Vectors: [string, number[]][] = [
  ['Wikipedia', [104, 55, 73, 75, 73, 80, 69, 68, 73, 65, 88, 106]],
  ['1234567890', [105, 12, 34, 56, 78, 90, 85, 106]],
  ['AB1234567890', [104, 33, 34, 99, 12, 34, 56, 78, 90, 56, 106]],
  ['A12345', [104, 33, 17, 99, 23, 45, 64, 106]],
  ['123', [104, 17, 18, 19, 8, 106]],
  ['12', [105, 12, 14, 106]],
  ['\tA', [103, 73, 33, 36, 106]],
  ['AB123456CD', [104, 33, 34, 99, 12, 34, 56, 100, 35, 36, 94, 106]],
  ['AB12345CD', [104, 33, 34, 17, 18, 19, 20, 21, 35, 36, 58, 106]],
  ['AB1234567CD', [104, 33, 34, 17, 99, 23, 45, 67, 100, 35, 36, 97, 106]],
  ['a\tb', [104, 65, 101, 73, 100, 66, 84, 106]],
];

const wikipediaModules =
  '11010010000111010001101000011010011000010010100001101001010011110010110010000100001001101000011010010010110000111100100101100011101011';
const ean13Modules =
  '10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101';
const upcModules =
  '10100011010111101010111100011010001101000110101010110110011101001100110101110010011101101100101';
const wikiModules =
  '10001011101110101110001110101010101110100011101011101010100011101011101000111010100010111011101';

function decodeRuns(svg: string, moduleWidth: number): string {
  const path = /<path d="([^"]+)"/.exec(svg)?.[1] ?? '';
  const bars = [...path.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)h-[\d.]+z/g)];
  const first = Number(bars[0]?.[1]);
  let out = '';

  for (const bar of bars) {
    const start = (Number(bar[1]) - first) / moduleWidth;

    out = out.padEnd(start, '0') + '1'.repeat(Number(bar[3]) / moduleWidth);
  }

  return out;
}

describe('barcode encoding', () => {
  it.each(code128Vectors)('encodes Code 128 %j', (text, codewords) => {
    const out = encodeBarcode('code128', text);

    assert.deepEqual(out.codewords, codewords);
    assert.equal(out.modules, codewords.map((word) => code128Patterns[word]).join(''));
  });

  it('matches the published Wikipedia modules', () => {
    assert.equal(encodeBarcode('code128', 'Wikipedia').modules, wikipediaModules);
  });

  it('encodes EAN-13 and UPC-A', () => {
    const ean = encodeBarcode('ean13', '400638133393');

    assert.equal(ean.checkDigit, '1');
    assert.equal(ean.modules, ean13Modules);
    assert.equal(ean.humanText, '4006381333931');

    const upc = encodeBarcode('upca', '03600029145');

    assert.equal(upc.checkDigit, '2');
    assert.equal(upc.modules, upcModules);
    assert.equal(upc.humanText, '036000291452');
  });

  it('verifies check digits and strips separators', () => {
    assert.throws(() => encodeBarcode('ean13', '4006381333932'), /Check digit should be 1/);
    assert.equal(encodeBarcode('ean13', ' 400-638 133393 ').modules, ean13Modules);
    assert.throws(() => encodeBarcode('ean13', '12345'), /12 or 13 digits/);
    assert.throws(() => encodeBarcode('upca', '036000291453'), /Check digit should be 2/);
  });

  it('encodes Code 39 and uppercases with a note', () => {
    assert.equal(encodeBarcode('code39', 'WIKI').modules, wikiModules);

    const lower = encodeBarcode('code39', 'wiki');

    assert.equal(lower.modules, wikiModules);
    assert.equal(lower.humanText, 'WIKI');
    assert.equal(lower.note, 'Lowercase input was uppercased.');
    assert.equal(encodeBarcode('code39', 'CODE 39', { code39Check: true }).checkDigit, 'R');
  });

  it('rejects input that cannot be encoded faithfully', () => {
    assert.throws(() => encodeBarcode('code128', 'café'), /ASCII/);
    assert.throws(() => encodeBarcode('code128', 'a'.repeat(81)), /80/);
    assert.throws(() => encodeBarcode('code128', ''), /1-80/);
    assert.throws(() => encodeBarcode('code39', 'a*b'), /\*/);
    assert.throws(() => encodeBarcode('code39', 'a_b'), /Code 39/);
  });

  it('uppercases ASCII only, so Code 39 never encodes other data', () => {
    for (const code of [0xdf, 0x17f, 0x131, 0xfb01]) {
      const char = String.fromCharCode(code);

      assert.throws(
        () => encodeBarcode('code39', `stra${char}e`),
        new RegExp(`"${char}" is not allowed`),
      );
    }

    assert.throws(
      () => encodeBarcode('code39', String.fromCharCode(0xdf).repeat(60)),
      /is not allowed/,
    );
  });

  it('shows control characters visibly in the Code 39 message', () => {
    assert.throws(() => encodeBarcode('code39', 'WIKI\n'), /; "\\n" is not allowed\.$/);

    assert.throws(
      () => encodeBarcode('code39', `A${String.fromCharCode(1)}`),
      /; "\\u0001" is not allowed\.$/,
    );
  });
});

describe('barcode svg', () => {
  const svgOptions = { height: 80, moduleWidth: 2, showText: true };

  it('sizes the svg from modules and quiet zones', () => {
    const cases = [
      ['code128', 'Wikipedia', 20],
      ['code39', 'WIKI', 20],
      ['ean13', '400638133393', 18],
      ['upca', '03600029145', 18],
    ] as const;

    for (const [format, text, quiet] of cases) {
      const encoded = encodeBarcode(format, text);
      const svg = barcodeSvg(encoded, { ...svgOptions, format });

      assert.match(svg, new RegExp(`<svg [^>]*width="${(encoded.modules.length + quiet) * 2}"`));
      assert.equal(decodeRuns(svg, 2), encoded.modules);
    }
  });

  it('omits text on request and lengthens EAN guard bars', () => {
    const encoded = encodeBarcode('ean13', '400638133393');
    const plain = barcodeSvg(encoded, { ...svgOptions, format: 'ean13', showText: false });
    const withText = barcodeSvg(encoded, { ...svgOptions, format: 'ean13' });

    assert.ok(!plain.includes('<text'));
    assert.ok(withText.includes('<text'));

    const heights = [...withText.matchAll(/v([\d.]+)h-/g)].map((match) => Number(match[1]));

    assert.ok(Math.max(...heights) > Math.min(...heights));
  });
});
