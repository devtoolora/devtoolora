import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { formatCssColor, parseCssColor } from '@devtoolora/functions/color';
import { FunctionError } from '@devtoolora/functions/errors';

describe('CSS colors', () => {
  it('matches browser conversions and round-trips every notation it writes', () => {
    const blue = formatCssColor(parseCssColor('#3b82f6'));

    assert.deepEqual(
      [blue.rgb, blue.hsl, blue.hwb, blue.oklch, blue.lab, blue.cmyk],
      [
        'rgb(59, 130, 246)',
        'hsl(217.2, 91.2%, 59.8%)',
        'hwb(217.2 23.1% 3.5%)',
        'oklch(62.31% 0.188 259.81)',
        'lab(54.62 8.76 -65.79)',
        'cmyk(76%, 47.2%, 0%, 3.5%)',
      ],
    );

    assert.equal(formatCssColor(parseCssColor('red')).lab, 'lab(54.29 80.8 69.89)');
    assert.equal(formatCssColor(parseCssColor('#808080')).oklch, 'oklch(59.99% 0 none)');

    for (const source of ['#10b981', '#663399', '#f97316', 'rgb(1 2 3)']) {
      const report = formatCssColor(parseCssColor(source), 'spaces');

      for (const notation of [
        report.rgb,
        report.hsl,
        report.hwb,
        report.oklch,
        report.oklab,
        report.lch,
        report.lab,
      ]) {
        assert.equal(
          formatCssColor(parseCssColor(notation)).hex,
          report.hex,
          `${source} via ${notation}`,
        );
      }
    }
  });

  it('reads alpha, hue units, percentages, none and named colors', () => {
    assert.equal(formatCssColor(parseCssColor('#3b82f680')).rgb, 'rgba(59, 130, 246, 0.502)');
    assert.equal(formatCssColor(parseCssColor('hsla(120, 100%, 25%, 0.25)')).hex, '#00800040');
    assert.equal(formatCssColor(parseCssColor('hsl(0.25turn 100% 50%)')).hex, '#80ff00');
    assert.equal(formatCssColor(parseCssColor('hsl(1rad 100% 50%)')).hsl, 'hsl(57.3, 100%, 50%)');
    assert.equal(formatCssColor(parseCssColor('hsl(100grad 100% 50%)')).hex, '#80ff00');
    assert.equal(formatCssColor(parseCssColor('hsl(90deg 100% 50%)')).hex, '#80ff00');

    assert.equal(
      formatCssColor(parseCssColor('rgb(100% 0% 50% / 10%)'), 'spaces').rgb,
      'rgb(255 0 128 / 0.1)',
    );

    assert.equal(formatCssColor(parseCssColor('oklch(50% none 120)')).oklch, 'oklch(50% 0 none)');
    assert.equal(formatCssColor(parseCssColor('transparent')).hex, '#00000000');
    assert.equal(formatCssColor(parseCssColor('#663399')).name, 'rebeccapurple');

    assert.match(
      formatCssColor(parseCssColor('#3b82f6')).name,
      /^closest named color: dodgerblue \(ΔE 3\.6\)$/,
    );

    assert.deepEqual(formatCssColor(parseCssColor('#ff0000')).contrast, {
      onBlack: 5.25,
      onWhite: 4,
      textColor: '#000000',
    });
  });

  it('keeps the legacy comma forms and the looser modern forms that browsers accept', () => {
    for (const [input, hex] of [
      ['rgb(255, 0, 0)', '#ff0000'],
      ['rgb(100%, 0%, 0%)', '#ff0000'],
      ['rgba(255, 0, 0, 50%)', '#ff000080'],
      ['hsl(120, 100%, 25%)', '#008000'],
      ['hsl(120deg, 100%, 25%, 0.5)', '#00800080'],
      ['rgb(100% 0 0)', '#ff0000'],
      ['hsl(120 100 25)', '#008000'],
      ['rgb(none 0 0)', '#000000'],
    ] as const)
      assert.equal(formatCssColor(parseCssColor(input)).hex, hex, input);
  });

  it('maps wide-gamut colors into sRGB and explains bad input', () => {
    const wide = parseCssColor('oklch(70% 0.4 150)');

    assert.equal(wide.gamutMapped, true);
    assert.ok([wide.r, wide.g, wide.b].every((channel) => channel >= 0 && channel <= 1));
    assert.match(formatCssColor(wide).notes?.[0] ?? '', /outside the sRGB gamut/);

    for (const [input, message] of [
      ['rgb(1, 2 3)', /needs three channels/],
      ['lab(50, 20, 30)', /uses spaces between channels/],
      ['rgb(1 2 3 / 4 / 5)', /more than one/],
      ['color(display-p3 1 0 0)', /color\(\) is not supported/],
      ['#12345', /is not a CSS color/],
      ['hsl(10foo 1% 1%)', /Hue "10foo"/],
      ['hsl(120, 50, 50)', /needs % on saturation and lightness/],
      ['hsla(120, 50%, 50, 0.5)', /needs % on saturation and lightness/],
      ['rgb(100%, 0, 0)', /cannot mix numbers and percentages/],
      ['rgba(1, 2%, 3, 0.5)', /cannot mix numbers and percentages/],
      ['rgb(none, 0, 0)', /cannot use none/],
      ['hsl(none, 50%, 50%)', /cannot use none/],
      ['rgb(1, 2, 3, none)', /cannot use none/],
    ] as const) {
      assert.throws(
        () => parseCssColor(input),
        (error: unknown) => error instanceof FunctionError && message.test(error.message),
        input,
      );
    }
  });
});
