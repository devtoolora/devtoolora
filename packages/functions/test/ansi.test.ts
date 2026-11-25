import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { ansiToHtml, stripAnsi } from '@devtoolora/functions/logs';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const CSI9B = String.fromCharCode(0x9b);
const pre = (inner: string): string => `<pre class="ansi">${inner}</pre>`;

describe('stripAnsi', () => {
  it('removes sequences and counts them', () => {
    assert.deepEqual(stripAnsi(`${ESC}[31mred${ESC}[0m plain`), { removed: 2, text: 'red plain' });
    assert.equal(stripAnsi(`${ESC}]0;title${BEL}text`).text, 'text');
    assert.equal(stripAnsi(`${ESC}]0;title${ESC}\\text`).text, 'text');
    assert.equal(stripAnsi(`${CSI9B}1mbold`).text, 'bold');
    assert.equal(stripAnsi(`${ESC}(Bx${ESC}=y`).text, 'xy');
    const nested = stripAnsi(`${ESC}]0;a;${ESC}[31mb${BEL}Z`).text;

    assert.ok(!nested.includes('[31m') && nested.endsWith('Z'));
    assert.equal(stripAnsi(`${ESC}[2J${ESC}[H${ESC}[?25lx`).text, 'x');
  });

  it('ends an unterminated sequence at the line break', () => {
    assert.equal(stripAnsi(`a${ESC}[31\nb`).text, 'a\nb');
    assert.equal(stripAnsi(`a${ESC}]0;title\nb`).text, 'a\nb');
    assert.deepEqual(stripAnsi(`a${ESC}[31`), { removed: 1, text: 'a' });
  });

  it('rejects oversized input', () => {
    assert.throws(() => stripAnsi('x'.repeat(1_048_577)), /1,048,576/);
  });

  it('stays linear on a maximum-size input', () => {
    const input = `${ESC}[31m${ESC}[0m`.repeat(Math.ceil(1_048_576 / 8)).slice(0, 1_048_576);
    const mixed = `${ESC}[1;31mwarn <b>${ESC}[0m text & more\n`.repeat(30_000).slice(0, 1_048_576);
    const start = performance.now();

    stripAnsi(input);
    ansiToHtml(input);
    stripAnsi(mixed);
    ansiToHtml(mixed);

    assert.ok(performance.now() - start < 5000);
  });
});

describe('ansiToHtml', () => {
  it('renders colors and attributes', () => {
    assert.equal(
      ansiToHtml(`${ESC}[31mred${ESC}[0m plain`).text,
      pre('<span style="color:#cd0000">red</span> plain'),
    );

    assert.equal(
      ansiToHtml(`${ESC}[1;38;5;208mX${ESC}[22m`).text,
      pre('<span style="color:#ff8700;font-weight:bold">X</span>'),
    );

    assert.equal(
      ansiToHtml(`${ESC}[38;5;208mX${ESC}[22mY`).text,
      pre('<span style="color:#ff8700">XY</span>'),
    );

    assert.equal(
      ansiToHtml(`${ESC}[38;2;1;2;3;48;5;232;4;9mX${ESC}[0m`).text,
      pre(
        '<span style="color:#010203;background:#080808;text-decoration:underline line-through">X</span>',
      ),
    );

    assert.equal(
      ansiToHtml(`${ESC}[7mX${ESC}[27mY`).text,
      pre('<span style="color:#ffffff;background:#000000">X</span>Y'),
    );

    assert.equal(
      ansiToHtml(`${ESC}[93;3mX`).text,
      pre('<span style="color:#ffff00;font-style:italic">X</span>'),
    );

    assert.equal(ansiToHtml(`${ESC}[2mdim`).text, pre('<span style="opacity:0.6">dim</span>'));
  });

  it('escapes text and ignores invalid colors', () => {
    assert.equal(ansiToHtml('<a & "b">').text, pre('&lt;a &amp; &quot;b&quot;&gt;'));
    assert.equal(ansiToHtml(`${ESC}[38;5;999mX${ESC}[38;2;300;0;0mY`).text, pre('XY'));
  });

  it('never emits empty or nested spans', () => {
    assert.equal(ansiToHtml(`${ESC}[31m${ESC}[0mX`).spans, 0);

    assert.equal(
      ansiToHtml(`${ESC}[31m\n${ESC}[0m`).text,
      pre('<span style="color:#cd0000">\n</span>'),
    );

    assert.equal(ansiToHtml(`${ESC}[31ma${ESC}[32mb`).spans, 2);
  });

  it('handles attribute edge cases', () => {
    assert.equal(
      ansiToHtml(`${ESC}[1;2mx${ESC}[22my`).text,
      pre('<span style="font-weight:bold">x</span>y'),
    );

    assert.equal(ansiToHtml(`${ESC}[2mx`).text, pre('<span style="opacity:0.6">x</span>'));
    assert.equal(ansiToHtml(`${ESC}[;31mx`).text, pre('<span style="color:#cd0000">x</span>'));
  });

  it('ignores truncated extended color groups', () => {
    assert.equal(ansiToHtml(`${ESC}[38;5mx`).text, pre('x'));
    assert.equal(ansiToHtml(`${ESC}[48;2;1;2mx`).text, pre('x'));
  });

  it('reads an unknown extended color kind as one parameter', () => {
    // 38;7 is not a color group: 38 is skipped and 7 then applies as inverse.
    assert.equal(
      ansiToHtml(`${ESC}[38;7mx`).text,
      pre('<span style="color:#ffffff;background:#000000">x</span>'),
    );
  });

  it('starts a new sequence at an ESC inside an OSC payload', () => {
    assert.deepEqual(stripAnsi(`${ESC}]0;a;${ESC}[31mb${BEL}Z`), { removed: 2, text: `b${BEL}Z` });
  });

  it('drops hyperlink OSC pairs, a lone trailing ESC and keeps carriage returns', () => {
    const link = `${ESC}]8;;http://x${ESC}\\link${ESC}]8;;${ESC}\\ end`;

    assert.deepEqual(stripAnsi(link), { removed: 2, text: 'link end' });
    assert.deepEqual(stripAnsi(`abc${ESC}`), { removed: 1, text: 'abc' });
    assert.deepEqual(stripAnsi(`a\rb${ESC}[31m\rc`), { removed: 1, text: 'a\rb\rc' });
  });

  it('drops DCS, SOS, PM and APC strings with their payload', () => {
    const esc = String.fromCharCode(27);

    for (const opener of ['P', 'X', '^', '_']) {
      const source = `a${esc}${opener}q#0;2~~${esc}\\b`;

      assert.deepEqual(stripAnsi(source), { removed: 1, text: 'ab' }, opener);
    }

    assert.equal(
      stripAnsi(`a${String.fromCharCode(0x90)}payload${String.fromCharCode(0x9c)}b`).text,
      'ab',
    );

    assert.equal(stripAnsi(`a${esc}Ppayload\nb`).text, 'a\nb');
  });

  it('reads colon-separated extended colors', () => {
    const esc = String.fromCharCode(27);
    const html = (params: string): string => ansiToHtml(`${esc}[${params}mx`).text;

    assert.match(html('38:2::10:20:30'), /color:#0a141e/);
    assert.match(html('38:2:10:20:30'), /color:#0a141e/);
    assert.match(html('48:2:0:10:20:30'), /background:#0a141e/);
    assert.match(html('38:5:208'), /color:#ff8700/);
    assert.match(html('1;38:5:208'), /font-weight:bold;?/);
    assert.match(html('4:3'), /underline/);
  });
});
