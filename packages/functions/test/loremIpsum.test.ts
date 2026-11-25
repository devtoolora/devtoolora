import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateLoremIpsum, loremIpsum } from '@devtoolora/functions/text';

describe('controlled Lorem Ipsum generation', () => {
  it('preserves the classic sentence sequence and paragraph grouping', () => {
    const generated = generateLoremIpsum(6);

    assert.equal(generated.sentences, 6);
    assert.equal(generated.paragraphs.length, 2);
    assert.equal(generated.paragraphs[0]!.match(/\./g)?.length, 5);
    assert.equal(generated.paragraphs[1]!.match(/\./g)?.length, 1);
    assert.equal(generated.text, loremIpsum(6));
    assert.ok(generated.text.startsWith('Lorem ipsum dolor sit amet,'));
    assert.ok(!generated.text.endsWith('\n'));
  });

  it('generates exact word and paragraph amounts with honest sentence counts', () => {
    const words = generateLoremIpsum(5, { unit: 'words' });

    assert.equal(words.text, 'Lorem ipsum dolor sit amet,');
    assert.equal(words.words, 5);
    assert.equal(words.sentences, 0);
    assert.equal(words.paragraphs.length, 1);
    const paragraphs = generateLoremIpsum(3, { sentencesPerParagraph: 2, unit: 'paragraphs' });

    assert.equal(paragraphs.paragraphs.length, 3);
    assert.equal(paragraphs.sentences, 6);
    for (const paragraph of paragraphs.paragraphs) assert.equal(paragraph.match(/\./g)?.length, 2);
    assert.equal(generateLoremIpsum(1, { unit: 'words' }).text, 'Lorem');
  });

  it('is repeatable, changes the opening deliberately and respects maximum amounts', () => {
    assert.equal(generateLoremIpsum(100).sentences, 100);
    const maximumWords = generateLoremIpsum(5000, { unit: 'words' });

    assert.equal(maximumWords.words, 5000);
    assert.equal(maximumWords.text, generateLoremIpsum(5000, { unit: 'words' }).text);
    const maximumParagraphs = generateLoremIpsum(50, {
      sentencesPerParagraph: 10,
      unit: 'paragraphs',
    });

    assert.equal(maximumParagraphs.paragraphs.length, 50);
    assert.equal(maximumParagraphs.sentences, 500);
    assert.ok(maximumParagraphs.text.length < 100_000);
    assert.ok(generateLoremIpsum(1, { startWithLorem: false }).text.startsWith('Sed do eiusmod'));
    assert.ok(generateLoremIpsum(25, { startWithLorem: false }).text.includes('Lorem ipsum'));
  });

  it('rejects invalid amounts rather than clamping or allocating unbounded output', () => {
    for (const count of [0, -1, 1.5, NaN, Infinity, 101])
      assert.throws(() => generateLoremIpsum(count), /whole number/);
    assert.throws(() => generateLoremIpsum(5001, { unit: 'words' }), /5,000/);
    assert.throws(() => generateLoremIpsum(51, { unit: 'paragraphs' }), /50/);
    for (const size of [0, 11, 1.5, NaN])
      assert.throws(
        () => generateLoremIpsum(1, { sentencesPerParagraph: size }),
        /Sentences per paragraph/,
      );
    assert.equal(generateLoremIpsum(5, { sentencesPerParagraph: NaN, unit: 'words' }).words, 5);
  });
});
