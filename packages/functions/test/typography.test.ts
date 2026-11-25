import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { fixTypography } from '@devtoolora/functions/text';

const smart = { direction: 'smart', skipCode: false } as const;

describe('fixTypography', () => {
  it('converts ASCII punctuation to typographic characters', () => {
    const result = fixTypography("\"Hello,\" she said -- 'it's done...'", smart);

    assert.equal(
      result.text,
      '\u201CHello,\u201D she said \u2013 \u2018it\u2019s done\u2026\u2019',
    );

    assert.equal(result.replacements, 7);
    assert.equal(fixTypography('a---b', smart).text, 'a\u2014b');
  });

  it('skips Markdown code when asked', () => {
    const options = { direction: 'smart', skipCode: true } as const;

    assert.equal(fixTypography('Use `"x"` and "y"', options).text, 'Use `"x"` and \u201Cy\u201D');
    assert.equal(fixTypography('```\n"x"\n```\n"y"', options).text, '```\n"x"\n```\n\u201Cy\u201D');
  });

  it('converts typographic characters to ASCII', () => {
    const result = fixTypography('\u201Ca\u201D \u2018b\u2019 \u2013 \u2014 \u2026 x\u00A0y', {
      direction: 'ascii',
      skipCode: false,
    });

    assert.equal(result.text, '"a" \'b\' - -- ... x y');
    assert.equal(result.replacements, 8);
  });

  it('rejects oversized input', () => {
    assert.throws(() => fixTypography('x'.repeat(1_000_001), smart), /1,000,000/);
  });
});
