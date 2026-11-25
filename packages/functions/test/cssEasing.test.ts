import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { easingPresets, generateEasingCss, parseCubicBezier, resolveEasing } from '../src/css';

const backCss =
  ':root {\n  --easing: cubic-bezier(0.68, -0.6, 0.32, 1.6);\n}\n\n.element {\n  transition: transform 300ms var(--easing);\n}';

describe('generateEasingCss', () => {
  it('prints the custom property and the transition rule', () => {
    assert.equal(generateEasingCss([0.68, -0.6, 0.32, 1.6], 300), backCss);
  });

  it('rounds to 2 decimals and trims trailing zeros', () => {
    assert.match(
      generateEasingCss([0.333, 0, 0.5, 1.005], 1200),
      /cubic-bezier\(0\.33, 0, 0\.5, 1\)[\s\S]*transform 1200ms/,
    );
  });
});

describe('resolveEasing', () => {
  it('names CSS keyword presets and resolves their points', () => {
    assert.deepEqual(resolveEasing('ease-in-out', [0, 0, 1, 1]), {
      keyword: 'ease-in-out',
      points: [0.42, 0, 0.58, 1],
    });
  });

  it('uses the easings.net table without a keyword', () => {
    assert.deepEqual(resolveEasing('easeOutBack', [0, 0, 1, 1]), {
      points: [0.34, 1.56, 0.64, 1],
    });
  });

  it('returns the custom points for custom and rejects unknown presets', () => {
    assert.deepEqual(resolveEasing('custom', [0.1, 0.2, 0.3, 0.4]), {
      points: [0.1, 0.2, 0.3, 0.4],
    });

    for (const preset of ['bounce', 'toString', '__proto__'])
      assert.throws(() => resolveEasing(preset, [0, 0, 1, 1]), /Preset/, preset);
  });

  it('holds the 5 CSS keywords and the 12 easings.net curves', () => {
    assert.equal(Object.keys(easingPresets).length, 17);
    assert.deepEqual(easingPresets.ease, [0.25, 0.1, 0.25, 1]);
    assert.deepEqual(easingPresets.easeInOutBack, [0.68, -0.6, 0.32, 1.6]);
  });
});

describe('parseCubicBezier', () => {
  it('round-trips the generated output', () => {
    assert.deepEqual(
      parseCubicBezier(generateEasingCss([0.68, -0.6, 0.32, 1.6], 300)),
      [0.68, -0.6, 0.32, 1.6],
    );
  });

  it('rejects malformed or out-of-range functions', () => {
    for (const css of ['cubic-bezier(1,2)', 'cubic-bezier(1.2, 0, 0, 1)', 'ease', ''])
      assert.equal(parseCubicBezier(css), undefined, css);
  });
});
