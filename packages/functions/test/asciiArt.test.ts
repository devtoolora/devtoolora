import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateFigletText, loadFigletFont, renderAsciiArt } from '@devtoolora/functions/text';

describe('FIGlet text banners', () => {
  it('matches the plain FIGlet output and measures its padding', async () => {
    const font = await loadFigletFont('Standard');
    const result = renderAsciiArt('Hi', 'Standard', font);

    assert.equal(result.text, generateFigletText('Hi', 'Standard', font));
    assert.equal(result.rows, result.text.split('\n').length);

    assert.equal(
      result.columns,
      Math.max(...result.text.split('\n').map((line) => Array.from(line).length)),
    );

    assert.match(result.text, /_   _/);

    assert.equal(
      renderAsciiArt('Hi\r\nBye', 'Standard', font).text,
      renderAsciiArt('Hi\nBye', 'Standard', font).text,
    );

    assert.equal(
      renderAsciiArt('Hi\rBye', 'Standard', font).text,
      renderAsciiArt('Hi\nBye', 'Standard', font).text,
    );
  });

  it('exposes explicit fitting controls for characters and stacked rows', async () => {
    const font = await loadFigletFont('Standard');
    const compact = renderAsciiArt('Hello', 'Standard', font, { horizontalLayout: 'fitted' });
    const full = renderAsciiArt('Hello', 'Standard', font, { horizontalLayout: 'full' });

    assert.ok(full.columns > compact.columns);
    const stacked = renderAsciiArt('Hi\nBye', 'Standard', font, { verticalLayout: 'full' });

    assert.ok(stacked.rows > renderAsciiArt('Hi', 'Standard', font).rows);

    assert.throws(
      () => renderAsciiArt('Hi', 'Standard', font, { horizontalLayout: 'invalid' as 'full' }),
      /spacing/,
    );
  });

  it('rejects unsupported characters and makes accent removal opt-in', async () => {
    const font = await loadFigletFont('Standard');

    assert.throws(() => renderAsciiArt('Hi😀', 'Standard', font), /U\+1F600/);
    assert.ok(renderAsciiArt('Příliš', 'Standard', font).text);
    assert.throws(() => renderAsciiArt('你好', 'Standard', font), /U\+4F60/);
    assert.throws(() => renderAsciiArt('A\u0301', 'Standard', font), /U\+0301/);

    assert.equal(
      renderAsciiArt('Příliš', 'Standard', font, { normalization: 'strip-accents' }).text,
      renderAsciiArt('Prilis', 'Standard', font).text,
    );

    for (const text of ['Hi\tBye', 'Hi\0', 'Hi\uD800', 'Hi\u007F'])
      assert.throws(
        () => renderAsciiArt(text, 'Standard', font),
        /control characters or unpaired surrogates/,
      );
  });

  it('folds stroke letters that NFD cannot decompose when accents are stripped', async () => {
    const big = await loadFigletFont('Big');

    assert.throws(
      () => renderAsciiArt('řšŁ', 'Big', big),
      /cannot render "ř" \(U\+0159\), "š" \(U\+0161\), "Ł" \(U\+0141\)/,
    );

    assert.equal(
      renderAsciiArt('řšŁ', 'Big', big, { normalization: 'strip-accents' }).text,
      renderAsciiArt('rsL', 'Big', big).text,
    );

    assert.equal(
      renderAsciiArt('Łódź Đđ Ħħ Øø Ŧŧ', 'Big', big, { normalization: 'strip-accents' }).text,
      renderAsciiArt('Lodz Dd Hh Oo Tt', 'Big', big).text,
    );
  });

  it('enforces raw-input limits and rejects blank or malformed input', async () => {
    const font = await loadFigletFont('Standard');

    assert.ok(renderAsciiArt('a'.repeat(100), 'Standard', font).text);
    assert.throws(() => renderAsciiArt('a'.repeat(101), 'Standard', font), /limited to 100/);

    assert.throws(
      () => renderAsciiArt('a'.repeat(99) + '\r\n', 'Standard', font),
      /limited to 100/,
    );

    assert.throws(() => renderAsciiArt(' \n ', 'Standard', font), /Text is required/);
    assert.throws(() => renderAsciiArt('Hi', 'Invalid test font', 'not a font'), /Could not load/);
  });
});
