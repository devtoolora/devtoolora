import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { stream } from '../src/data/fakeDataGenerators';
import { packSprites, spriteClassNames, spriteCss } from '../src/image/spritePack';

const two = [
  { height: 32, name: 'a', width: 32 },
  { height: 16, name: 'b', width: 16 },
];

describe('packSprites', () => {
  it('lays out horizontally and vertically in input order', () => {
    const horizontal = packSprites(two, { layout: 'horizontal', padding: 2 });

    assert.deepEqual(
      horizontal.frames.map(({ name, x, y }) => [name, x, y]),
      [
        ['a', 2, 2],
        ['b', 36, 2],
      ],
    );

    assert.deepEqual([horizontal.width, horizontal.height], [54, 36]);

    const vertical = packSprites(two, { layout: 'vertical', padding: 2 });

    assert.deepEqual([vertical.frames[1]!.x, vertical.frames[1]!.y], [2, 36]);
    assert.deepEqual([vertical.width, vertical.height], [36, 54]);
  });

  it('uses ceil(sqrt(n)) grid columns', () => {
    const sizes = [1, 2, 3].map((n) => ({ height: 10, name: `s${n}`, width: 10 }));
    const sheet = packSprites(sizes, { layout: 'grid', padding: 0 });

    assert.deepEqual([sheet.width, sheet.height], [20, 20]);
    assert.deepEqual([sheet.frames[2]!.x, sheet.frames[2]!.y], [0, 10]);
  });

  it('shelf-packs by height descending', () => {
    const sheet = packSprites(
      [
        { height: 10, name: 'wide', width: 40 },
        { height: 40, name: 'tall', width: 10 },
        { height: 20, name: 'mid', width: 20 },
      ],
      { layout: 'packed', padding: 0 },
    );
    const at = (name: string) => sheet.frames.find((frame) => frame.name === name);

    assert.deepEqual([at('tall')?.x, at('tall')?.y], [0, 0]);
    assert.deepEqual([at('mid')?.x, at('mid')?.y], [10, 0]);
    assert.deepEqual([at('wide')?.x, at('wide')?.y], [0, 40]);
    assert.deepEqual([sheet.width, sheet.height], [40, 50]);
  });

  it('never overlaps frames, keeps the padding gap and keeps them inside the sheet', () => {
    const random = stream(11, 'sprite-pack');

    for (let round = 0; round < 50; round += 1) {
      const sizes = Array.from({ length: 1 + Math.floor(random() * 30) }, (_, index) => ({
        height: 1 + Math.floor(random() * 60),
        name: `s${index}`,
        width: 1 + Math.floor(random() * 60),
      }));

      for (const layout of ['grid', 'horizontal', 'packed', 'vertical'] as const) {
        const padding = Math.floor(random() * 5);
        const sheet = packSprites(sizes, { layout, padding });

        sheet.frames.forEach((a, i) => {
          assert.ok(a.x >= padding && a.y >= padding, layout);
          assert.ok(a.x + a.width + padding <= sheet.width, layout);
          assert.ok(a.y + a.height + padding <= sheet.height, layout);

          sheet.frames.slice(i + 1).forEach((b) => {
            const apart =
              a.x + a.width + padding <= b.x ||
              b.x + b.width + padding <= a.x ||
              a.y + a.height + padding <= b.y ||
              b.y + b.height + padding <= a.y;

            assert.ok(apart, `${layout} overlap ${a.name} ${b.name}`);
          });
        });
      }
    }
  });
});

describe('spriteClassNames', () => {
  it('makes valid, unique CSS identifiers', () => {
    assert.deepEqual(spriteClassNames(['Logo.png', 'logo.PNG', '1-up.png', '***.png'], 'sprite'), [
      'sprite-logo',
      'sprite-logo-2',
      'sprite-img-3',
      'sprite-img-4',
    ]);

    assert.deepEqual(spriteClassNames(['ikona-ž.png', '.png', ''], 'ui'), [
      'ui-ikona-z',
      'ui-img-2',
      'ui-img-3',
    ]);

    assert.deepEqual(spriteClassNames(['a.png', 'a-2.png', 'a.gif'], 'p'), [
      'p-a',
      'p-a-2',
      'p-a-3',
    ]);
  });
});

describe('spriteCss', () => {
  const layout = packSprites(two, { layout: 'horizontal', padding: 2 });
  const names = ['sprite-a', 'sprite-b'];

  it('writes the spec block', () => {
    assert.equal(
      spriteCss(layout, names, { pixelRatio: 1, prefix: 'sprite' }),
      `.sprite {
  background-image: url('sprite.png');
  background-repeat: no-repeat;
  display: inline-block;
}

.sprite-a {
  width: 32px;
  height: 32px;
  background-position: -2px -2px;
}

.sprite-b {
  width: 16px;
  height: 16px;
  background-position: -36px -2px;
}
`,
    );
  });

  it('writes zero offsets as 0', () => {
    const flat = packSprites(two, { layout: 'horizontal', padding: 0 });

    assert.match(
      spriteCss(flat, names, { pixelRatio: 1, prefix: 's' }),
      /background-position: 0 0;/,
    );
  });

  it('halves values and adds background-size at pixelRatio 2, including odd sizes', () => {
    const css = spriteCss(layout, names, { pixelRatio: 2, prefix: 'sprite' });

    assert.match(css, /background-size: 27px 18px;/);
    assert.match(css, /width: 8px;/);
    assert.match(css, /background-position: -18px -1px;/);

    const odd = packSprites([{ height: 5, name: 'o', width: 7 }], {
      layout: 'horizontal',
      padding: 1,
    });

    assert.match(
      spriteCss(odd, ['x-o'], { pixelRatio: 2, prefix: 'x' }),
      /width: 3\.5px;\n  height: 2\.5px;\n  background-position: -0\.5px -0\.5px;/,
    );
  });
});
