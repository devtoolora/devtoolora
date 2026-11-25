import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateTransformCss, transformOrigins, type TransformValues } from '../src/css';

const identity: TransformValues = {
  origin: 'center',
  perspective: 0,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  scaleX: 100,
  scaleY: 100,
  skewX: 0,
  skewY: 0,
  translateX: 0,
  translateY: 0,
};
const rule = (declarations: string): string => `.transform {\n  ${declarations}\n}`;

describe('generateTransformCss', () => {
  it('prints none for identity without an origin line', () => {
    assert.equal(generateTransformCss(identity), rule('transform: none;'));
  });

  it('merges equal scale axes and omits identity functions', () => {
    assert.equal(
      generateTransformCss({ ...identity, rotate: 15, scaleX: 110, scaleY: 110 }),
      rule('transform: rotate(15deg) scale(1.1);'),
    );
  });

  it('prints both scale axes when they differ', () => {
    assert.equal(
      generateTransformCss({ ...identity, scaleX: 110, scaleY: 90 }),
      rule('transform: scale(1.1, 0.9);'),
    );
  });

  it('puts perspective first', () => {
    assert.equal(
      generateTransformCss({ ...identity, perspective: 800, rotateY: 30 }),
      rule('transform: perspective(800px) rotateY(30deg);'),
    );
  });

  it('keeps units at zero for translate and skew pairs', () => {
    assert.equal(
      generateTransformCss({ ...identity, skewX: 10, translateX: 10 }),
      rule('transform: translate(10px, 0px) skew(10deg, 0deg);'),
    );
  });

  it('keeps the fixed function order', () => {
    assert.equal(
      generateTransformCss({
        ...identity,
        perspective: 500,
        rotate: 5,
        rotateX: 10,
        rotateY: 20,
        scaleX: 50,
        scaleY: 50,
        skewY: 3,
        translateY: -4,
      }),
      rule(
        'transform: perspective(500px) translate(0px, -4px) rotate(5deg) rotateX(10deg) rotateY(20deg) scale(0.5) skew(0deg, 3deg);',
      ),
    );
  });

  it('adds transform-origin only when it is not center', () => {
    assert.equal(
      generateTransformCss({ ...identity, origin: 'top left' }),
      rule('transform: none;\n  transform-origin: top left;'),
    );
  });

  it('rejects an origin outside the nine options', () => {
    assert.equal(transformOrigins.length, 9);
    assert.throws(() => generateTransformCss({ ...identity, origin: '10px 5px' }), /origin/i);
  });
});
